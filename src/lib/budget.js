// Pure budget math. No database or UI code here, so it's easy to test.

export const BUCKETS = [
  { key: 'needs', label: 'Needs', color: '#7AA2F7' },
  { key: 'wants', label: 'Wants', color: '#F0A35E' },
  { key: 'savings', label: 'Savings & Debt', color: '#4FD1A5' },
]
export const BUCKET_KEYS = BUCKETS.map((b) => b.key)
export const bucketInfo = (key) => BUCKETS.find((b) => b.key === key)

export const TAGS = [
  { key: 'mine', label: 'Mine' },
  { key: 'shared', label: 'Shared' },
  { key: 'logan', label: 'Logan' },
]

export const DEFAULT_SPLIT = { needs: 50, wants: 30, savings: 20 }

// ---------- Split ----------

export function splitTotal(split) {
  return BUCKET_KEYS.reduce((sum, k) => sum + (split?.[k] ?? 0), 0)
}

export function splitEquals(a, b) {
  return BUCKET_KEYS.every((k) => (a?.[k] ?? 0) === (b?.[k] ?? 0))
}

export function splitLabel(split) {
  return BUCKET_KEYS.map((k) => split[k]).join(' / ')
}

/**
 * Change one bucket's percent and rebalance the other two so the total stays 100.
 * The other two keep their relative proportions.
 */
export function rebalance(split, key, value) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  const others = BUCKET_KEYS.filter((k) => k !== key)
  const remaining = 100 - v
  const otherTotal = others.reduce((s, k) => s + split[k], 0)
  const next = { ...split, [key]: v }
  if (otherTotal === 0) {
    next[others[0]] = Math.ceil(remaining / 2)
    next[others[1]] = Math.floor(remaining / 2)
  } else {
    next[others[0]] = Math.round((split[others[0]] / otherTotal) * remaining)
    next[others[1]] = remaining - next[others[0]]
  }
  return next
}

/** Split net pay (cents) into bucket budgets. Savings absorbs rounding so totals match exactly. */
export function bucketBudgets(netCents, split) {
  const needs = Math.round((netCents * split.needs) / 100)
  const wants = Math.round((netCents * split.wants) / 100)
  return { needs, wants, savings: netCents - needs - wants }
}

// ---------- Paycheck entry ----------

export const sumAmounts = (lines) => (lines || []).reduce((s, l) => s + (l.amount || 0), 0)

/** Difference between the net entered and gross − taxes − deductions. 0 means it matches. */
export function netDifference(paycheck) {
  const expected = (paycheck.gross || 0) - sumAmounts(paycheck.taxes) - sumAmounts(paycheck.deductions)
  return (paycheck.net || 0) - expected
}

// ---------- Line items ----------

/** Your portion of an amount for an item. Shared items count only your share. */
export function myShare(item, amount) {
  if (item.tag === 'shared') return Math.round((amount * (item.sharePct ?? 50)) / 100)
  return amount
}

export const itemPlanned = (item) => myShare(item, item.fullAmount || 0)

/** What's actually been spent on an item (your share). */
export function itemSpent(item, txs = []) {
  if (item.kind === 'bill') {
    if (!item.paid) return 0
    return item.paidAmount != null ? myShare(item, item.paidAmount) : itemPlanned(item)
  }
  return txs.reduce((s, t) => s + myShare(item, t.amount), 0)
}

/** 'over' when spent exceeds plan, 'warn' at 85%+ of plan, otherwise 'ok'. */
export function spendStatus(planned, spent) {
  if (spent > planned) return 'over'
  if (planned > 0 && spent >= planned * 0.85) return 'warn'
  return 'ok'
}

export function groupBy(list, key) {
  const out = {}
  for (const x of list) (out[x[key]] ||= []).push(x)
  return out
}

// ---------- Summaries ----------

/**
 * Full summary of one paycheck: budgets, assigned, spent and what's left per bucket.
 * `defaultSplit` is used when the paycheck has no custom split.
 */
export function paycheckSummary(paycheck, items, txs, defaultSplit = DEFAULT_SPLIT) {
  const split = paycheck.split || defaultSplit
  const budgets = bucketBudgets(paycheck.net || 0, split)
  const txByItem = groupBy(txs, 'itemId')
  const buckets = {}
  for (const k of BUCKET_KEYS) {
    const bi = items.filter((i) => i.bucket === k)
    const assigned = bi.reduce((s, i) => s + itemPlanned(i), 0)
    const spent = bi.reduce((s, i) => s + itemSpent(i, txByItem[i.id]), 0)
    buckets[k] = {
      key: k,
      pct: split[k],
      budget: budgets[k],
      assigned,
      spent,
      toAssign: budgets[k] - assigned,
      left: budgets[k] - spent,
    }
  }
  const unassigned = BUCKET_KEYS.reduce((s, k) => s + Math.max(0, buckets[k].toAssign), 0)
  return {
    split,
    custom: !!paycheck.split,
    net: paycheck.net || 0,
    buckets,
    unassigned,
    leftover: leftoverAmount(buckets),
  }
}

/**
 * Money that moves to savings at the end of a period:
 * unassigned + planned-but-unspent money in Needs and Wants, minus any overspending
 * there. Never below $0. (Savings & Debt money is already savings.)
 */
export function leftoverAmount(buckets) {
  const budget = buckets.needs.budget + buckets.wants.budget
  const spent = buckets.needs.spent + buckets.wants.spent
  return Math.max(0, budget - spent)
}

/** Combine paycheck summaries into one month. `projectedNet` fills in a missing check. */
export function monthSummary(summaries, { projectedNet = 0, missingChecks = 0, projectedSplit } = {}) {
  const projected = projectedNet * missingChecks
  const net = summaries.reduce((s, x) => s + x.net, 0) + projected
  const buckets = {}
  for (const k of BUCKET_KEYS) {
    const budget = summaries.reduce((s, x) => s + x.buckets[k].budget, 0)
    const spent = summaries.reduce((s, x) => s + x.buckets[k].spent, 0)
    const assigned = summaries.reduce((s, x) => s + x.buckets[k].assigned, 0)
    buckets[k] = { key: k, budget, spent, assigned, left: budget - spent, toAssign: budget - assigned }
  }
  // Projected checks use the default split.
  if (projected > 0) {
    const split = projectedSplit || DEFAULT_SPLIT
    const pb = bucketBudgets(projected, split)
    for (const k of BUCKET_KEYS) {
      buckets[k].budget += pb[k]
      buckets[k].left += pb[k]
      buckets[k].toAssign += pb[k]
    }
  }
  return { net, projected, buckets }
}

// ---------- Recurring prefill ----------

/**
 * Build the line items a new paycheck starts with.
 * - 'every' templates go on every check; 'monthly' ones only on their chosen check.
 * - Fixed amounts copy the template; variable amounts copy the most recent amount
 *   used for that template and are flagged "needs review".
 */
export function prefillItems(paycheck, slot, templates, previousItems = []) {
  const latestByTemplate = {}
  for (const it of previousItems) {
    if (!it.recurringId) continue
    const prev = latestByTemplate[it.recurringId]
    if (!prev || (it.payDate || '') > (prev.payDate || '')) latestByTemplate[it.recurringId] = it
  }
  return templates
    .filter((t) => t.active !== false)
    .filter((t) => t.repeat === 'every' || (t.repeat === 'monthly' && t.check === slot))
    .map((t) => {
      const last = latestByTemplate[t.id]
      const variable = t.amountType === 'variable'
      return {
        paycheckId: paycheck.id,
        recurringId: t.id,
        name: t.name,
        bucket: t.bucket,
        kind: t.kind,
        tag: t.tag,
        sharePct: t.sharePct,
        fullAmount: variable && last ? last.fullAmount : t.fullAmount,
        paid: false,
        paidAmount: null,
        needsReview: variable,
      }
    })
}
