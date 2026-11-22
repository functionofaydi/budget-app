import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db.js'
import { DEFAULT_SETTINGS } from './db/actions.js'
import { paycheckSummary } from './lib/budget.js'

/** Live settings (merged with defaults). `undefined` while loading. */
export function useSettings() {
  return useLiveQuery(async () => ({ ...DEFAULT_SETTINGS, ...((await db.settings.get('app')) || {}) }), [])
}

export function usePaychecks() {
  return useLiveQuery(() => db.paychecks.orderBy('payDate').toArray(), [])
}

/** One paycheck with its items, transactions and summary. */
export function usePaycheckData(paycheckId, defaultSplit) {
  return useLiveQuery(async () => {
    if (!paycheckId) return null
    const paycheck = await db.paychecks.get(paycheckId)
    if (!paycheck) return null
    const items = await db.items.where('paycheckId').equals(paycheckId).toArray()
    const txs = await db.transactions.where('paycheckId').equals(paycheckId).toArray()
    return { paycheck, items, txs, summary: paycheckSummary(paycheck, items, txs, defaultSplit) }
  }, [paycheckId, JSON.stringify(defaultSplit)])
}
