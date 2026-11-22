import { db } from '../db/db.js'
import { itemPlanned, myShare, sumAmounts, bucketInfo } from './budget.js'

const centsToNumber = (c) => ((c || 0) / 100).toFixed(2)

function csvCell(v) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(rows) {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

export async function paychecksCSV() {
  const paychecks = (await db.paychecks.toArray()).sort((a, b) => a.payDate.localeCompare(b.payDate))
  const rows = [['Pay date', 'Period start', 'Period end', 'Gross', 'Taxes', 'Deductions', 'Net', 'Split (N/W/S)', 'Details']]
  for (const p of paychecks) {
    const details = [...(p.taxes || []), ...(p.deductions || [])].map((l) => `${l.name}: ${centsToNumber(l.amount)}`).join('; ')
    const split = p.split ? `${p.split.needs}/${p.split.wants}/${p.split.savings}` : 'default'
    rows.push([p.payDate, p.periodStart, p.periodEnd, centsToNumber(p.gross), centsToNumber(sumAmounts(p.taxes)), centsToNumber(sumAmounts(p.deductions)), centsToNumber(p.net), split, details])
  }
  return toCSV(rows)
}

export async function spendingCSV() {
  const [paychecks, items, txs] = await Promise.all([db.paychecks.toArray(), db.items.toArray(), db.transactions.toArray()])
  const payDate = Object.fromEntries(paychecks.map((p) => [p.id, p.payDate]))
  const itemById = Object.fromEntries(items.map((i) => [i.id, i]))
  const rows = [['Date', 'Paycheck', 'Bucket', 'Line item', 'Tag', 'Type', 'Amount', 'Your share', 'Note']]
  for (const t of txs) {
    const it = itemById[t.itemId]
    if (!it) continue
    rows.push([t.date, payDate[t.paycheckId] || '', bucketInfo(it.bucket)?.label, it.name, it.tag, 'Purchase', centsToNumber(t.amount), centsToNumber(myShare(it, t.amount)), t.note])
  }
  for (const it of items) {
    if (it.kind !== 'bill' || !it.paid) continue
    const amt = it.paidAmount ?? it.fullAmount
    rows.push([payDate[it.paycheckId] || '', payDate[it.paycheckId] || '', bucketInfo(it.bucket)?.label, it.name, it.tag, 'Bill paid', centsToNumber(amt), centsToNumber(it.paidAmount != null ? myShare(it, it.paidAmount) : itemPlanned(it)), ''])
  }
  const [header, ...body] = rows
  body.sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  return toCSV([header, ...body])
}

/**
 * Hand a file to the user. On iPhone/iPad this opens the share sheet
 * (Save to Files, AirDrop, etc.); elsewhere it downloads.
 */
export async function deliverFile(filename, text, type) {
  const blob = new Blob([text], { type })
  const file = typeof File !== 'undefined' ? new File([blob], filename, { type }) : null
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'downloaded'
}
