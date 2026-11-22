import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ChevronLeft, Cash, GridIcon, ListIcon, Plus } from './Icons.jsx'
import { bucketInfo, spendStatus } from '../lib/budget.js'
import { centsToInput, toCents } from '../lib/money.js'

export function BackHeader({ title, subtitle, to, right, dotColor }) {
  const navigate = useNavigate()
  return (
    <div className="header">
      <div className="header-back">
        {to ? (
          <Link to={to} className="icon-btn plain" aria-label="Back"><ChevronLeft /></Link>
        ) : (
          <button type="button" className="icon-btn plain" aria-label="Back" onClick={() => navigate(-1)}><ChevronLeft /></button>
        )}
        <div className="stack" style={{ gap: 0 }}>
          <h1 className="title row" style={{ gap: 8 }}>
            {dotColor && <span className="dot" style={{ width: 10, height: 10, background: dotColor }} />}
            {title}
          </h1>
          {subtitle && <span className="small muted">{subtitle}</span>}
        </div>
      </div>
      {right}
    </div>
  )
}

export function FormHeader({ title, onCancel, onSave, saveLabel = 'Save', saveDisabled }) {
  return (
    <div className="header">
      <button type="button" className="text-btn" onClick={onCancel}>Cancel</button>
      <h1 className="page-title">{title}</h1>
      <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={saveDisabled}>{saveLabel}</button>
    </div>
  )
}

export function BottomNav() {
  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-inner">
        <NavLink to="/" end><GridIcon />Budget</NavLink>
        <NavLink to="/paychecks"><Cash />Paychecks</NavLink>
        <NavLink to="/activity"><ListIcon />Activity</NavLink>
      </div>
    </nav>
  )
}

export function Fab({ to }) {
  return (
    <Link to={to} className="fab" aria-label="Quick add spending"><Plus /></Link>
  )
}

/** Progress bar colored by bucket, turning red when over. */
export function ProgressBar({ planned, spent, bucket, full }) {
  const status = spendStatus(planned, spent)
  const pct = full ? 100 : planned > 0 ? Math.min(100, Math.round((spent / planned) * 100)) : spent > 0 ? 100 : 0
  const color = status === 'over' ? 'var(--danger)' : bucketInfo(bucket)?.color
  return (
    <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function BucketDot({ bucket, size = 8 }) {
  return <span className="dot" style={{ width: size, height: size, background: bucketInfo(bucket)?.color }} />
}

export function TagPill({ tag }) {
  if (tag === 'shared') return <span className="pill shared">Shared</span>
  if (tag === 'logan') return <span className="pill logan">Logan</span>
  return <span className="pill">Mine</span>
}

/** Text input for dollars that reports cents. */
export function MoneyInput({ value, onChange, id, className = '', placeholder = '$0.00', ...rest }) {
  const [text, setText] = useState(value ? centsToInput(value) : '')
  useEffect(() => {
    // Sync when the value changes from outside (e.g. form reset).
    setText((t) => (toCents(t) === value ? t : value ? centsToInput(value) : ''))
  }, [value])
  const invalid = Number.isNaN(toCents(text))
  return (
    <input
      id={id}
      className={`input money ${invalid ? 'invalid' : ''} ${className}`}
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const c = toCents(e.target.value)
        if (!Number.isNaN(c)) onChange(c)
      }}
      onBlur={() => { if (!invalid && text !== '') setText(centsToInput(toCents(text)) || '0.00') }}
      {...rest}
    />
  )
}

export function useToast() {
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2600)
    return () => clearTimeout(t)
  }, [msg])
  const node = msg ? <div className="toast" role="status">{msg}</div> : null
  return [node, setMsg]
}

export function Loading() {
  return <div className="screen"><p className="muted center">Loading…</p></div>
}
