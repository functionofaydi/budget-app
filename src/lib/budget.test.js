import { describe, expect, it } from 'vitest'
import {
  bucketBudgets, itemPlanned, itemSpent, leftoverAmount, monthSummary, myShare,
  netDifference, paycheckSummary, prefillItems, rebalance, spendStatus, splitTotal,
} from './budget.js'
import { toCents, fmt, fmtShort } from './money.js'
import { checkSlot, nextPayDate, suggestPeriod, shiftMonth } from './dates.js'

describe('money', () => {
  it('parses dollar strings into cents', () => {
    expect(toCents('$1,240.50')).toBe(124050)
    expect(toCents('12')).toBe(1200)
    expect(toCents('')).toBe(0)
    expect(toCents('0.1')).toBe(10)
    expect(Number.isNaN(toCents('abc'))).toBe(true)
  })
  it('formats cents', () => {
    expect(fmt(124000)).toBe('$1,240.00')
    expect(fmt(-500)).toBe('−$5.00')
    expect(fmtShort(62000)).toBe('$620')
    expect(fmtShort(2350)).toBe('$23.50')
  })
})

describe('dates', () => {
  it('knows which check a pay date is', () => {
    expect(checkSlot('2026-12-05')).toBe('first')
    expect(checkSlot('2026-12-20')).toBe('second')
  })
  it('suggests the pay period', () => {
    expect(suggestPeriod('2026-12-05')).toEqual({ start: '2026-11-16', end: '2026-11-30' })
    expect(suggestPeriod('2026-12-20')).toEqual({ start: '2026-12-01', end: '2026-12-15' })
    expect(suggestPeriod('2027-01-05')).toEqual({ start: '2026-12-16', end: '2026-12-31' })
    expect(suggestPeriod('2028-03-05')).toEqual({ start: '2028-02-16', end: '2028-02-29' })
  })
  it('finds the next pay date', () => {
    expect(nextPayDate('2026-11-22')).toBe('2026-12-05')
    expect(nextPayDate('2026-12-05')).toBe('2026-12-05')
    expect(nextPayDate('2026-12-21')).toBe('2027-01-05')
  })
  it('shifts months across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})

describe('split', () => {
  it('rebalances to always total 100', () => {
    const s = rebalance({ needs: 50, wants: 30, savings: 20 }, 'needs', 60)
    expect(s.needs).toBe(60)
    expect(splitTotal(s)).toBe(100)
    expect(s.wants).toBe(24)
    expect(s.savings).toBe(16)
  })
  it('handles the other two being zero', () => {
    const s = rebalance({ needs: 100, wants: 0, savings: 0 }, 'needs', 70)
    expect(s).toEqual({ needs: 70, wants: 15, savings: 15 })
  })
  it('budgets add up exactly to net pay', () => {
    const b = bucketBudgets(124001, { needs: 33, wants: 33, savings: 34 })
    expect(b.needs + b.wants + b.savings).toBe(124001)
    expect(bucketBudgets(124000, { needs: 50, wants: 30, savings: 20 })).toEqual({ needs: 62000, wants: 37200, savings: 24800 })
  })
})

describe('paycheck entry', () => {
  it('checks gross − taxes − deductions = net', () => {
    const p = { gross: 162000, taxes: [{ amount: 9007 }, { amount: 10044 }, { amount: 2349 }], deductions: [{ amount: 1160 }, { amount: 940 }, { amount: 14500 }], net: 124000 }
    expect(netDifference(p)).toBe(0)
    expect(netDifference({ ...p, net: 124312 })).toBe(312)
  })
})

describe('line items', () => {
  const rent = { tag: 'shared', sharePct: 50, fullAmount: 60000, kind: 'bill', paid: false }
  it('counts only your share of shared items', () => {
    expect(itemPlanned(rent)).toBe(30000)
    expect(myShare({ tag: 'mine' }, 1000)).toBe(1000)
    expect(myShare({ tag: 'shared', sharePct: 40 }, 1000)).toBe(400)
  })
  it('bills count once marked paid, using the actual amount if given', () => {
    expect(itemSpent(rent)).toBe(0)
    expect(itemSpent({ ...rent, paid: true })).toBe(30000)
    expect(itemSpent({ ...rent, paid: true, paidAmount: 62000 })).toBe(31000)
  })
  it('spending items sum their transactions', () => {
    const groceries = { tag: 'mine', kind: 'spending', fullAmount: 11000 }
    expect(itemSpent(groceries, [{ amount: 3000 }, { amount: 3500 }])).toBe(6500)
  })
  it('flags status', () => {
    expect(spendStatus(3000, 4500)).toBe('over')
    expect(spendStatus(10000, 9000)).toBe('warn')
    expect(spendStatus(10000, 2000)).toBe('ok')
  })
})

describe('paycheck summary + leftover', () => {
  const paycheck = { id: 'p1', net: 124000, split: null }
  const items = [
    { id: 'rent', bucket: 'needs', kind: 'bill', tag: 'shared', sharePct: 50, fullAmount: 60000, paid: true },
    { id: 'groc', bucket: 'needs', kind: 'spending', tag: 'mine', fullAmount: 11000 },
    { id: 'gas', bucket: 'needs', kind: 'spending', tag: 'mine', fullAmount: 3000 },
    { id: 'fun', bucket: 'wants', kind: 'spending', tag: 'mine', fullAmount: 30000 },
    { id: 'save', bucket: 'savings', kind: 'bill', tag: 'mine', fullAmount: 24800, paid: true },
  ]
  const txs = [
    { itemId: 'groc', amount: 6500 },
    { itemId: 'gas', amount: 4500 },
    { itemId: 'fun', amount: 10000 },
  ]
  const s = paycheckSummary(paycheck, items, txs)
  it('computes budgets, assigned and spent', () => {
    expect(s.buckets.needs).toMatchObject({ budget: 62000, assigned: 44000, spent: 41000, toAssign: 18000, left: 21000 })
    expect(s.buckets.wants).toMatchObject({ budget: 37200, assigned: 30000, spent: 10000 })
    expect(s.unassigned).toBe(18000 + 7200)
  })
  it('leftover = unassigned + unspent − overspending in Needs and Wants', () => {
    // needs: 620 − 410 = 210; wants: 372 − 100 = 272 → 482
    expect(s.leftover).toBe(48200)
    expect(leftoverAmount({ needs: { budget: 100, spent: 300 }, wants: { budget: 100, spent: 0 } })).toBe(0)
  })
  it('uses a custom split when set', () => {
    const c = paycheckSummary({ ...paycheck, split: { needs: 60, wants: 20, savings: 20 } }, [], [])
    expect(c.custom).toBe(true)
    expect(c.buckets.needs.budget).toBe(74400)
  })
  it('month view adds checks and projects a missing one', () => {
    const m = monthSummary([s], { projectedNet: 124000, missingChecks: 1 })
    expect(m.net).toBe(248000)
    expect(m.buckets.needs.budget).toBe(124000)
    expect(m.buckets.needs.spent).toBe(41000)
  })
})

describe('recurring prefill', () => {
  const templates = [
    { id: 't-rent', name: 'Rent', repeat: 'monthly', check: 'first', amountType: 'fixed', fullAmount: 60000, bucket: 'needs', kind: 'bill', tag: 'shared', sharePct: 50 },
    { id: 't-phone', name: 'Phone', repeat: 'monthly', check: 'second', amountType: 'fixed', fullAmount: 4500, bucket: 'needs', kind: 'bill', tag: 'mine' },
    { id: 't-groc', name: 'Groceries', repeat: 'every', amountType: 'variable', fullAmount: 10000, bucket: 'needs', kind: 'spending', tag: 'mine' },
    { id: 't-off', name: 'Old', repeat: 'every', amountType: 'fixed', fullAmount: 100, active: false, bucket: 'wants', kind: 'bill', tag: 'mine' },
  ]
  it('puts monthly items only on their check and skips inactive ones', () => {
    const first = prefillItems({ id: 'p' }, 'first', templates)
    expect(first.map((i) => i.name)).toEqual(['Rent', 'Groceries'])
    const second = prefillItems({ id: 'p' }, 'second', templates)
    expect(second.map((i) => i.name)).toEqual(['Phone', 'Groceries'])
  })
  it('variable items copy the last amount and need review', () => {
    const prev = [
      { recurringId: 't-groc', fullAmount: 12000, payDate: '2026-11-20' },
      { recurringId: 't-groc', fullAmount: 9000, payDate: '2026-11-05' },
    ]
    const [, groc] = prefillItems({ id: 'p' }, 'first', templates, prev)
    expect(groc.fullAmount).toBe(12000)
    expect(groc.needsReview).toBe(true)
  })
  it('fixed items copy the template', () => {
    const [rent] = prefillItems({ id: 'p' }, 'first', templates, [{ recurringId: 't-rent', fullAmount: 1, payDate: '2026-11-05' }])
    expect(rent.fullAmount).toBe(60000)
    expect(rent.needsReview).toBe(false)
  })
})
