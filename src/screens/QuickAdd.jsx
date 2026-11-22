import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { db } from '../db/db.js'
import { addTransaction, pickCurrentPaycheck } from '../db/actions.js'
import { itemPlanned, itemSpent, myShare } from '../lib/budget.js'
import { fmtDate } from '../lib/dates.js'
import { fmt } from '../lib/money.js'
import { Backspace, Close } from '../components/Icons.jsx'

export default function QuickAdd() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [itemId, setItemId] = useState(params.get('item'))
  const [showAll, setShowAll] = useState(false)

  const data = useLiveQuery(async () => {
    const paychecks = await db.paychecks.orderBy('payDate').toArray()
    const paycheck = paychecks.find((p) => p.id === params.get('p')) || pickCurrentPaycheck(paychecks)
    if (!paycheck) return { paycheck: null, items: [], txs: [] }
    const items = (await db.items.where('paycheckId').equals(paycheck.id).toArray()).sort((a, b) => a.name.localeCompare(b.name))
    const txs = await db.transactions.where('paycheckId').equals(paycheck.id).toArray()
    return { paycheck, items, txs }
  }, [params.get('p')])

  if (!data) return null
  const { paycheck, items, txs } = data
  const close = () => navigate(-1)

  const spending = items.filter((i) => i.kind !== 'bill')
  const selected = items.find((i) => i.id === itemId) || spending[0] || items[0]
  const selectedId = selected?.id
  const chips = showAll ? items : spending
  if (selected && !chips.includes(selected)) chips.push(selected)

  const cents = Math.round(parseFloat(amount || '0') * 100)
  const press = (k) => {
    setAmount((a) => {
      if (k === 'del') return a.slice(0, -1)
      if (k === '.') return a.includes('.') ? a : (a || '0') + '.'
      if (a.includes('.') && a.split('.')[1].length >= 2) return a
      if (a === '0') return k
      if (a.replace('.', '').length >= 7) return a
      return a + k
    })
  }

  let preview = null
  if (selected) {
    const planned = itemPlanned(selected)
    const spentNow = itemSpent(selected, txs.filter((t) => t.itemId === selected.id))
    const after = selected.kind === 'bill' ? spentNow : spentNow + myShare(selected, cents)
    const left = planned - after
    preview = { planned, after, left }
  }

  const save = async () => {
    if (!selected || cents <= 0) return
    await addTransaction({ itemId: selected.id, paycheckId: paycheck.id, amount: cents, note: note.trim() })
    navigate(-1)
  }

  return (
    <div className="sheet-wrap">
      <div className="sheet" role="dialog" aria-label="Quick add spending">
        <div className="handle" />
        <div className="between">
          <div className="stack" style={{ gap: 0 }}>
            <h1 className="page-title">Quick add</h1>
            {paycheck && <span className="small muted">{fmtDate(paycheck.payDate)} paycheck</span>}
          </div>
          <button type="button" className="icon-btn plain" aria-label="Close" onClick={close} style={{ marginRight: -12 }}><Close /></button>
        </div>

        {!paycheck || items.length === 0 ? (
          <div className="empty">
            <p className="sm muted">{paycheck ? 'This paycheck has no line items yet. Add one like “Groceries” first.' : 'Add a paycheck first.'}</p>
            <Link className="btn btn-primary" to={paycheck ? `/item/new?p=${paycheck.id}&bucket=needs&kind=spending` : '/paycheck/new'} replace>
              {paycheck ? 'Add a line item' : 'Add paycheck'}
            </Link>
          </div>
        ) : (
          <>
            <div className="huge center" aria-live="polite">{fmt(cents)}</div>

            <div className="stack" style={{ gap: 8 }}>
              <span className="label">Line item</span>
              <div className="chips" role="group" aria-label="Line item">
                {chips.map((i) => (
                  <button key={i.id} type="button" className="chip" aria-pressed={i.id === selectedId} onClick={() => setItemId(i.id)}>{i.name}</button>
                ))}
                {!showAll && items.length > spending.length && (
                  <button type="button" className="chip" aria-pressed="false" onClick={() => setShowAll(true)}>More…</button>
                )}
              </div>
            </div>

            <div className="field">
              <label htmlFor="q-note">Note (optional)</label>
              <input id="q-note" className="input" placeholder="e.g. store name" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {preview && (
              <div className="tile between">
                <span className="small muted">{selected.name} after this</span>
                <span className="sm muted">
                  <span className={preview.left < 0 ? 'danger strong' : 'strong'} style={preview.left < 0 ? { color: 'var(--danger)' } : undefined}>{fmt(preview.after)}</span>
                  {' '}/ {fmt(preview.planned)} · {preview.left < 0 ? <span className="danger">over {fmt(-preview.left)}</span> : `${fmt(preview.left)} left`}
                </span>
              </div>
            )}
            {selected?.tag === 'shared' && cents > 0 && (
              <p className="small muted center">Shared: {fmt(myShare(selected, cents))} ({selected.sharePct}%) counts toward your budget.</p>
            )}

            <div className="keypad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((k) => (
                <button key={k} type="button" onClick={() => press(k)}>{k}</button>
              ))}
              <button type="button" aria-label="Delete digit" onClick={() => press('del')} style={{ color: 'var(--muted)' }}><Backspace /></button>
            </div>

            <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!selected || cents <= 0} onClick={save}>
              Add {fmt(cents)}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
