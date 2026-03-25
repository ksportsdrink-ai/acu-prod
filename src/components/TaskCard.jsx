import { useState } from 'react'
import { Play, CheckCircle2, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { StatusBadge, FloorBadge, DelayModal, toast } from './ui.jsx'
import { updateTaskStatus } from '../services/tasks.js'
import { useTasks } from '../context/TaskContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { can } from '../services/auth.js'
import { fmtTime, minDiff, STATUS_LABEL } from '../utils/index.js'

export default function TaskCard({ task }) {
  const { profile } = useAuth()
  const { refresh, optimistic } = useTasks()
  const [expanded, setExpanded] = useState(false)
  const [delayModal, setDelayModal] = useState(false)
  const [busy, setBusy] = useState(false)

  const status    = task.status
  const delayMin  = minDiff(task.scheduled_time)
  const isOverdue = status !== 'completed' && status !== 'delayed' && delayMin >= 5

  // 표시 상태 (5분 초과면 delayed로 강조)
  const displayStatus = isOverdue && status === 'scheduled' ? 'delayed' : status

  async function act(newStatus, extra = {}) {
    if (busy) return
    setBusy(true)
    // 낙관적 업데이트
    const now = new Date().toISOString()
    const opt = { status: newStatus }
    if (newStatus === 'in_progress')  { opt.in_progress_by_name = profile.name; opt.in_progress_at = now }
    if (newStatus === 'completed')    { opt.completed_by_name = profile.name; opt.completed_at = now }
    if (newStatus === 'delayed')      { opt.delay_reason = extra.delayReason || '' }
    optimistic(task.id, opt)

    try {
      await updateTaskStatus(task.id, newStatus, profile, extra)
      refresh()
      const msgs = { in_progress: '▶ 발침 시작', completed: '✅ 발침 완료!', delayed: '⚠ 지연 처리' }
      toast(msgs[newStatus] || '처리됨', newStatus === 'completed' ? 'success' : 'info')
    } catch (e) {
      optimistic(task.id, { status: task.status }) // 롤백
      toast('처리 중 오류가 발생했습니다', 'error')
    } finally {
      setBusy(false)
    }
  }

  function handleDelay(reason) {
    setDelayModal(false)
    act('delayed', { delayReason: reason, alreadyInProgress: !!task.in_progress_by })
  }

  // 카드 테두리 색
  const border = displayStatus === 'delayed' ? '2px solid var(--red)' :
                 status === 'in_progress'    ? '1px solid rgba(77,159,255,.4)' :
                 status === 'completed'      ? '1px solid var(--border)' :
                 '1px solid var(--border)'

  return (
    <>
      <div className={`rounded-2xl overflow-hidden transition-all ${status === 'completed' ? 'opacity-60' : ''}`}
           style={{ background: 'var(--bg1)', border }}>

        {/* 상단: 시간 + 상태 */}
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-bold text-2xl leading-none"
                    style={{ color: displayStatus==='delayed'?'var(--red)': status==='in_progress'?'var(--blue)': 'var(--teal)' }}>
                {fmtTime(task.scheduled_time)}
              </span>
              {delayMin > 0 && status !== 'completed' && (
                <span className="flex items-center gap-1 text-xs font-bold"
                      style={{ color: delayMin >= 5 ? 'var(--red)' : 'var(--orange)' }}>
                  <Clock size={11} />+{delayMin}분
                </span>
              )}
            </div>
            <StatusBadge status={displayStatus} />
          </div>

          {/* 핵심 정보 */}
          <div className="flex items-center gap-2.5 flex-wrap text-base">
            <span className="font-mono font-bold text-lg">{task.room}호</span>
            <FloorBadge floor={task.floor} />
            <span style={{ color: 'var(--text3)' }}>·</span>
            <span className="font-bold">{task.patient_anonymized}</span>
            <span style={{ color: 'var(--text3)' }}>·</span>
            <span className="font-mono font-bold" style={{ color: 'var(--teal)' }}>{task.needle_count}개</span>
          </div>

          {/* 진행/완료 정보 */}
          {task.in_progress_by_name && !task.completed_by_name && (
            <div className="mt-2 flex items-center gap-1.5 text-sm"
                 style={{ color: 'var(--blue)' }}>
              ▶ <b>{task.in_progress_by_name}</b>
              <span style={{ color: 'var(--text3)' }}>진행중 ({fmtTime(task.in_progress_at)} 시작)</span>
            </div>
          )}
          {task.completed_by_name && (
            <div className="mt-2 flex items-center gap-1.5 text-sm"
                 style={{ color: 'var(--green)' }}>
              ✓ <b>{task.completed_by_name}</b>
              <span style={{ color: 'var(--text3)' }}>완료 {fmtTime(task.completed_at)}</span>
            </div>
          )}
          {task.delay_reason && (
            <div className="mt-2 flex items-center gap-1.5 text-sm"
                 style={{ color: 'var(--orange)' }}>
              <AlertTriangle size={13} />{task.delay_reason}
            </div>
          )}
          {task.memo && (
            <div className="mt-2 text-xs rounded-xl px-3 py-2"
                 style={{ background: 'rgba(255,255,255,.04)', color: 'var(--text2)' }}>
              📝 {task.memo}
            </div>
          )}
        </div>

        {/* 액션 버튼 (인턴/의사) */}
        {can(profile, 'updateStatus') && status !== 'completed' && (
          <div className="px-4 pb-4 flex gap-2">
            {(status === 'scheduled' || (isOverdue && status === 'scheduled')) && (
              <button onClick={() => act('in_progress')} disabled={busy}
                      className="btn btn-blue btn-lg flex-1">
                <Play size={18} fill="currentColor" />발침 시작
              </button>
            )}
            {(status === 'in_progress' || status === 'delayed') && (
              <button onClick={() => act('completed')} disabled={busy}
                      className="btn btn-green btn-lg flex-1">
                <CheckCircle2 size={18} />발침 완료
              </button>
            )}
            {status !== 'completed' && (
              <button onClick={() => setDelayModal(true)} disabled={busy}
                      className="btn btn-orange btn-lg px-4">
                <AlertTriangle size={18} />
              </button>
            )}
          </div>
        )}

        {/* 5분 초과 경고 */}
        {isOverdue && status === 'scheduled' && (
          <div className="mx-4 mb-4 text-center text-xs font-bold rounded-xl py-2"
               style={{ background: 'rgba(255,87,87,.1)', color: 'var(--red)',
                        border: '1px solid rgba(255,87,87,.25)', animation: 'urgBlink 1.2s step-end infinite' }}>
            ⚠ 발침 시간 {delayMin}분 초과 — 즉시 처리 필요
          </div>
        )}

        {/* 상세 토글 */}
        <button onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-1 py-2 text-xs"
                style={{ color: 'var(--text3)', borderTop: '1px solid var(--bg2)' }}>
          {expanded ? <><ChevronUp size={12} />접기</> : <><ChevronDown size={12} />상세</>}
        </button>

        {expanded && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-1.5 text-xs anim-up"
               style={{ color: 'var(--text2)' }}>
            <div><span style={{ color: 'var(--text3)' }}>의사 </span>{task.created_by_name}</div>
            <div><span style={{ color: 'var(--text3)' }}>진료과 </span>{task.department || '—'}</div>
            {task.in_progress_by_name && (
              <div className="col-span-2">
                <span style={{ color: 'var(--text3)' }}>진행시작 </span>
                <span style={{ color: 'var(--blue)' }}>{task.in_progress_by_name} {fmtTime(task.in_progress_at)}</span>
              </div>
            )}
            {task.completed_by_name && (
              <div className="col-span-2">
                <span style={{ color: 'var(--text3)' }}>완료처리 </span>
                <span style={{ color: 'var(--green)' }}>{task.completed_by_name} {fmtTime(task.completed_at)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {delayModal && (
        <DelayModal
          onConfirm={handleDelay}
          onClose={() => setDelayModal(false)}
        />
      )}
    </>
  )
}
