import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db.js'
import { restoreBackup, saveRecurring, saveSettings } from '../db/actions.js'
import { useSettings } from '../hooks.js'
import { itemPlanned } from '../lib/budget.js'
import { fmtShort } from '../lib/money.js'
import { TagPill } from '../components/ui.jsx'
import { LinesEditorBody } from './LinesEditor.jsx'
import { RecurringFields, blankRecurring } from './RecurringForm.jsx'
import { repeatText } from './RecurringList.jsx'
import { Plus, Trash } from '../components/Icons.jsx'

const STEPS = ['welcome', 'taxes', 'deductions', 'recurring']

export default function Setup() {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const settings = useSettings()
  const fileRef = useRef(null)
  if (!settings) return null

  const finish = async (to = '/paycheck/new') => {
    await saveSettings({ setupDone: true })
    navigate(to, { replace: true })
  }
  const onRestore = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      await restoreBackup(JSON.parse(await file.text()))
      await saveSettings({ setupDone: true })
      navigate('/', { replace: true })
    } catch (err) {
      alert(`Couldn’t restore: ${err.message}`)
    }
  }
  const name = STEPS[step]
  const next = () => setStep((s) => s + 1)

  return (
    <div className="screen no-nav">
      {step > 0 && (
        <div className="between">
          <button type="button" className="text-btn" onClick={() => setStep((s) => s - 1)}>Back</button>
          <span className="small muted">Step {step} of {STEPS.length - 1}</span>
          <button type="button" className="text-btn" onClick={() => finish()}>Skip</button>
        </div>
      )}

      {name === 'welcome' && (
        <div className="stack-lg" style={{ marginTop: '12vh' }}>
          <div className="split-bar" style={{ width: 120 }} aria-hidden="true">
            <div style={{ width: '50%', background: 'var(--needs)' }} /><div style={{ width: '30%', background: 'var(--wants)' }} /><div style={{ width: '20%', background: 'var(--savings)' }} />
          </div>
          <h1 className="title" style={{ fontSize: 30 }}>Budget</h1>
          <p className="muted" style={{ lineHeight: 1.5 }}>
            Enter each paycheck, split it 50/30/20 (or your own ratio), and track bills and spending against the plan.
            Free, no subscription, and your data stays on this device.
          </p>
          <div className="stack">
            <button type="button" className="btn btn-primary btn-lg" onClick={next}>Get started</button>
            <button type="button" className="btn btn-lg" onClick={() => fileRef.current?.click()}>Restore from a backup</button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-hidden="true" tabIndex={-1} onChange={onRestore} />
          </div>
        </div>
      )}

      {name === 'taxes' && (
        <>
          <Intro title="Your paystub: taxes" text="Which taxes come out of your paycheck? These become the lines on your paycheck form. You can change them later in Settings." />
          <LinesEditorBody type="taxes" />
          <button type="button" className="btn btn-primary btn-lg" onClick={next}>Next</button>
        </>
      )}

      {name === 'deductions' && (
        <>
          <Intro title="Your paystub: deductions" text="Anything else taken out, like insurance or retirement. Washington paystubs often show Paid Leave and WA Cares here." />
          <LinesEditorBody type="deductions" />
          <button type="button" className="btn btn-primary btn-lg" onClick={next}>Next</button>
        </>
      )}

      {name === 'recurring' && <RecurringStep settings={settings} onDone={() => finish()} />}
    </div>
  )
}

function Intro({ title, text }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <h1 className="title">{title}</h1>
      <p className="sm muted" style={{ lineHeight: 1.5 }}>{text}</p>
    </div>
  )
}

function RecurringStep({ settings, onDone }) {
  const list = useLiveQuery(() => db.recurring.toArray(), [])
  const [form, setForm] = useState(null)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  return (
    <>
      <Intro title="Recurring bills & spending" text="Add things that come up every check or every month: rent, phone, subscriptions, groceries, gas. They’ll be filled in on each new paycheck automatically." />

      {list?.length > 0 && (
        <div className="list">
          {list.map((t) => (
            <div key={t.id} className="list-row">
              <div className="grow stack" style={{ gap: 3 }}>
                <span className="row" style={{ gap: 6 }}><span style={{ fontWeight: 500 }}>{t.name}</span><TagPill tag={t.tag} /></span>
                <span className="small muted">{repeatText(t)}</span>
              </div>
              <span className="h2">{fmtShort(itemPlanned(t))}</span>
              <button type="button" className="icon-btn plain sm" aria-label={`Remove ${t.name}`} onClick={() => db.recurring.delete(t.id)}><Trash size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {form ? (
        <div className="card stack-lg">
          <RecurringFields form={form} set={set} />
          <div className="grid-2">
            <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={!form.name.trim()}
              onClick={async () => { await saveRecurring({ ...form, name: form.name.trim() }); setForm(null) }}>Add</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-dashed" style={{ height: 48 }} onClick={() => setForm(blankRecurring(settings.defaultSharePct))}>
          <Plus size={16} width={2} />Add recurring item
        </button>
      )}

      <button type="button" className="btn btn-primary btn-lg" onClick={onDone} disabled={!!form}>
        {list?.length ? 'Done · add my first paycheck' : 'Skip for now · add my first paycheck'}
      </button>
    </>
  )
}
