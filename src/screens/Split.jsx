import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { newId, saveSettings, setPaycheckSplit } from '../db/actions.js'
import { usePaycheckData, useSettings } from '../hooks.js'
import { BUCKETS, bucketBudgets, rebalance, splitEquals, splitLabel } from '../lib/budget.js'
import { fmtDate } from '../lib/dates.js'
import { fmt } from '../lib/money.js'
import { FormHeader } from '../components/ui.jsx'

export default function Split() {
  const { id } = useParams()
  const isDefault = id === 'default'
  const navigate = useNavigate()
  const settings = useSettings()
  const data = usePaycheckData(isDefault ? null : id, settings?.defaultSplit)
  const [split, setSplit] = useState(null)
  const [scope, setScope] = useState('this')

  useEffect(() => {
    if (split || !settings) return
    if (isDefault) setSplit(settings.defaultSplit)
    else if (data) setSplit(data.paycheck.split || settings.defaultSplit)
  }, [settings, data, split, isDefault])

  if (!settings || !split || (!isDefault && !data)) return null

  const net = data?.paycheck.net || 0
  const budgets = bucketBudgets(net, split)

  const save = async () => {
    if (isDefault) {
      await saveSettings({ defaultSplit: split })
    } else if (scope === 'default') {
      await saveSettings({ defaultSplit: split })
      await setPaycheckSplit(id, null)
    } else {
      await setPaycheckSplit(id, splitEquals(split, settings.defaultSplit) ? null : split)
    }
    navigate(-1)
  }

  const savePreset = async () => {
    const name = prompt('Name this preset', 'My preset')
    if (!name?.trim()) return
    await saveSettings({ presets: [...settings.presets, { id: newId(), name: name.trim(), split }] })
  }

  return (
    <div className="screen no-nav">
      <FormHeader title={isDefault ? 'Default split' : 'Adjust split'} onCancel={() => navigate(-1)} onSave={save} />

      <div className="stack">
        {!isDefault && (
          <div className="between small muted"><span>{fmtDate(data.paycheck.payDate)} paycheck</span><span>Net {fmt(net)}</span></div>
        )}
        <div className="split-bar" aria-hidden="true">
          {BUCKETS.map((b) => <div key={b.key} style={{ width: `${split[b.key]}%`, background: b.color }} />)}
        </div>
        <div className="center sm good">Total 100%</div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <span className="label">Presets</span>
        <div className="chips" role="group" aria-label="Presets">
          {settings.presets.map((p) => (
            <button key={p.id} type="button" className="chip neutral" aria-pressed={splitEquals(p.split, split)} onClick={() => setSplit(p.split)}>
              {p.name} · {splitLabel(p.split).replace(/ /g, '')}
            </button>
          ))}
        </div>
      </div>

      <div className="list">
        {BUCKETS.map((b) => {
          const spent = data?.summary.buckets[b.key].spent || 0
          const overBy = spent - budgets[b.key]
          return (
            <div key={b.key} className="stack" style={{ gap: 8, padding: '12px 0' }}>
              <div className="between baseline">
                <label htmlFor={`s-${b.key}`} className="row h2"><span className="dot" style={{ background: b.color }} />{b.label}</label>
                <span className="sm muted"><span className="strong">{split[b.key]}%</span>{!isDefault && ` · ${fmt(budgets[b.key])}`}</span>
              </div>
              <input id={`s-${b.key}`} type="range" min="0" max="100" step="1" value={split[b.key]} style={{ accentColor: b.color }}
                onChange={(e) => setSplit((s) => rebalance(s, b.key, Number(e.target.value)))} />
              {!isDefault && overBy > 0 && b.key !== 'savings' && (
                <span className="small danger">Already spent {fmt(spent)}, now over by {fmt(overBy)}</span>
              )}
            </div>
          )
        })}
      </div>

      {!isDefault && (
        <fieldset style={{ margin: 0, padding: 0, border: 'none' }} className="stack">
          <legend className="label" style={{ marginBottom: 8 }}>Apply to</legend>
          <label className={`option ${scope === 'this' ? 'selected' : ''}`}>
            <input type="radio" name="scope" checked={scope === 'this'} onChange={() => setScope('this')} />
            <span className="stack" style={{ gap: 2 }}><span className="sm strong" style={{ fontSize: 14, fontWeight: 500 }}>Just this paycheck</span><span className="small muted">Shows as “Custom” on the home screen</span></span>
          </label>
          <label className={`option ${scope === 'default' ? 'selected' : ''}`}>
            <input type="radio" name="scope" checked={scope === 'default'} onChange={() => setScope('default')} />
            <span className="stack" style={{ gap: 2 }}><span className="sm strong" style={{ fontSize: 14, fontWeight: 500 }}>Make it my default</span><span className="small muted">Used for this and future paychecks</span></span>
          </label>
        </fieldset>
      )}

      <div className="grid-2">
        <button type="button" className="btn btn-dashed" onClick={savePreset}>Save as preset…</button>
        <button type="button" className="btn btn-dashed" onClick={() => setSplit(settings.defaultSplit)} disabled={splitEquals(split, settings.defaultSplit)}>Reset to default</button>
      </div>
    </div>
  )
}
