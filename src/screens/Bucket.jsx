import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../db/db.js'
import { setItemPaid } from '../db/actions.js'
import { useSettings } from '../hooks.js'
import { bucketInfo, groupBy, itemPlanned, itemSpent, monthSummary, paycheckSummary } from '../lib/budget.js'
import { fmtDate, fmtMonth, monthKey } from '../lib/dates.js'
import { fmt, fmtShort } from '../lib/money.js'
import { BackHeader, ProgressBar, TagPill } from '../components/ui.jsx'
import { Plus, Repeat } from '../components/Icons.jsx'

export default function Bucket() {
  const { bucket } = useParams()
  const [params] = useSearchParams()
  const settings = useSettings()
  const pid = params.get('p')
  const mkey = params.get('m')
  const info = bucketInfo(bucket)

  const data = useLiveQuery(async () => {
    if (!settings) return null
    let paychecks = []
    if (pid) {
      const p = await db.paychecks.get(pid)
      paychecks = p ? [p] : []
    } else if (mkey) {
      paychecks = (await db.paychecks.toArray()).filter((p) => monthKey(p.payDate) === mkey).sort((a, b) => a.payDate.localeCompare(b.payDate))
    }
    const all = []
    const summaries = []
    let txsAll = []
    for (const p of paychecks) {
      const items = await db.items.where('paycheckId').equals(p.id).toArray()
      const txs = await db.transactions.where('paycheckId').equals(p.id).toArray()
      summaries.push(paycheckSummary(p, items, txs, settings.defaultSplit))
      all.push(...items.filter((i) => i.bucket === bucket).map((i) => ({ ...i, payDate: p.payDate })))
      txsAll = txsAll.concat(txs)
    }
    return { paychecks, items: all, txs: txsAll, summaries }
  }, [pid, mkey, bucket, settings && JSON.stringify(settings.defaultSplit)])

  if (!info || !data) return null
  const { paychecks, items, txs, summaries } = data
  const isMonth = !pid
  const s = isMonth ? monthSummary(summaries).buckets[bucket] : summaries[0]?.buckets[bucket]
  if (!s) return <div className="screen"><BackHeader title={info.label} to="/" /><p className="muted">Paycheck not found.</p></div>

  const txByItem = groupBy(txs, 'itemId')
  const bills = items.filter((i) => i.kind === 'bill').sort(byName)
  const spending = items.filter((i) => i.kind !== 'bill').sort(byName)
  const subtitle = isMonth ? `${fmtMonth(mkey)} · ${paychecks.length} check${paychecks.length === 1 ? '' : 's'}` : `${fmtDate(paychecks[0].payDate)} paycheck · ${s.pct}%`
  const addTo = isMonth ? paychecks[paychecks.length - 1] : paychecks[0]
  const back = isMonth ? `/?view=month&m=${mkey}` : `/?view=paycheck&p=${pid}`

  return (
    <div className="screen no-nav">
      <BackHeader title={info.label} subtitle={subtitle} to={back} dotColor={info.color} />

      <div className="card-lg stack" style={{ gap: 12, padding: 16 }}>
        <div className="grid-3">
          <Stat label="Budget" value={fmtShort(s.budget)} />
          <Stat label={bucket === 'savings' ? 'Moved' : 'Spent'} value={fmtShort(s.spent)} />
          <Stat label="To assign" value={fmtShort(s.toAssign)} className={s.toAssign < 0 ? 'danger' : s.toAssign > 0 ? 'warn' : ''} />
        </div>
        <ProgressBar planned={s.budget} spent={s.spent} bucket={bucket} />
        {s.toAssign < 0 && <span className="small danger">Assigned {fmt(-s.toAssign)} more than this bucket has.</span>}
      </div>

      {items.length === 0 && (
        <div className="card empty"><p className="sm muted">Nothing in {info.label} yet. Add bills (rent, phone) or spending lines (groceries, gas).</p></div>
      )}

      {bills.length > 0 && (
        <div className="stack">
          <h2 className="section">Bills</h2>
          <div className="list">
            {bills.map((i) => <BillRow key={i.id} item={i} showCheck={isMonth} />)}
          </div>
        </div>
      )}

      {spending.length > 0 && (
        <div className="stack">
          <h2 className="section">Spending</h2>
          <div className="list">
            {spending.map((i) => <SpendRow key={i.id} item={i} txs={txByItem[i.id] || []} showCheck={isMonth} />)}
          </div>
        </div>
      )}

      {addTo && (
        <Link to={`/item/new?p=${addTo.id}&bucket=${bucket}`} className="btn btn-dashed btn-block" style={{ height: 48, borderRadius: 14 }}>
          <Plus size={16} width={2} />Add line item{isMonth ? ` to ${fmtDate(addTo.payDate)} check` : ''}
        </Link>
      )}
    </div>
  )
}

const byName = (a, b) => a.name.localeCompare(b.name)

function Stat({ label, value, className = '' }) {
  return (
    <div>
      <div className="small muted" style={{ fontSize: 11 }}>{label}</div>
      <div className={`h2 ${className}`} style={{ fontSize: 16, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function ItemTitle({ item }) {
  return (
    <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 15, fontWeight: 500 }}>{item.name}</span>
      <TagPill tag={item.tag} />
      {item.recurringId && <span className="muted" title="Repeats" style={{ display: 'inline-flex' }}><Repeat /></span>}
    </span>
  )
}

function BillRow({ item, showCheck }) {
  const planned = itemPlanned(item)
  const sub = []
  if (showCheck) sub.push(`${fmtDate(item.payDate)} check`)
  if (item.tag === 'shared') sub.push(`Your share ${item.sharePct}% of ${fmtShort(item.fullAmount)}`)
  if (item.paid) sub.push(item.paidAmount != null && item.paidAmount !== item.fullAmount ? `Paid ${fmt(item.paidAmount)}` : 'Paid')
  return (
    <div className="list-row">
      <input type="checkbox" checked={!!item.paid} onChange={(e) => setItemPaid(item.id, e.target.checked)} aria-label={`Mark ${item.name} paid`} />
      <Link to={`/item/${item.id}`} className="grow stack link-row" style={{ gap: 4 }}>
        <ItemTitle item={item} />
        {item.needsReview && !item.paid ? (
          <span className="small warn">Needs review · last period's amount</span>
        ) : (
          sub.length > 0 && <span className="small muted">{sub.join(' · ')}</span>
        )}
      </Link>
      <span className="h2" style={{ opacity: item.paid ? 0.6 : 1 }}>{fmtShort(planned)}</span>
    </div>
  )
}

function SpendRow({ item, txs, showCheck }) {
  const planned = itemPlanned(item)
  const spent = itemSpent(item, txs)
  const over = spent > planned
  const sub = [over ? null : `${fmt(planned - spent)} left`, `${txs.length} purchase${txs.length === 1 ? '' : 's'}`]
  if (showCheck) sub.unshift(`${fmtDate(item.payDate)} check`)
  return (
    <Link to={`/item/${item.id}`} className="stack link-row" style={{ gap: 8, padding: '12px 0' }}>
      <div className="between baseline">
        <ItemTitle item={item} />
        <span className="sm muted"><span className={`strong ${over ? 'danger' : ''}`} style={over ? { color: 'var(--danger)' } : undefined}>{fmtShort(spent)}</span> / {fmtShort(planned)}</span>
      </div>
      <ProgressBar planned={planned} spent={spent} bucket={item.bucket} />
      {item.needsReview && <span className="small warn">Needs review · last period's amount</span>}
      {over ? (
        <span className="small danger">Over by {fmt(spent - planned)} · shows in period summary</span>
      ) : (
        <span className="small muted">{sub.filter(Boolean).join(' · ')}</span>
      )}
    </Link>
  )
}
