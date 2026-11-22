import Dexie from 'dexie'

// On-device database (IndexedDB). Every record has a unique `id` and an
// `updatedAt` timestamp so cloud sync can be added later without a rewrite.
export const db = new Dexie('budget-app')

db.version(1).stores({
  settings: 'id',
  paychecks: 'id, payDate',
  recurring: 'id',
  items: 'id, paycheckId, recurringId',
  transactions: 'id, paycheckId, itemId, date',
})

export const TABLES = ['settings', 'paychecks', 'recurring', 'items', 'transactions']

export const newId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)

/** Add an id (if missing) and a fresh updatedAt. */
export function stamp(record) {
  const now = Date.now()
  return { id: record.id || newId(), createdAt: record.createdAt || now, ...record, updatedAt: now }
}
