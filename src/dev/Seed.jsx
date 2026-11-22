// DEV ONLY: fills the app with made-up sample data for screenshots and testing.
// This file is never included in the production build.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db.js'
import { addTransaction, saveRecurring, saveSettings, savePaycheck } from '../db/actions.js'

const sampleLines = (taxes) => taxes

async function seed() {
  await Promise.all(db.tables.map((t) => t.clear()))
  await saveSettings({
    setupDone: true,
    deductionLines: [
      { id: 'pfml', name: 'WA Paid Leave', active: true },
      { id: 'cares', name: 'WA Cares', active: true },
      { id: 'health', name: 'Health insurance', active: true },
    ],
  })
  const r = (o) => saveRecurring({ tag: 'mine', sharePct: 50, active: true, amountType: 'fixed', ...o })
  await r({ name: 'Rent', bucket: 'needs', kind: 'bill', tag: 'shared', fullAmount: 60000, repeat: 'monthly', check: 'first' })
  await r({ name: 'Phone', bucket: 'needs', kind: 'bill', fullAmount: 4500, repeat: 'monthly', check: 'second' })
  await r({ name: 'Utilities', bucket: 'needs', kind: 'bill', tag: 'shared', fullAmount: 23000, repeat: 'monthly', check: 'first', amountType: 'variable' })
  await r({ name: 'Groceries', bucket: 'needs', kind: 'spending', fullAmount: 11000, repeat: 'every', amountType: 'variable' })
  await r({ name: 'Gas', bucket: 'needs', kind: 'spending', fullAmount: 3000, repeat: 'every' })
  await r({ name: 'Eating out', bucket: 'wants', kind: 'spending', fullAmount: 8000, repeat: 'every' })
  await r({ name: 'Entertainment', bucket: 'wants', kind: 'spending', fullAmount: 6000, repeat: 'every' })
  await r({ name: 'Streaming', bucket: 'wants', kind: 'bill', tag: 'shared', fullAmount: 3000, repeat: 'monthly', check: 'second' })
  await r({ name: 'Logan’s birthday fund', bucket: 'wants', kind: 'bill', tag: 'logan', fullAmount: 5000, repeat: 'every' })
  await r({ name: 'Emergency fund', bucket: 'savings', kind: 'bill', fullAmount: 14800, repeat: 'every' })
  await r({ name: 'Trip savings', bucket: 'savings', kind: 'bill', fullAmount: 10000, repeat: 'every' })

  const pay = {
    gross: 162000, net: 124000,
    taxes: sampleLines([{ lineId: 'fed', name: 'Federal income tax', amount: 9007 }, { lineId: 'ss', name: 'Social Security', amount: 10044 }, { lineId: 'med', name: 'Medicare', amount: 2349 }]),
    deductions: [{ lineId: 'pfml', name: 'WA Paid Leave', amount: 1160 }, { lineId: 'cares', name: 'WA Cares', amount: 940 }, { lineId: 'health', name: 'Health insurance', amount: 14500 }],
  }
  const p1 = await savePaycheck({ ...pay, payDate: '2026-11-05', periodStart: '2026-10-16', periodEnd: '2026-10-31' })
  const items1 = await db.items.where('paycheckId').equals(p1.id).toArray()
  for (const it of items1) if (it.kind === 'bill') await db.items.put({ ...it, paid: true, needsReview: false })
  const byName1 = Object.fromEntries(items1.map((i) => [i.name, i]))
  await addTransaction({ itemId: byName1.Groceries.id, paycheckId: p1.id, amount: 9850, date: '2026-11-08', note: 'Dissmore’s' })
  await addTransaction({ itemId: byName1['Eating out'].id, paycheckId: p1.id, amount: 6200, date: '2026-11-12' })

  const p2 = await savePaycheck({ ...pay, net: 124000, payDate: '2026-11-20', periodStart: '2026-11-01', periodEnd: '2026-11-15' })
  const items2 = await db.items.where('paycheckId').equals(p2.id).toArray()
  const byName = Object.fromEntries(items2.map((i) => [i.name, i]))
  await db.items.put({ ...byName['Emergency fund'], paid: true })
  await db.items.put({ ...byName['Trip savings'], paid: true })
  await db.items.put({ ...byName.Streaming, paid: true })
  await addTransaction({ itemId: byName.Groceries.id, paycheckId: p2.id, amount: 3000, date: '2026-11-20', note: 'Safeway' })
  await addTransaction({ itemId: byName.Groceries.id, paycheckId: p2.id, amount: 3500, date: '2026-11-21', note: 'Dissmore’s' })
  await addTransaction({ itemId: byName.Gas.id, paycheckId: p2.id, amount: 4500, date: '2026-11-21' })
  await addTransaction({ itemId: byName['Eating out'].id, paycheckId: p2.id, amount: 2350, date: '2026-11-22', note: 'Tacos' })
}

let running = null // React StrictMode runs effects twice in dev; seed only once.

export default function Seed() {
  const navigate = useNavigate()
  const [done, setDone] = useState(false)
  useEffect(() => {
    running ||= seed().finally(() => { running = null })
    running.then(() => { setDone(true); navigate('/', { replace: true }) })
  }, [navigate])
  return <div className="screen"><p className="muted">{done ? 'Seeded.' : 'Seeding sample data…'}</p></div>
}
