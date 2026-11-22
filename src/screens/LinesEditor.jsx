import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { newId, saveSettings } from '../db/actions.js'
import { useSettings } from '../hooks.js'
import { BackHeader } from '../components/ui.jsx'
import { Plus, Trash } from '../components/Icons.jsx'

const CONFIG = {
  taxes: { key: 'taxLines', title: 'Tax lines', suggestions: ['Federal income tax', 'Social Security', 'Medicare'] },
  deductions: { key: 'deductionLines', title: 'Deduction lines', suggestions: ['WA Paid Leave', 'WA Cares', 'Health insurance', 'Dental', 'Vision', '401(k)', 'Union dues'] },
}

export default function LinesEditor() {
  const { type } = useParams()
  const cfg = CONFIG[type]
  if (!cfg) return null
  return (
    <div className="screen no-nav">
      <BackHeader title={cfg.title} />
      <p className="sm muted">These are the lines your paycheck form asks for. Match them to your paystub. Turning a line off hides it on new paychecks but keeps it in your history.</p>
      <LinesEditorBody type={type} />
    </div>
  )
}

function NameInput({ value, dim, onCommit }) {
  const [text, setText] = useState(value)
  return (
    <input className="input sm grow" aria-label="Line name" value={text} style={{ opacity: dim ? 0.5 : 1 }}
      onChange={(e) => setText(e.target.value)} onBlur={() => onCommit(text)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
  )
}

/** Editable list of tax or deduction line names. Changes save right away. */
export function LinesEditorBody({ type }) {
  const cfg = CONFIG[type]
  const settings = useSettings()
  const [name, setName] = useState('')
  if (!settings) return null
  const lines = settings[cfg.key]
  const save = (next) => saveSettings({ [cfg.key]: next })

  const add = (n) => {
    const v = n.trim()
    if (!v || lines.some((l) => l.name.toLowerCase() === v.toLowerCase())) return
    save([...lines, { id: newId(), name: v, active: true }])
    setName('')
  }
  const update = (id, patch) => save(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const move = (idx, d) => {
    const next = [...lines]
    const j = idx + d
    if (j < 0 || j >= next.length) return
    ;[next[idx], next[j]] = [next[j], next[idx]]
    save(next)
  }
  const unused = cfg.suggestions.filter((s) => !lines.some((l) => l.name.toLowerCase() === s.toLowerCase()))

  return (
    <div className="stack-lg">
      {lines.length > 0 && (
        <div className="list">
          {lines.map((l, i) => (
            <div key={l.id} className="list-row" style={{ gap: 8 }}>
              <input type="checkbox" checked={l.active !== false} onChange={(e) => update(l.id, { active: e.target.checked })} aria-label={`${l.name} on`} />
              <NameInput value={l.name} dim={l.active === false} onCommit={(v) => v.trim() && v !== l.name && update(l.id, { name: v.trim() })} />
              <button type="button" className="icon-btn plain sm" aria-label={`Move ${l.name} up`} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="icon-btn plain sm" aria-label={`Move ${l.name} down`} onClick={() => move(i, 1)} disabled={i === lines.length - 1}>↓</button>
              <button type="button" className="icon-btn plain sm" aria-label={`Delete ${l.name}`} onClick={() => confirm(`Remove “${l.name}”?`) && save(lines.filter((x) => x.id !== l.id))}><Trash size={16} /></button>
            </div>
          ))}
        </div>
      )}

      <form className="row" onSubmit={(e) => { e.preventDefault(); add(name) }}>
        <input className="input grow" placeholder="Add a line…" aria-label="New line name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn" disabled={!name.trim()}><Plus size={16} />Add</button>
      </form>

      {unused.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="label">Common lines</span>
          <div className="chips">
            {unused.map((s) => <button key={s} type="button" className="chip" aria-pressed="false" onClick={() => add(s)}>+ {s}</button>)}
          </div>
        </div>
      )}
    </div>
  )
}
