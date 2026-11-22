import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db.js'
import { buildBackup, restoreBackup, saveSettings } from '../db/actions.js'
import { useSettings } from '../hooks.js'
import { splitLabel } from '../lib/budget.js'
import { deliverFile, paychecksCSV, spendingCSV } from '../lib/exporters.js'
import { todayISO } from '../lib/dates.js'
import { BackHeader, useToast } from '../components/ui.jsx'
import { ChevronRight, Download, Sheet, Upload } from '../components/Icons.jsx'

export default function Settings() {
  const settings = useSettings()
  const recurringCount = useLiveQuery(() => db.recurring.count(), [])
  const fileRef = useRef(null)
  const [toast, showToast] = useToast()
  if (!settings) return null

  const activeTax = settings.taxLines.filter((l) => l.active !== false).length
  const activeDed = settings.deductionLines.filter((l) => l.active !== false).length

  const exportBackup = async () => {
    const backup = await buildBackup()
    const r = await deliverFile(`budget-backup-${todayISO()}.json`, JSON.stringify(backup, null, 2), 'application/json')
    if (r !== 'cancelled') {
      await saveSettings({ lastBackupAt: new Date().toISOString() })
      showToast('Backup saved')
    }
  }
  const exportCSV = async (kind) => {
    const text = kind === 'paychecks' ? await paychecksCSV() : await spendingCSV()
    await deliverFile(`budget-${kind}-${todayISO()}.csv`, text, 'text/csv')
  }
  const onRestoreFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const obj = JSON.parse(await file.text())
      const when = obj.exportedAt ? new Date(obj.exportedAt).toLocaleString() : 'an unknown date'
      if (!confirm(`Restore the backup from ${when}? This replaces everything currently in the app on this device.`)) return
      await restoreBackup(obj)
      showToast('Backup restored')
    } catch (err) {
      alert(`Couldn’t restore: ${err.message}`)
    }
  }

  return (
    <div className="screen no-nav">
      <BackHeader title="Settings" to="/" />

      <h2 className="section" style={{ marginTop: 8 }}>Budget</h2>
      <div className="list">
        <Row to="/split/default" label="Default split" value={splitLabel(settings.defaultSplit)} />
        <Row to="/settings/presets" label="Split presets" value={`${settings.presets.length} saved`} />
        <Row to="/settings/recurring" label="Recurring items" value={recurringCount == null ? '' : `${recurringCount}`} />
        <div className="list-row">
          <label htmlFor="s-view" className="grow">Default view</label>
          <select id="s-view" className="input sm" style={{ width: 150 }} value={settings.defaultView} onChange={(e) => saveSettings({ defaultView: e.target.value })}>
            <option value="paycheck">By Paycheck</option>
            <option value="month">By Month</option>
          </select>
        </div>
        <div className="list-row">
          <label htmlFor="s-share" className="grow">Shared items: my share</label>
          <div className="row" style={{ gap: 6 }}>
            <PercentInput id="s-share" value={settings.defaultSharePct} onCommit={(v) => saveSettings({ defaultSharePct: v })} />
            <span className="muted">%</span>
          </div>
        </div>
      </div>

      <h2 className="section" style={{ marginTop: 8 }}>Paychecks</h2>
      <div className="list">
        <Row to="/settings/lines/taxes" label="Tax lines" value={`${activeTax} active`} />
        <Row to="/settings/lines/deductions" label="Deduction lines" value={`${activeDed} active`} />
      </div>

      <h2 className="section" style={{ marginTop: 8 }}>End of period</h2>
      <div className="card row" style={{ gap: 12 }}>
        <span className="dot" style={{ background: 'var(--savings)' }} />
        <span className="stack" style={{ gap: 2 }}>
          <span>Leftover money</span>
          <span className="small muted">Unassigned + unspent Needs and Wants money moves to Savings &amp; Debt automatically</span>
        </span>
      </div>

      <h2 className="section" style={{ marginTop: 8 }}>Data</h2>
      <div className="list">
        <ActionRow icon={<Download />} label="Export backup file" onClick={exportBackup} />
        <ActionRow icon={<Sheet />} label="Export paychecks (CSV)" onClick={() => exportCSV('paychecks')} />
        <ActionRow icon={<Sheet />} label="Export spending (CSV)" onClick={() => exportCSV('spending')} />
        <ActionRow icon={<Upload />} label="Restore from backup" onClick={() => fileRef.current?.click()} />
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-hidden="true" tabIndex={-1} onChange={onRestoreFile} />
      <p className="small muted" style={{ lineHeight: 1.45, padding: '0 2px' }}>
        Your data is stored on this device only.{' '}
        {settings.lastBackupAt ? `Last backup: ${new Date(settings.lastBackupAt).toLocaleDateString()}.` : 'No backup yet. Export one now and then.'}
      </p>
      {toast}
    </div>
  )
}

function PercentInput({ id, value, onCommit }) {
  const [text, setText] = useState(String(value))
  const commit = () => {
    const v = Math.max(0, Math.min(100, Number(text.replace(/\D/g, '')) || 0))
    setText(String(v))
    onCommit(v)
  }
  return (
    <input id={id} className="input sm money" style={{ width: 72 }} inputMode="numeric" value={text}
      onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
  )
}

function Row({ to, label, value }) {
  return (
    <Link to={to} className="list-row link-row" style={{ justifyContent: 'space-between' }}>
      <span>{label}</span>
      <span className="row muted sm" style={{ gap: 6, fontSize: 14 }}>{value}<ChevronRight size={16} /></span>
    </Link>
  )
}

function ActionRow({ icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="list-row">
      <span className="muted" style={{ display: 'inline-flex' }}>{icon}</span>{label}
    </button>
  )
}
