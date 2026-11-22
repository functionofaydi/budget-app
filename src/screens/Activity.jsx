import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db.js'
import { deleteTransaction } from '../db/actions.js'
import { groupBy, myShare } from '../lib/budget.js'
import { fmtDateYear } from '../lib/dates.js'
import { fmt } from '../lib/money.js'
import { BottomNav, BucketDot, Fab, TagPill } from '../components/ui.jsx'
import { Trash } from '../components/Icons.jsx'

export default function Activity() {
  const data = useLiveQuery(async () => {
    const txs = await db.transactions.orderBy('date').reverse().limit(200).toArray()
    const items = await db.items.bulkGet([...new Set(txs.map((t) => t.itemId))])
    const byId = Object.fromEntries(items.filter(Boolean).map((i) => [i.id, i]))
    return txs.filter((t) => byId[t.itemId]).map((t) => ({ ...t, item: byId[t.itemId] }))
  }, [])
  if (!data) return null
  const days = groupBy(data, 'date')
  const dates = Object.keys(days).sort().reverse()

  return (
    <>
      <div className="screen">
        <h1 className="title">Activity</h1>
        {data.length === 0 ? (
          <div className="card-lg empty">
            <p className="h2">No purchases yet</p>
            <p className="sm muted">Purchases you log with the + button show up here, newest first.</p>
          </div>
        ) : (
          dates.map((d) => (
            <div key={d} className="stack">
              <h2 className="section">{fmtDateYear(d)}</h2>
              <div className="list">
                {days[d].sort((a, b) => b.createdAt - a.createdAt).map((t) => (
                  <div key={t.id} className="list-row">
                    <BucketDot bucket={t.item.bucket} />
                    <Link to={`/item/${t.item.id}`} className="grow stack link-row" style={{ gap: 2 }}>
                      <span className="row" style={{ gap: 6 }}><span style={{ fontWeight: 500 }}>{t.item.name}</span>{t.item.tag !== 'mine' && <TagPill tag={t.item.tag} />}</span>
                      {(t.note || t.item.tag === 'shared') && (
                        <span className="small muted truncate">
                          {[t.note, t.item.tag === 'shared' ? `your share ${fmt(myShare(t.item, t.amount))}` : null].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </Link>
                    <span className="h2">{fmt(t.amount)}</span>
                    <button type="button" className="icon-btn plain sm" aria-label={`Delete ${t.item.name} purchase`}
                      onClick={() => confirm('Delete this purchase?') && deleteTransaction(t.id)}><Trash size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <Fab to="/add" />
      <BottomNav />
    </>
  )
}
