import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../db/db.js'
import { deleteItem, deleteTransaction, makeItemRecurring, saveItem, saveItemGoingForward } from '../db/actions.js'
import { useSettings } from '../hooks.js'
import { BUCKETS, TAGS, myShare } from '../lib/budget.js'
import { checkSlot, fmtDate } from '../lib/dates.js'
import { fmt } from '../lib/money.js'
import { FormHeader, MoneyInput } from '../components/ui.jsx'
import { Repeat, Trash } from '../components/Icons.jsx'

export default function ItemForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const [form, setForm] = useState(null)
  const [paycheck, setPaycheck] = useState(null)
  const [repeat, setRepeat] = useState({ repeat: 'none', check: 'first', amountType: 'fixed' })

  useEffect(() => {
    if (form || !settings) return
    ;(async () => {
      if (id) {
        const it = await db.items.get(id)
        if (!it) return navigate(-1)
        setForm({ ...it, paidAmount: it.paidAmount ?? null })
        setPaycheck(await db.paychecks.get(it.paycheckId))
      } else {
        const p = await db.paychecks.get(params.get('p'))
        if (!p) return navigate(-1)
        setPaycheck(p)
        setForm({
          paycheckId: p.id, recurringId: null, name: '', bucket: params.get('bucket') || 'needs',
          kind: params.get('kind') || 'bill', tag: 'mine', sharePct: settings.defaultSharePct, fullAmount: 0,
          paid: false, paidAmount: null, needsReview: false,
        })
        setRepeat((r) => ({ ...r, check: checkSlot(p.payDate) }))
      }
    })()
  }, [id, settings, form, params, navigate])

  const template = useLiveQuery(() => (form?.recurringId ? db.recurring.get(form.recurringId) : null), [form?.recurringId])
  const txs = useLiveQuery(() => (id ? db.transactions.where('itemId').equals(id).reverse().sortBy('date') : []), [id])

  if (!form || !paycheck) return null
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const valid = form.name.trim() && form.fullAmount >= 0

  const clean = () => ({ ...form, name: form.name.trim(), needsReview: false })

  const saveThis = async () => {
    if (!valid) return alert('Give it a name.')
    let saved = await saveItem(clean())
    if (!form.recurringId && repeat.repeat !== 'none') {
      saved = await makeItemRecurring(saved, { repeat: repeat.repeat, check: repeat.check, amountType: repeat.amountType })
    }
    navigate(-1)
  }
  const saveForward = async () => {
    if (!valid) return alert('Give it a name.')
    await saveItemGoingForward(clean())
    navigate(-1)
  }
  const remove = async () => {
    if (!confirm(`Delete “${form.name}”${txs?.length ? ` and its ${txs.length} purchase${txs.length === 1 ? '' : 's'}` : ''}? Future checks still get it if it repeats.`)) return
    await deleteItem(id)
    navigate(-1)
  }

  return (
    <div className="screen no-nav">
      <FormHeader title={id ? 'Edit line item' : 'New line item'} onCancel={() => navigate(-1)} onSave={saveThis} saveDisabled={!valid} />
      <p className="small muted" style={{ marginTop: -8 }}>{fmtDate(paycheck.payDate)} paycheck</p>

      <div className="field">
        <label htmlFor="i-name">Name</label>
        <input id="i-name" className="input" placeholder="e.g. Rent, Groceries" value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </div>

      <div className="field">
        <span className="label">Type</span>
        <div className="seg" role="group" aria-label="Type">
          <button type="button" aria-pressed={form.kind === 'bill'} onClick={() => set({ kind: 'bill' })}>Bill (check off)</button>
          <button type="button" aria-pressed={form.kind === 'spending'} onClick={() => set({ kind: 'spending' })}>Spending (track buys)</button>
        </div>
      </div>

      <div className="field">
        <span className="label">Bucket</span>
        <div className="seg" role="group" aria-label="Bucket">
          {BUCKETS.map((b) => (
            <button key={b.key} type="button" aria-pressed={form.bucket === b.key} onClick={() => set({ bucket: b.key })}>
              {b.key === 'savings' ? 'Savings' : b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="list">
        <div className="money-row">
          <label htmlFor="i-amt" className="h2" style={{ fontWeight: 500 }}>{form.tag === 'shared' ? 'Full amount' : 'Planned amount'}</label>
          <MoneyInput id="i-amt" value={form.fullAmount} onChange={(fullAmount) => set({ fullAmount })} />
        </div>
      </div>

      <div className="field">
        <span className="label">Tag</span>
        <div className="chips" role="group" aria-label="Tag">
          {TAGS.map((t) => (
            <button key={t.key} type="button" className="chip" aria-pressed={form.tag === t.key} onClick={() => set({ tag: t.key })}>{t.label}</button>
          ))}
        </div>
      </div>

      {form.tag === 'shared' && (
        <div className="list">
          <div className="money-row">
            <label htmlFor="i-share" className="sm">My share</label>
            <div className="row" style={{ gap: 6 }}>
              <input id="i-share" className="input sm money" style={{ width: 80 }} inputMode="numeric" value={form.sharePct}
                onChange={(e) => set({ sharePct: Math.max(0, Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0)) })} />
              <span className="muted">%</span>
            </div>
          </div>
          <div className="money-row small muted"><span>Counts toward your budget</span><span className="strong">{fmt(myShare(form, form.fullAmount))}</span></div>
        </div>
      )}

      {form.kind === 'bill' && id && (
        <div className="list">
          <label className="list-row" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.paid} onChange={(e) => set({ paid: e.target.checked })} />
            <span className="grow">Paid</span>
          </label>
          {form.paid && (
            <div className="money-row">
              <label htmlFor="i-paid" className="sm">Actual amount (if different)</label>
              <MoneyInput id="i-paid" className="sm" style={{ width: 120 }} value={form.paidAmount ?? 0}
                onChange={(v) => set({ paidAmount: v ? v : null })} placeholder={fmt(form.fullAmount)} />
            </div>
          )}
        </div>
      )}

      {form.recurringId ? (
        <div className="notice">
          <Repeat size={16} />
          <span>
            Repeats {template ? (template.repeat === 'every' ? 'every paycheck' : `monthly on the ${template.check === 'first' ? '5th' : '20th'} check`) : ''}
            {template?.amountType === 'variable' ? ' · variable amount' : ''}. <Link to={`/settings/recurring/${form.recurringId}`}>Edit repeat</Link>
          </span>
        </div>
      ) : (
        <div className="stack">
          <span className="label">Repeats</span>
          <select className="input" aria-label="Repeats" value={repeat.repeat} onChange={(e) => setRepeat((r) => ({ ...r, repeat: e.target.value }))}>
            <option value="none">One time only</option>
            <option value="every">Every paycheck</option>
            <option value="monthly">Once a month</option>
          </select>
          {repeat.repeat === 'monthly' && (
            <div className="seg" role="group" aria-label="Which check">
              <button type="button" aria-pressed={repeat.check === 'first'} onClick={() => setRepeat((r) => ({ ...r, check: 'first' }))}>5th check</button>
              <button type="button" aria-pressed={repeat.check === 'second'} onClick={() => setRepeat((r) => ({ ...r, check: 'second' }))}>20th check</button>
            </div>
          )}
          {repeat.repeat !== 'none' && (
            <div className="seg" role="group" aria-label="Amount type">
              <button type="button" aria-pressed={repeat.amountType === 'fixed'} onClick={() => setRepeat((r) => ({ ...r, amountType: 'fixed' }))}>Fixed amount</button>
              <button type="button" aria-pressed={repeat.amountType === 'variable'} onClick={() => setRepeat((r) => ({ ...r, amountType: 'variable' }))}>Varies</button>
            </div>
          )}
        </div>
      )}

      {form.recurringId && (
        <div className="stack">
          <button type="button" className="btn btn-primary btn-block" onClick={saveThis} disabled={!valid}>Save for this check only</button>
          <button type="button" className="btn btn-block" onClick={saveForward} disabled={!valid}>Save going forward</button>
          <p className="small muted center">“Going forward” also updates future checks.</p>
        </div>
      )}

      {form.kind !== 'bill' && id && (
        <div className="stack">
          <h2 className="section">Purchases</h2>
          {!txs?.length ? (
            <div className="card small muted">No purchases yet. Use the + button to log one.</div>
          ) : (
            <div className="list">
              {txs.map((t) => (
                <div key={t.id} className="list-row">
                  <div className="grow stack" style={{ gap: 2 }}>
                    <span className="sm">{fmt(t.amount)}{form.tag === 'shared' && <span className="muted"> · your share {fmt(myShare(form, t.amount))}</span>}</span>
                    <span className="small muted">{fmtDate(t.date)}{t.note ? ` · ${t.note}` : ''}</span>
                  </div>
                  <button type="button" className="icon-btn plain sm" aria-label={`Delete ${fmt(t.amount)} purchase`}
                    onClick={() => confirm('Delete this purchase?') && deleteTransaction(t.id)}><Trash /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {id && <button type="button" className="btn btn-danger btn-block" onClick={remove}><Trash />Delete line item</button>}
    </div>
  )
}
