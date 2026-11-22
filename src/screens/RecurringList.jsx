import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db.js'
import { BUCKETS, itemPlanned } from '../lib/budget.js'
import { fmtShort } from '../lib/money.js'
import { BackHeader, TagPill } from '../components/ui.jsx'
import { Plus } from '../components/Icons.jsx'

export const repeatText = (t) =>
  `${t.repeat === 'every' ? 'Every paycheck' : `Monthly · ${t.check === 'first' ? '5th' : '20th'} check`}${t.amountType === 'variable' ? ' · varies' : ''}`

export default function RecurringList() {
  const list = useLiveQuery(() => db.recurring.toArray(), [])
  if (!list) return null
  return (
    <div className="screen no-nav">
      <BackHeader title="Recurring items" right={<Link to="/settings/recurring/new" className="btn btn-primary btn-sm"><Plus size={16} />Add</Link>} />
      <p className="sm muted">These are copied onto each new paycheck automatically. Editing one here changes future paychecks, not ones you already have.</p>
      {list.length === 0 && <div className="card empty"><p className="sm muted">No recurring items yet. Add rent, phone, subscriptions, groceries…</p></div>}
      {BUCKETS.map((b) => {
        const rows = list.filter((t) => t.bucket === b.key).sort((a, c) => a.name.localeCompare(c.name))
        if (!rows.length) return null
        return (
          <div key={b.key} className="stack">
            <h2 className="section row" style={{ gap: 8 }}><span className="dot" style={{ background: b.color }} />{b.label}</h2>
            <div className="list">
              {rows.map((t) => (
                <Link key={t.id} to={`/settings/recurring/${t.id}`} className="list-row link-row" style={{ opacity: t.active === false ? 0.5 : 1 }}>
                  <div className="grow stack" style={{ gap: 3 }}>
                    <span className="row" style={{ gap: 6 }}><span style={{ fontWeight: 500 }}>{t.name}</span><TagPill tag={t.tag} />{t.active === false && <span className="pill">Paused</span>}</span>
                    <span className="small muted">{t.kind === 'bill' ? 'Bill' : 'Spending'} · {repeatText(t)}</span>
                  </div>
                  <span className="h2">{fmtShort(itemPlanned(t))}</span>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
