import { useState } from 'react'
import { newId, saveSettings } from '../db/actions.js'
import { useSettings } from '../hooks.js'
import { BUCKETS, splitLabel, splitTotal } from '../lib/budget.js'
import { BackHeader } from '../components/ui.jsx'
import { Trash } from '../components/Icons.jsx'

export default function Presets() {
  const settings = useSettings()
  const [name, setName] = useState('')
  const [split, setSplit] = useState({ needs: 50, wants: 30, savings: 20 })
  if (!settings) return null
  const total = splitTotal(split)

  const add = (e) => {
    e.preventDefault()
    if (!name.trim() || total !== 100) return
    saveSettings({ presets: [...settings.presets, { id: newId(), name: name.trim(), split }] })
    setName('')
  }

  return (
    <div className="screen no-nav">
      <BackHeader title="Split presets" />
      <p className="sm muted">Presets show up on the Adjust split screen so you can switch a paycheck’s split in one tap.</p>

      {settings.presets.length > 0 && (
        <div className="list">
          {settings.presets.map((p) => (
            <div key={p.id} className="list-row">
              <span className="grow">{p.name}</span>
              <span className="sm muted">{splitLabel(p.split)}</span>
              <button type="button" className="icon-btn plain sm" aria-label={`Delete ${p.name}`}
                onClick={() => confirm(`Delete “${p.name}”?`) && saveSettings({ presets: settings.presets.filter((x) => x.id !== p.id) })}><Trash size={16} /></button>
            </div>
          ))}
        </div>
      )}

      <form className="card stack" onSubmit={add}>
        <span className="h2">New preset</span>
        <div className="field">
          <label htmlFor="pr-name">Name</label>
          <input id="pr-name" className="input" placeholder="e.g. Summer" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid-3">
          {BUCKETS.map((b) => (
            <div key={b.key} className="field">
              <label htmlFor={`pr-${b.key}`} className="row" style={{ gap: 6 }}><span className="dot" style={{ background: b.color }} />{b.key === 'savings' ? 'Savings' : b.label} %</label>
              <input id={`pr-${b.key}`} className="input money" inputMode="numeric" value={split[b.key]}
                onChange={(e) => setSplit((s) => ({ ...s, [b.key]: Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0) }))} />
            </div>
          ))}
        </div>
        <span className={`small ${total === 100 ? 'good' : 'danger'}`}>Total {total}%{total !== 100 ? ' (must be 100%)' : ''}</span>
        <button type="submit" className="btn btn-primary" disabled={!name.trim() || total !== 100}>Add preset</button>
      </form>
    </div>
  )
}
