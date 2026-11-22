import { db, newId, stamp, TABLES } from './db.js'
import { DEFAULT_SPLIT, prefillItems } from '../lib/budget.js'
import { checkSlot, todayISO } from '../lib/dates.js'

// ---------- Settings ----------

export const DEFAULT_SETTINGS = {
  id: 'app',
  defaultSplit: DEFAULT_SPLIT,
  presets: [
    { id: 'normal', name: 'Normal', split: { needs: 50, wants: 30, savings: 20 } },
    { id: 'tight', name: 'Tight month', split: { needs: 60, wants: 20, savings: 20 } },
    { id: 'trip', name: 'Trip saving', split: { needs: 50, wants: 20, savings: 30 } },
  ],
  taxLines: [
    { id: 'fed', name: 'Federal income tax', active: true },
    { id: 'ss', name: 'Social Security', active: true },
    { id: 'med', name: 'Medicare', active: true },
  ],
  deductionLines: [],
  defaultView: 'paycheck',
  defaultSharePct: 50,
  setupDone: false,
  lastBackupAt: null,
}

export async function getSettings() {
  const s = await db.settings.get('app')
  return { ...DEFAULT_SETTINGS, ...(s || {}) }
}

export async function saveSettings(patch) {
  const current = await getSettings()
  await db.settings.put(stamp({ ...current, ...patch, id: 'app' }))
}

// ---------- Paychecks ----------

/**
 * Save a paycheck. A new paycheck gets its recurring line items prefilled,
 * and any earlier open paychecks are closed (their leftover goes to savings).
 */
export async function savePaycheck(data) {
  return db.transaction('rw', db.paychecks, db.items, db.recurring, async () => {
    const isNew = !data.id || !(await db.paychecks.get(data.id))
    const paycheck = stamp({ split: null, closed: false, ...data })
    await db.paychecks.put(paycheck)
    if (isNew) {
      const templates = await db.recurring.toArray()
      const allItems = await db.items.toArray()
      const allChecks = await db.paychecks.toArray()
      const payDateById = Object.fromEntries(allChecks.map((p) => [p.id, p.payDate]))
      const previous = allItems.map((i) => ({ ...i, payDate: payDateById[i.paycheckId] }))
      const items = prefillItems(paycheck, checkSlot(paycheck.payDate), templates, previous)
      await db.items.bulkPut(items.map(stamp))
      const older = allChecks.filter((p) => p.id !== paycheck.id && !p.closed && p.payDate < paycheck.payDate)
      for (const p of older) await db.paychecks.put(stamp({ ...p, closed: true }))
    }
    return paycheck
  })
}

export async function setPaycheckClosed(id, closed) {
  const p = await db.paychecks.get(id)
  if (p) await db.paychecks.put(stamp({ ...p, closed }))
}

export async function setPaycheckSplit(id, split) {
  const p = await db.paychecks.get(id)
  if (p) await db.paychecks.put(stamp({ ...p, split }))
}

export async function deletePaycheck(id) {
  await db.transaction('rw', db.paychecks, db.items, db.transactions, async () => {
    await db.transactions.where('paycheckId').equals(id).delete()
    await db.items.where('paycheckId').equals(id).delete()
    await db.paychecks.delete(id)
  })
}

/** The paycheck you're living on right now: latest one paid on or before today. */
export function pickCurrentPaycheck(paychecks, today = todayISO()) {
  if (!paychecks.length) return null
  const sorted = [...paychecks].sort((a, b) => a.payDate.localeCompare(b.payDate))
  const past = sorted.filter((p) => p.payDate <= today)
  return past.length ? past[past.length - 1] : sorted[0]
}

// ---------- Line items ----------

export async function saveItem(item) {
  const saved = stamp(item)
  await db.items.put(saved)
  return saved
}

export async function deleteItem(id) {
  await db.transaction('rw', db.items, db.transactions, async () => {
    await db.transactions.where('itemId').equals(id).delete()
    await db.items.delete(id)
  })
}

export async function setItemPaid(id, paid) {
  const it = await db.items.get(id)
  if (it) await db.items.put(stamp({ ...it, paid, needsReview: paid ? false : it.needsReview }))
}

/** Save an item and push the same details to its recurring template (for future checks). */
export async function saveItemGoingForward(item) {
  const saved = await saveItem(item)
  if (item.recurringId) {
    const t = await db.recurring.get(item.recurringId)
    if (t) {
      await db.recurring.put(stamp({
        ...t,
        name: item.name, bucket: item.bucket, kind: item.kind, tag: item.tag,
        sharePct: item.sharePct, fullAmount: item.fullAmount,
      }))
    }
  }
  return saved
}

// ---------- Recurring templates ----------

export async function saveRecurring(t) {
  const saved = stamp(t)
  await db.recurring.put(saved)
  return saved
}

export async function deleteRecurring(id) {
  await db.recurring.delete(id)
}

/** Turn a one-time item into a recurring template and link it. */
export async function makeItemRecurring(item, { repeat, check, amountType }) {
  const t = await saveRecurring({
    name: item.name, bucket: item.bucket, kind: item.kind, tag: item.tag,
    sharePct: item.sharePct, fullAmount: item.fullAmount,
    repeat, check, amountType, active: true,
  })
  return saveItem({ ...item, recurringId: t.id })
}

// ---------- Transactions ----------

export async function addTransaction({ itemId, paycheckId, amount, note, date }) {
  const t = stamp({ itemId, paycheckId, amount, note: note || '', date: date || todayISO() })
  await db.transactions.put(t)
  return t
}

export async function deleteTransaction(id) {
  await db.transactions.delete(id)
}

// ---------- Backup / restore ----------

export const BACKUP_VERSION = 1

export async function buildBackup() {
  const data = {}
  for (const t of TABLES) data[t] = await db.table(t).toArray()
  return { app: 'budget-app', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data }
}

export function validateBackup(obj) {
  if (!obj || obj.app !== 'budget-app' || typeof obj.data !== 'object') return 'This isn’t a Budget backup file.'
  for (const t of TABLES) {
    if (obj.data[t] && !Array.isArray(obj.data[t])) return `Backup is damaged (${t}).`
  }
  return null
}

/** Replace everything on this device with the backup's contents. */
export async function restoreBackup(obj) {
  const err = validateBackup(obj)
  if (err) throw new Error(err)
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      const rows = (obj.data[t] || []).filter((r) => r && r.id)
      if (rows.length) await db.table(t).bulkPut(rows)
    }
  })
}

export { newId }
