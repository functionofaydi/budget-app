// Dates are stored as local "YYYY-MM-DD" strings.
// Pay schedule: semi-monthly, paid on the 5th (for the 16th–end of last month)
// and the 20th (for the 1st–15th of the same month).

export const PAY_DAYS = [5, 20]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const pad = (n) => String(n).padStart(2, '0')

export function iso(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`
}

export function parse(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return { y, m, d }
}

export function todayISO(now = new Date()) {
  return iso(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate()
}

/** 'first' for the early-month check (pay day ≤ 15), 'second' otherwise. */
export function checkSlot(payDate) {
  return parse(payDate).d <= 15 ? 'first' : 'second'
}

/** Suggested pay period for a pay date. */
export function suggestPeriod(payDate) {
  const { y, m, d } = parse(payDate)
  if (d <= 15) {
    const py = m === 1 ? y - 1 : y
    const pm = m === 1 ? 12 : m - 1
    return { start: iso(py, pm, 16), end: iso(py, pm, daysInMonth(py, pm)) }
  }
  return { start: iso(y, m, 1), end: iso(y, m, 15) }
}

/** Next scheduled pay date on or after the given date. */
export function nextPayDate(fromDate) {
  let { y, m, d } = parse(fromDate)
  for (let i = 0; i < 3; i++) {
    for (const pd of PAY_DAYS) {
      if (pd >= d) return iso(y, m, pd)
    }
    d = 1
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return fromDate
}

/** Most recent scheduled pay date on or before the given date. */
export function prevPayDate(fromDate) {
  let { y, m, d } = parse(fromDate)
  for (let i = 0; i < 3; i++) {
    for (const pd of [...PAY_DAYS].reverse()) {
      if (pd <= d) return iso(y, m, pd)
    }
    m -= 1
    if (m < 1) { m = 12; y -= 1 }
    d = 31
  }
  return fromDate
}

export function addDays(isoDate, n) {
  const { y, m, d } = parse(isoDate)
  const dt = new Date(y, m - 1, d + n)
  return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

export function monthKey(isoDate) {
  return isoDate.slice(0, 7)
}

export function shiftMonth(key, delta) {
  let [y, m] = key.split('-').map(Number)
  m += delta
  while (m > 12) { m -= 12; y += 1 }
  while (m < 1) { m += 12; y -= 1 }
  return `${y}-${pad(m)}`
}

export function fmtDate(isoDate) {
  if (!isoDate) return ''
  const { m, d } = parse(isoDate)
  return `${MONTHS[m - 1]} ${d}`
}

export function fmtDateYear(isoDate) {
  if (!isoDate) return ''
  const { y, m, d } = parse(isoDate)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

export function fmtRange(start, end) {
  if (!start || !end) return ''
  const a = parse(start)
  const b = parse(end)
  if (a.m === b.m && a.y === b.y) return `${MONTHS[a.m - 1]} ${a.d}–${b.d}`
  return `${fmtDate(start)} – ${fmtDate(end)}`
}

export function fmtMonth(key) {
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS_LONG[m - 1]} ${y}`
}
