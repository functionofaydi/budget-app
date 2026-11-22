// All money is stored as integer cents to avoid floating-point drift.

/** Parse user input like "$1,240.50" or "12" into cents. Empty → 0, junk → NaN. */
export function toCents(input) {
  if (input === null || input === undefined) return 0
  if (typeof input === 'number') return Math.round(input * 100)
  const cleaned = String(input).replace(/[$,\s]/g, '')
  if (cleaned === '' || cleaned === '.') return 0
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return NaN
  return Math.round(parseFloat(cleaned) * 100)
}

/** Format cents as "$1,240.00" (or "−$5.00" for negatives). */
export function fmt(cents, { signed = false } = {}) {
  const n = Number.isFinite(cents) ? cents : 0
  const abs = Math.abs(n) / 100
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n < 0) return `−$${s}`
  if (signed && n > 0) return `+$${s}`
  return `$${s}`
}

/** Format cents as whole dollars when there are no cents: "$620" or "$23.50". */
export function fmtShort(cents) {
  const n = Number.isFinite(cents) ? cents : 0
  if (n % 100 === 0) {
    const s = Math.abs(n / 100).toLocaleString('en-US')
    return n < 0 ? `−$${s}` : `$${s}`
  }
  return fmt(n)
}

/** Cents → plain editable string, e.g. 124050 → "1240.50". */
export function centsToInput(cents) {
  if (!cents) return ''
  return (cents / 100).toFixed(2)
}
