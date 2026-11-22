import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db.js'
import { deleteRecurring, pickCurrentPaycheck, saveItem, saveRecurring } from '../db/actions.js'
import { useSettings } from '../hooks.js'
import { BUCKETS, TAGS, myShare } from '../lib/budget.js'
import { checkSlot, fmtDate } from '../lib/dates.js'
import { fmt } from '../lib/money.js'
import { FormHeader, MoneyInput } from '../components/ui.jsx'
import { Trash } from '../components/Icons.jsx'

/** Shared fields for a recurring template (also used by first-time setup). */
export function RecurringFields({ form, set }) {
  return (
    <>
      <div className="field">
        <label htmlFor="r-name">Name</label>
        <input id="r-name" className="input" placeholder="e.g. Rent, Phone, Groceries" value={form.name} onChange={(e) => set({ name: e.target.value })} />
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
            <button key={b.key} type="button" aria-pressed={form.bucket === b.key} onClick={() => set({ bucket: b.key })}>{b.key === 'savings' ? 'Savings' : b.label}</button>
          ))}
        </div>
      </div>
      <div className="list">
        <div className="money-row">
          <label htmlFor="r-amt" className="h2" style={{ fontWeight: 500 }}>{form.tag === 'shared' ? 'Full amount' : 'Amount'}</label>
          <MoneyInput id="r-amt" value={form.fullAmount} onChange={(fullAmount) => set({ fullAmount })} />
        </div>
      </div>
      <div className="field">
        <span className="label">Tag</span>
        <div className="chips" role="group" aria-label="Tag">
          {TAGS.map((t) => <button key={t.key} type="button" className="chip" aria-pressed={form.tag === t.key} onClick={() => set({ tag: t.key })}>{t.label}</button>)}
        </div>
      </div>
      {form.tag === 'shared' && (
        <div className="list">
          <div className="money-row">
            <label htmlFor="r-share" className="sm">My share</label>
            <div className="row" style={{ gap: 6 }}>
              <input id="r-share" className="input sm money" style={{ width: 80 }} inputMode="numeric" value={form.sharePct}
                onChange={(e) => set({ sharePct: Math.max(0, Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0)) })} />
              <span className="muted">%</span>
            </div>
          </div>
          <div className="money-row small muted"><span>Counts toward your budget</span><span className="strong">{fmt(myShare(form, form.fullAmount))}</span></div>
        </div>
      )}
      <div className="field">
        <span className="label">Repeats</span>
        <div className="seg" role="group" aria-label="Repeats">
          <button type="button" aria-pressed={form.repeat === 'every'} onClick={() => set({ repeat: 'every' })}>Every paycheck</button>
          <button type="button" aria-pressed={form.repeat === 'monthly'} onClick={() => set({ repeat: 'monthly' })}>Once a month</button>
        </div>
      </div>
      {form.repeat === 'monthly' && (
        <div className="seg" role="group" aria-label="Which check">
          <button type="button" aria-pressed={form.check === 'first'} onClick={() => set({ check: 'first' })}>5th check</button>
          <button type="button" aria-pressed={form.check === 'second'} onClick={() => set({ check: 'second' })}>20th check</button>
        </div>
      )}
      <div className="field">
        <span className="label">Amount</span>
        <div className="seg" role="group" aria-label="Amount type">
          <button type="button" aria-pressed={form.amountType === 'fixed'} onClick={() => set({ amountType: 'fixed' })}>Fixed</button>
          <button type="button" aria-pressed={form.amountType === 'variable'} onClick={() => set({ amountType: 'variable' })}>Varies</button>
        </div>
        <span className="small muted">{form.amountType === 'variable' ? 'Copies last period’s amount and marks it “Needs review”.' : 'Same amount every time.'}</span>
      </div>
    </>
  )
}

export const blankRecurring = (sharePct = 50) => ({
  name: '', kind: 'bill', bucket: 'needs', fullAmount: 0, tag: 'mine', sharePct,
  repeat: 'monthly', check: 'first', amountType: 'fixed', active: true,
})

export default function RecurringForm() {
  const { id } = useParams()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const settings = useSettings()
  const [form, setForm] = useState(null)
  const [current, setCurrent] = useState(null)
  const [addNow, setAddNow] = useState(true)

  useEffect(() => {
    if (form || !settings) return
    ;(async () => {
      if (isNew) {
        setForm(blankRecurring(settings.defaultSharePct))
        setCurrent(pickCurrentPaycheck(await db.paychecks.toArray()))
      } else {
        const t = await db.recurring.get(id)
        if (!t) return navigate(-1)
        setForm(t)
      }
    })()
  }, [id, isNew, settings, form, navigate])

  if (!form) return null
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const valid = !!form.name.trim()
  const fitsCurrent = current && (form.repeat === 'every' || form.check === checkSlot(current.payDate))

  const save = async () => {
    if (!valid) return
    const t = await saveRecurring({ ...form, name: form.name.trim() })
    if (isNew && addNow && fitsCurrent) {
      await saveItem({
        paycheckId: current.id, recurringId: t.id, name: t.name, bucket: t.bucket, kind: t.kind, tag: t.tag,
        sharePct: t.sharePct, fullAmount: t.fullAmount, paid: false, paidAmount: null, needsReview: false,
      })
    }
    navigate(-1)
  }

  return (
    <div className="screen no-nav">
      <FormHeader title={isNew ? 'New recurring item' : 'Edit recurring item'} onCancel={() => navigate(-1)} onSave={save} saveDisabled={!valid} />
      <RecurringFields form={form} set={set} />

      {!isNew && (
        <label className="option">
          <input type="checkbox" checked={form.active !== false} onChange={(e) => set({ active: e.target.checked })} />
          <span className="stack" style={{ gap: 2 }}><span>Active</span><span className="small muted">Turn off to stop adding it to new paychecks</span></span>
        </label>
      )}
      {isNew && fitsCurrent && (
        <label className="option">
          <input type="checkbox" checked={addNow} onChange={(e) => setAddNow(e.target.checked)} />
          <span className="stack" style={{ gap: 2 }}><span>Add to {fmtDate(current.payDate)} paycheck too</span><span className="small muted">Otherwise it starts with your next paycheck</span></span>
        </label>
      )}
      {!isNew && (
        <button type="button" className="btn btn-danger btn-block"
          onClick={async () => { if (confirm(`Delete “${form.name}”? Paychecks you already have keep their copy.`)) { await deleteRecurring(id); navigate(-1) } }}>
          <Trash />Delete recurring item
        </button>
      )}
    </div>
  )
}
