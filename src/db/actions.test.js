import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.js'
import {
  addTransaction, buildBackup, deletePaycheck, getSettings, pickCurrentPaycheck,
  restoreBackup, saveItemGoingForward, savePaycheck, saveRecurring, setItemPaid,
} from './actions.js'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('paycheck flow', () => {
  it('prefills recurring items and closes the previous check', async () => {
    await saveRecurring({ name: 'Rent', bucket: 'needs', kind: 'bill', tag: 'shared', sharePct: 50, fullAmount: 60000, repeat: 'monthly', check: 'first', amountType: 'fixed' })
    await saveRecurring({ name: 'Groceries', bucket: 'needs', kind: 'spending', tag: 'mine', fullAmount: 11000, repeat: 'every', amountType: 'variable' })

    const p1 = await savePaycheck({ payDate: '2026-12-05', net: 124000, gross: 162000, taxes: [], deductions: [] })
    const items1 = await db.items.where('paycheckId').equals(p1.id).toArray()
    expect(items1.map((i) => i.name).sort()).toEqual(['Groceries', 'Rent'])

    const groc = items1.find((i) => i.name === 'Groceries')
    await db.items.put({ ...groc, fullAmount: 13000 })

    const p2 = await savePaycheck({ payDate: '2026-12-20', net: 124000, gross: 162000, taxes: [], deductions: [] })
    const items2 = await db.items.where('paycheckId').equals(p2.id).toArray()
    expect(items2.map((i) => i.name)).toEqual(['Groceries'])
    expect(items2[0].fullAmount).toBe(13000) // variable: copies last amount
    expect(items2[0].needsReview).toBe(true)

    expect((await db.paychecks.get(p1.id)).closed).toBe(true)
    expect((await db.paychecks.get(p2.id)).closed).toBe(false)
  })

  it('editing a paycheck does not re-prefill', async () => {
    await saveRecurring({ name: 'Gas', bucket: 'needs', kind: 'spending', tag: 'mine', fullAmount: 3000, repeat: 'every', amountType: 'fixed' })
    const p = await savePaycheck({ payDate: '2026-12-05', net: 100000, taxes: [], deductions: [] })
    await savePaycheck({ ...p, net: 110000 })
    expect(await db.items.where('paycheckId').equals(p.id).count()).toBe(1)
  })

  it('deleting a paycheck removes its items and spending', async () => {
    const p = await savePaycheck({ payDate: '2026-12-05', net: 100000, taxes: [], deductions: [] })
    await db.items.put({ id: 'i1', paycheckId: p.id, name: 'X', bucket: 'wants', kind: 'spending', tag: 'mine', fullAmount: 100 })
    await addTransaction({ itemId: 'i1', paycheckId: p.id, amount: 50 })
    await deletePaycheck(p.id)
    expect(await db.items.count()).toBe(0)
    expect(await db.transactions.count()).toBe(0)
  })

  it('marking a bill paid clears needs-review', async () => {
    await db.items.put({ id: 'b', paycheckId: 'p', name: 'Utilities', kind: 'bill', needsReview: true, paid: false })
    await setItemPaid('b', true)
    expect(await db.items.get('b')).toMatchObject({ paid: true, needsReview: false })
  })

  it('"going forward" edits update the template', async () => {
    const t = await saveRecurring({ name: 'Phone', bucket: 'needs', kind: 'bill', tag: 'mine', fullAmount: 4500, repeat: 'monthly', check: 'second', amountType: 'fixed' })
    await saveItemGoingForward({ id: 'x', paycheckId: 'p', recurringId: t.id, name: 'Phone', bucket: 'needs', kind: 'bill', tag: 'mine', fullAmount: 5000 })
    expect((await db.recurring.get(t.id)).fullAmount).toBe(5000)
  })

  it('picks the current paycheck', () => {
    const ps = [{ payDate: '2026-11-20' }, { payDate: '2026-12-05' }, { payDate: '2026-12-20' }]
    expect(pickCurrentPaycheck(ps, '2026-12-10').payDate).toBe('2026-12-05')
    expect(pickCurrentPaycheck(ps, '2026-11-01').payDate).toBe('2026-11-20')
    expect(pickCurrentPaycheck([], '2026-11-01')).toBe(null)
  })
})

describe('backup', () => {
  it('round-trips everything', async () => {
    await getSettings()
    await saveRecurring({ name: 'Rent', bucket: 'needs', kind: 'bill', tag: 'mine', fullAmount: 1, repeat: 'every', amountType: 'fixed' })
    await savePaycheck({ payDate: '2026-12-05', net: 100000, taxes: [], deductions: [] })
    const backup = await buildBackup()
    await Promise.all(db.tables.map((t) => t.clear()))
    await restoreBackup(JSON.parse(JSON.stringify(backup)))
    expect(await db.paychecks.count()).toBe(1)
    expect(await db.recurring.count()).toBe(1)
    expect(await db.items.count()).toBe(1)
  })
  it('rejects files that are not backups', async () => {
    await expect(restoreBackup({ hello: 'world' })).rejects.toThrow('isn’t a Budget backup')
  })
})
