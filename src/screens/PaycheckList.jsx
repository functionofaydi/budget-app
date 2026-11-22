import { Link } from 'react-router-dom'
import { usePaychecks, useSettings } from '../hooks.js'
import { splitLabel } from '../lib/budget.js'
import { fmtDateYear, fmtRange } from '../lib/dates.js'
import { fmt } from '../lib/money.js'
import { BottomNav } from '../components/ui.jsx'
import { ChevronRight, Plus } from '../components/Icons.jsx'

export default function PaycheckList() {
  const paychecks = usePaychecks()
  const settings = useSettings()
  if (!paychecks || !settings) return null
  const list = [...paychecks].reverse()
  const ytd = paychecks.filter((p) => p.payDate.startsWith(String(new Date().getFullYear()))).reduce((s, p) => s + (p.net || 0), 0)

  return (
    <>
      <div className="screen">
        <div className="between">
          <h1 className="title">Paychecks</h1>
          <Link to="/paycheck/new" className="btn btn-primary btn-sm"><Plus size={16} />New</Link>
        </div>

        {list.length > 0 && (
          <div className="card between">
            <span className="sm muted">Net pay this year</span>
            <span className="h2">{fmt(ytd)}</span>
          </div>
        )}

        {list.length === 0 ? (
          <div className="card-lg empty">
            <p className="h2">No paychecks yet</p>
            <Link to="/paycheck/new" className="btn btn-primary"><Plus size={18} />Add paycheck</Link>
          </div>
        ) : (
          <div className="list">
            {list.map((p) => (
              <Link key={p.id} to={`/?view=paycheck&p=${p.id}`} className="list-row link-row">
                <div className="grow stack" style={{ gap: 3 }}>
                  <span className="row" style={{ gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 500 }}>{fmtDateYear(p.payDate)}</span>
                    {p.closed ? <span className="pill">Closed</span> : <span className="pill shared">Open</span>}
                  </span>
                  <span className="small muted">
                    {p.periodStart ? `${fmtRange(p.periodStart, p.periodEnd)} · ` : ''}Split {splitLabel(p.split || settings.defaultSplit)}
                  </span>
                </div>
                <span className="h2">{fmt(p.net)}</span>
                <span className="muted"><ChevronRight size={16} /></span>
              </Link>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </>
  )
}
