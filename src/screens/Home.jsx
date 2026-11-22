import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router-dom'
import { db } from '../db/db.js'
import { pickCurrentPaycheck, setPaycheckClosed } from '../db/actions.js'
import { usePaycheckData, usePaychecks, useSettings } from '../hooks.js'
import { BUCKETS, monthSummary, paycheckSummary, splitLabel, sumAmounts } from '../lib/budget.js'
import { checkSlot, fmtDate, fmtMonth, fmtRange, monthKey, shiftMonth, todayISO } from '../lib/dates.js'
import { fmt, fmtShort } from '../lib/money.js'
import { BottomNav, BucketDot, Fab, ProgressBar } from '../components/ui.jsx'
import { ChevronLeft, ChevronRight, Gear, Info, Plus } from '../components/Icons.jsx'

export default function Home() {
  const settings = useSettings()
  const paychecks = usePaychecks()
  const [params, setParams] = useSearchParams()
  if (!settings || !paychecks) return null

  const view = params.get('view') || settings.defaultView
  const current = pickCurrentPaycheck(paychecks)
  const setView = (v) => {
    const next = new URLSearchParams(params)
    next.set('view', v)
    setParams(next, { replace: true })
  }

  return (
    <>
      <div className="screen">
        <div className="between">
          <h1 className="title">Budget</h1>
          <Link to="/settings" className="icon-btn" aria-label="Settings"><Gear /></Link>
        </div>

        <div className="seg" role="group" aria-label="View">
          <button type="button" aria-pressed={view === 'paycheck'} onClick={() => setView('paycheck')}>By Paycheck</button>
          <button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>By Month</button>
        </div>

        {paychecks.length === 0 ? (
          <EmptyState />
        ) : view === 'month' ? (
          <MonthView settings={settings} paychecks={paychecks} current={current} params={params} setParams={setParams} />
        ) : (
          <PaycheckView settings={settings} paychecks={paychecks} current={current} params={params} setParams={setParams} />
        )}
      </div>
      {paychecks.length > 0 && <Fab to={`/add${current ? `?p=${params.get('p') || current.id}` : ''}`} />}
      <BottomNav />
    </>
  )
}

function EmptyState() {
  return (
    <div className="card-lg empty">
      <p className="h2">No paychecks yet</p>
      <p className="sm muted">Add your first paycheck and the app will split it 50/30/20 and fill in your recurring bills.</p>
      <Link to="/paycheck/new" className="btn btn-primary"><Plus size={18} />Add paycheck</Link>
    </div>
  )
}

// ---------------- By Paycheck ----------------

function PaycheckView({ settings, paychecks, current, params, setParams }) {
  const selectedId = paychecks.some((p) => p.id === params.get('p')) ? params.get('p') : current?.id
  const data = usePaycheckData(selectedId, settings.defaultSplit)
  const idx = paychecks.findIndex((p) => p.id === selectedId)
  const go = (delta) => {
    const p = paychecks[idx + delta]
    if (!p) return
    const next = new URLSearchParams(params)
    next.set('p', p.id)
    setParams(next, { replace: true })
  }
  if (!data) return null
  const { paycheck, items, summary } = data
  const review = items.filter((i) => i.needsReview).length

  return (
    <>
      <div className="card-lg stack-lg">
        <div className="between">
          <button type="button" className="icon-btn plain sm" aria-label="Previous paycheck" onClick={() => go(-1)} disabled={idx <= 0}><ChevronLeft size={18} /></button>
          <Link to={`/paycheck/${paycheck.id}/edit`} className="center" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="sm strong">{fmtDate(paycheck.payDate)} paycheck</div>
            <div className="small muted" style={{ marginTop: 2 }}>{paycheck.periodStart ? `Pay period ${fmtRange(paycheck.periodStart, paycheck.periodEnd)}` : 'Tap to edit'}</div>
          </Link>
          <button type="button" className="icon-btn plain sm" aria-label="Next paycheck" onClick={() => go(1)} disabled={idx >= paychecks.length - 1}><ChevronRight /></button>
        </div>
        <div className="center">
          <div className="eyebrow">Net pay</div>
          <div className="big" style={{ marginTop: 4 }}>{fmt(paycheck.net)}</div>
        </div>
        <div className="grid-3 divider-top center">
          <div><div className="small muted" style={{ fontSize: 11 }}>Gross</div><div className="sm strong" style={{ fontSize: 14 }}>{fmt(paycheck.gross)}</div></div>
          <div><div className="small muted" style={{ fontSize: 11 }}>Taxes</div><div className="sm strong" style={{ fontSize: 14 }}>{fmt(-sumAmounts(paycheck.taxes))}</div></div>
          <div><div className="small muted" style={{ fontSize: 11 }}>Deductions</div><div className="sm strong" style={{ fontSize: 14 }}>{fmt(-sumAmounts(paycheck.deductions))}</div></div>
        </div>
        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={`/split/${paycheck.id}`} className="badge-link">Split {splitLabel(summary.split)} · {summary.custom ? 'Custom' : 'Default'}</Link>
          {paycheck.closed && <span className="badge-link good" style={{ color: 'var(--savings)' }}>Closed · {fmt(summary.leftover)} to savings</span>}
        </div>
      </div>

      <div className="stack">
        <div className="between baseline">
          <h2 className="h2">Buckets</h2>
          {summary.unassigned > 0 && !paycheck.closed && (
            <span className="small warn">{fmt(summary.unassigned)} unassigned → savings at period end</span>
          )}
        </div>
        {BUCKETS.map((b) => (
          <BucketCard key={b.key} b={b} s={summary.buckets[b.key]} to={`/bucket/${b.key}?p=${paycheck.id}`} />
        ))}
      </div>

      {review > 0 && (
        <Link to={`/bucket/needs?p=${paycheck.id}`} className="notice" style={{ textDecoration: 'none' }}>
          <span className="warn"><Info /></span>
          <span>{review} {review === 1 ? 'item needs' : 'items need'} review: amounts were copied from last time. Check them in each bucket.</span>
        </Link>
      )}

      <ClosePeriod paycheck={paycheck} leftover={summary.leftover} isLatest={idx === paychecks.length - 1} />
    </>
  )
}

function BucketCard({ b, s, to }) {
  const over = s.spent > s.budget
  const isSavings = b.key === 'savings'
  return (
    <Link to={to} className="card stack pressable" style={{ gap: 10 }}>
      <div className="between">
        <div className="row"><BucketDot bucket={b.key} /><span className="h2">{b.label}</span><span className="small muted">{s.pct}%</span></div>
        <span className="h2">{fmt(s.budget)}</span>
      </div>
      <ProgressBar planned={s.budget} spent={s.spent} bucket={b.key} />
      <div className="between small muted">
        <span>{isSavings ? 'Moved' : 'Spent'} {fmt(s.spent)}</span>
        {over ? (
          <span className="danger">Over by {fmt(s.spent - s.budget)}</span>
        ) : isSavings && s.spent >= s.budget && s.budget > 0 ? (
          <span className="good">Fully funded</span>
        ) : (
          <span>{fmt(s.left)} left</span>
        )}
      </div>
    </Link>
  )
}

function ClosePeriod({ paycheck, leftover, isLatest }) {
  if (paycheck.closed) {
    return (
      <button type="button" className="btn btn-dashed btn-block" onClick={() => setPaycheckClosed(paycheck.id, false)}>
        Reopen this period
      </button>
    )
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <button
        type="button"
        className="btn btn-dashed btn-block"
        onClick={() => {
          if (window.confirm(`Close this period? ${fmt(leftover)} of leftover Needs and Wants money moves to savings.`)) {
            setPaycheckClosed(paycheck.id, true)
          }
        }}
      >
        Close period · {fmt(leftover)} to savings
      </button>
      {isLatest && <p className="small muted center">Periods also close on their own when you add the next paycheck.</p>}
    </div>
  )
}

// ---------------- By Month ----------------

function MonthView({ settings, paychecks, current, params, setParams }) {
  const key = params.get('m') || monthKey(current?.payDate || todayISO())
  const setKey = (k) => {
    const next = new URLSearchParams(params)
    next.set('m', k)
    setParams(next, { replace: true })
  }
  const data = useLiveQuery(async () => {
    const inMonth = paychecks.filter((p) => monthKey(p.payDate) === key)
    const summaries = []
    for (const p of inMonth) {
      const items = await db.items.where('paycheckId').equals(p.id).toArray()
      const txs = await db.transactions.where('paycheckId').equals(p.id).toArray()
      summaries.push({ paycheck: p, s: paycheckSummary(p, items, txs, settings.defaultSplit) })
    }
    return summaries
  }, [key, paychecks, JSON.stringify(settings.defaultSplit)])
  if (!data) return null

  const bySlot = { first: data.find((d) => checkSlot(d.paycheck.payDate) === 'first'), second: data.find((d) => checkSlot(d.paycheck.payDate) === 'second') }
  const missing = (bySlot.first ? 0 : 1) + (bySlot.second ? 0 : 1)
  // "Usual" net pay = most recent paycheck's net.
  const usual = paychecks.length ? paychecks[paychecks.length - 1].net : 0
  const month = monthSummary(data.map((d) => ({ ...d.s })), { projectedNet: usual, missingChecks: missing, projectedSplit: settings.defaultSplit })
  const [y, m] = key.split('-')

  return (
    <>
      <div className="card-lg stack-lg">
        <div className="between">
          <button type="button" className="icon-btn plain sm" aria-label="Previous month" onClick={() => setKey(shiftMonth(key, -1))}><ChevronLeft size={18} /></button>
          <div className="h2">{fmtMonth(key)}</div>
          <button type="button" className="icon-btn plain sm" aria-label="Next month" onClick={() => setKey(shiftMonth(key, 1))}><ChevronRight /></button>
        </div>
        <div className="center">
          <div className="eyebrow">Monthly net</div>
          <div className="big" style={{ marginTop: 4 }}>{fmt(month.net)}</div>
        </div>
        <div className="grid-2">
          {[['first', 5], ['second', 20]].map(([slot, day]) => {
            const d = bySlot[slot]
            const label = fmtDate(`${y}-${m}-${String(day).padStart(2, '0')}`)
            return d ? (
              <Link key={slot} to={`/?view=paycheck&p=${d.paycheck.id}`} className="tile" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="between"><span className="small muted">{fmtDate(d.paycheck.payDate)}</span><span className="good" style={{ fontSize: 11 }}>Received</span></div>
                <div className="h2" style={{ marginTop: 4, fontSize: 16 }}>{fmt(d.paycheck.net)}</div>
              </Link>
            ) : (
              <div key={slot} className="tile tile-dashed">
                <div className="between"><span className="small muted">{label}</span><span className="warn" style={{ fontSize: 11 }}>Projected</span></div>
                <div className="h2 muted" style={{ marginTop: 4, fontSize: 16 }}>~{fmt(usual)}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="stack">
        <div className="between baseline">
          <h2 className="h2">This month</h2>
          <span className="small muted">{data.length === 0 ? 'No checks entered yet' : `${data.length} of 2 checks entered`}</span>
        </div>
        <div className="list">
          {BUCKETS.map((b) => {
            const s = month.buckets[b.key]
            return (
              <Link key={b.key} to={`/bucket/${b.key}?m=${key}`} className="stack link-row" style={{ gap: 8, padding: '12px 0' }}>
                <div className="between">
                  <div className="row"><BucketDot bucket={b.key} /><span className="h2">{b.label}</span></div>
                  <span className="sm muted"><span className="strong">{fmtShort(s.spent)}</span> / {fmtShort(s.budget)}</span>
                </div>
                <ProgressBar planned={s.budget} spent={s.spent} bucket={b.key} />
              </Link>
            )
          })}
        </div>
        {missing > 0 && (
          <div className="notice">
            <Info />
            <span>Missing checks use your usual net pay ({fmt(usual)}) and your default split until you enter the real check.</span>
          </div>
        )}
      </div>
    </>
  )
}
