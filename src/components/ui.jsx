import { useState, useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { STATUS_LABEL, STATUS_BADGE, floorClass } from '../utils/index.js'

/* ── StatusBadge ─────────────────────────────────────── */
export function StatusBadge({ status, size = 'sm' }) {
  const cls = STATUS_BADGE[status] || 'badge-scheduled'
  const dot = 'w-1.5 h-1.5 rounded-full bg-current'
  return (
    <span className={`${cls} ${size === 'lg' ? 'text-sm px-3 py-1.5' : ''}`}>
      <span className={dot} />
      {STATUS_LABEL[status] || status}
    </span>
  )
}

/* ── FloorBadge ──────────────────────────────────────── */
export function FloorBadge({ floor, className = '' }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-bold ${floorClass(floor)} ${className}`}>
      {floor}
    </span>
  )
}

/* ── Spinner ─────────────────────────────────────────── */
export function Spinner({ size = 28 }) {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="rounded-full border-2 border-t-transparent animate-spin"
           style={{ width: size, height: size, borderColor: 'var(--teal)', borderTopColor: 'transparent' }} />
    </div>
  )
}

/* ── Modal ───────────────────────────────────────────── */
export function Modal({ children, onClose, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className={`card w-full ${maxWidth} anim-up max-h-[92vh] overflow-y-auto`}
           style={{ background: 'var(--bg1)' }}>
        {children}
      </div>
    </div>
  )
}

/* ── Toast ───────────────────────────────────────────── */
let _addToast = null
let _tid = 0
export function toast(msg, type = 'info', ms = 3000) {
  _addToast?.({ msg, type, ms })
}

export function ToastHost() {
  const [list, setList] = useState([])
  useEffect(() => {
    _addToast = ({ msg, type, ms }) => {
      const id = ++_tid
      setList(p => [...p, { id, msg, type }])
      setTimeout(() => setList(p => p.filter(t => t.id !== id)), ms)
    }
    return () => { _addToast = null }
  }, [])
  const COLORS = { info:'#4d9fff', success:'#34d399', warning:'#f59e3f', error:'#ff5757' }
  const ICONS  = { info:'ℹ', success:'✓', warning:'⚠', error:'✕' }
  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none"
         style={{ maxWidth: 320 }}>
      {list.map(t => (
        <div key={t.id} className="anim-up pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl text-sm"
             style={{ background: 'var(--bg2)', border: `1px solid ${COLORS[t.type]}35`,
                      color: 'var(--text1)', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
          <span style={{ color: COLORS[t.type], fontWeight: 700 }}>{ICONS[t.type]}</span>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

/* ── DelayModal ──────────────────────────────────────── */
const DELAY_PRESETS = ['응급콜', '타 업무 중', '환자 부재', '처치 지연', '기타']

export function DelayModal({ onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} style={{ color: 'var(--orange)' }} />
          <span className="font-bold">지연 사유 입력</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10"><X size={15} /></button>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {DELAY_PRESETS.map(p => (
            <button key={p} onClick={() => setReason(p)}
              className="px-3 py-2 rounded-xl text-sm font-semibold transition-all"
              style={reason === p
                ? { background: 'rgba(245,158,62,.2)', color: 'var(--orange)', border: '1px solid rgba(245,158,62,.4)' }
                : { background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
              {p}
            </button>
          ))}
        </div>
        <input className="inp" value={reason} onChange={e => setReason(e.target.value)}
               placeholder="직접 입력..." />
      </div>
      <div className="p-4 flex gap-2">
        <button onClick={() => onConfirm(reason || '사유 미입력')}
                className="btn btn-orange flex-1 py-3.5 text-base">지연 처리</button>
        <button onClick={onClose} className="btn btn-ghost flex-1 py-3.5 text-base">취소</button>
      </div>
    </Modal>
  )
}
