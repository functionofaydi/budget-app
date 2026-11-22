import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db.js'
import { deletePaycheck, savePaycheck } from '../db/actions.js'
import { usePaychecks, useSettings } from '../hooks.js'
import { netDifference } from '../lib/budget.js'
import { addDays, nextPayDate, prevPayDate, suggestPeriod, todayISO } from '../lib/dates.js'
import { fmt } from '../lib/money.js'
import { FormHeader, MoneyInput } from '../components/ui.jsx'
import { Check, Info, Trash } from '../components/Icons.jsx'

function linesFrom(settingsLines, saved = []) {
  // Start from the saved lines (edit) and add any active lines that are missing.
  const out = saved.map((l) => ({ ...l }))
  for (const l of settingsLines) {
    if (l.active !== false && !out.some((o) => o.lineId === l.id)) out.push({ lineId: l.id, name: l.name, amount: 0 })
  }
  return out
}

export default function PaycheckForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const paychecks = usePaychecks()
  const [form, setForm] = useState(null)
  const [periodTouched, setPeriodTouched] = useState(false)
  const [showMore, setShowMore] = useState(false)

  useEffect(() => {
    if (form || !settings || !paychecks) return
    ;(async () => {
      if (id) {
        const p = await db.paychecks.get(id)
        if (!p) return navigate('/', { replace: true })
        setForm({ ...p, taxes: linesFrom(settings.taxLines, p.taxes), deductions: linesFrom(settings.deductionLines, p.deductions) })
        setPeriodTouched(true)
        setShowMore(!!(p.hours || p.overtimeHours))
      } else {
        const latest = paychecks[paychecks.length - 1]
        const payDate = latest ? nextPayDate(addDays(latest.payDate, 1)) : prevPayDate(todayISO())
        const period = suggestPeriod(payDate)
        setForm({
          payDate, periodStart: period.start, periodEnd: period.end, gross: 0, net: 0, hours: '', overtimeHours: '',
          taxes: linesFrom(settings.taxLines), deductions: linesFrom(settings.deductionLines),
        })
      }
    })()
  }, [id, settings, paychecks, form, navigate])

  const diff = useMemo(() => (form ? netDifference(form) : 0), [form])
  if (!form) return null

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setLine = (kind, idx, amount) => setForm((f) => ({ ...f, [kind]: f[kind].map((l, i) => (i === idx ? { ...l, amount } : l)) }))

  const onPayDate = (payDate) => {
    if (!payDate) return set({ payDate })
    if (periodTouched) return set({ payDate })
    const p = suggestPeriod(payDate)
    set({ payDate, periodStart: p.start, periodEnd: p.end })
  }

  const save = async () => {
    if (!form.payDate) return alert('Add a pay date.')
    if (!form.net) return alert('Add your net pay.')
    if (!id && paychecks.some((p) => p.payDate === form.payDate)) {
      if (!confirm('You already have a paycheck on this date. Add another one?')) return
    }
    const saved = await savePaycheck({
      ...form,
      taxes: form.taxes.filter((l) => l.amount),
      deductions: form.deductions.filter((l) => l.amount),
      hours: form.hours || null,
      overtimeHours: form.overtimeHours || null,
    })
    navigate(`/?view=paycheck&p=${saved.id}`, { replace: true })
  }

  const remove = async () => {
    if (!confirm('Delete this paycheck and all of its line items and spending? This can’t be undone.')) return
    await deletePaycheck(id)
    navigate('/', { replace: true })
  }

  return (
    <div className="screen no-nav">
      <FormHeader title={id ? 'Edit paycheck' : 'New paycheck'} onCancel={() => navigate(-1)} onSave={save} />

      <div className="field">
        <label htmlFor="p-date">Pay date</label>
        <input id="p-date" type="date" className="input" value={form.payDate} onChange={(e) => onPayDate(e.target.value)} />
      </div>
      <div className="grid-2">
        <div className="field" style={{ minWidth: 0 }}>
          <label htmlFor="p-start">Period start</label>
          <input id="p-start" type="date" className="input" style={{ minWidth: 0 }} value={form.periodStart || ''} onChange={(e) => { setPeriodTouched(true); set({ periodStart: e.target.value }) }} />
        </div>
        <div className="field" style={{ minWidth: 0 }}>
          <label htmlFor="p-end">Period end</label>
          <input id="p-end" type="date" className="input" style={{ minWidth: 0 }} value={form.periodEnd || ''} onChange={(e) => { setPeriodTouched(true); set({ periodEnd: e.target.value }) }} />
        </div>
      </div>

      <div className="list">
        <div className="money-row">
          <label htmlFor="p-gross" className="h2">Gross pay</label>
          <MoneyInput id="p-gross" value={form.gross} onChange={(gross) => set({ gross })} />
        </div>
      </div>

      <LineSection title="Taxes" kind="taxes" lines={form.taxes} onChange={setLine} />
      <LineSection title="Deductions" kind="deductions" lines={form.deductions} onChange={setLine} />

      <div className="card stack" style={{ gap: 10, padding: '12px 14px' }}>
        <div className="money-row" style={{ padding: 0 }}>
          <label htmlFor="p-net" className="h2">Net pay</label>
          <MoneyInput id="p-net" value={form.net} onChange={(net) => set({ net })} />
        </div>
        {form.net > 0 && (diff === 0 ? (
          <div className="row small good"><Check />Matches gross − taxes − deductions</div>
        ) : (
          <div className="row small warn" style={{ alignItems: 'flex-start' }}><Info size={16} /><span>Off by {fmt(Math.abs(diff))}. Typo, or a deduction you didn’t add? You can still save.</span></div>
        ))}
      </div>

      {showMore ? (
        <div className="list">
          <div className="money-row">
            <label htmlFor="p-hours" className="sm">Hours</label>
            <input id="p-hours" className="input sm money" inputMode="decimal" style={{ width: 110 }} value={form.hours || ''} onChange={(e) => set({ hours: e.target.value })} />
          </div>
          <div className="money-row">
            <label htmlFor="p-ot" className="sm">Overtime hours</label>
            <input id="p-ot" className="input sm money" inputMode="decimal" style={{ width: 110 }} value={form.overtimeHours || ''} onChange={(e) => set({ overtimeHours: e.target.value })} />
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={() => setShowMore(true)}>+ Add hours (optional)</button>
      )}

      {id && (
        <button type="button" className="btn btn-danger btn-block" onClick={remove}><Trash />Delete paycheck</button>
      )}
    </div>
  )
}

function LineSection({ title, kind, lines, onChange }) {
  return (
    <div className="stack">
      <div className="between">
        <h2 className="section">{title}</h2>
        <Link to={`/settings/lines/${kind}`} className="btn btn-ghost btn-xs">Edit lines</Link>
      </div>
      {lines.length === 0 ? (
        <div className="card small muted">No {title.toLowerCase()} lines yet. Tap “Edit lines” to add the ones on your paystub.</div>
      ) : (
        <div className="list">
          {lines.map((l, i) => (
            <div key={l.lineId || i} className="money-row">
              <label htmlFor={`${kind}-${i}`} className="sm" style={{ fontSize: 14 }}>{l.name}</label>
              <MoneyInput id={`${kind}-${i}`} className="sm" value={l.amount} onChange={(v) => onChange(kind, i, v)} style={{ width: 110 }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
