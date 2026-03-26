import { useState } from 'react'
import { Play, CheckCircle2, AlertTriangle, Clock, ChevronDown, ChevronUp, Pause, UserCheck } from 'lucide-react'
import { StatusBadge, FloorBadge, DelayModal, PauseModal, toast } from './ui.jsx'
import { updateTaskStatus } from '../services/tasks.js'
import { useTasks } from '../context/TaskContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { can } from '../services/auth.js'
import { fmtTime, minDiff } from '../utils/index.js'

export default function TaskCard({ task, overdueResidentAlert }) {
  const { profile } = useAuth()
  const { refresh, optimistic } = useTasks()
  const [expanded, setExpanded]   = useState(false)
  const [delayModal, setDelayModal] = useState(false)
  const [pauseModal, setPauseModal] = useState(false)
  const [busy, setBusy] = useState(false)

  const status   = task.status
  const delayMin = minDiff(task.scheduled_time)
  // 5분 이상 경과 + 미완료 = overdue
  const isOverdue = status !== 'completed' && status !== 'paused' && delayMin >= 5
  const displayStatus = isOverdue && status === 'scheduled' ? 'delayed' : status

  async function act(newStatus, extra={}) {
    if (busy) return
    setBusy(true)
    const now = new Date().toISOString()
    const opt = { status: newStatus }
    if (newStatus==='in_progress')  { opt.in_progress_by_name=profile.name; opt.in_progress_at=now; opt.paused_by_name=null; opt.paused_at=null }
    if (newStatus==='completed')    { opt.completed_by_name=profile.name; opt.completed_at=now }
    if (newStatus==='delayed')      { opt.delay_reason=extra.delayReason||'' }
    if (newStatus==='paused')       { opt.paused_by_name=profile.name; opt.paused_at=now; opt.pause_reason=extra.pauseReason||'' }
    optimistic(task.id, opt)
    try {
      await updateTaskStatus(task.id, newStatus, profile, extra)
      refresh()
      const msgs = { in_progress:'▶ 발침 시작', completed:'✅ 발침 완료!', delayed:'⚠ 지연 처리', paused:'⏸ 중단 처리' }
      toast(msgs[newStatus]||'처리됨', newStatus==='completed'?'success':newStatus==='paused'?'warning':'info')
    } catch(e) {
      optimistic(task.id, {status:task.status})
      toast('오류: '+e.message,'error')
    } finally { setBusy(false) }
  }

  // 카드 테두리
  const border = isOverdue || displayStatus==='delayed' ? '2px solid var(--red)' :
                 status==='paused'      ? '2px solid var(--purple)' :
                 status==='in_progress' ? '1px solid rgba(77,159,255,.4)' :
                 status==='completed'   ? '1px solid var(--border)' :
                 '1px solid var(--border)'

  const canAct = can(profile,'updateStatus') && status !== 'completed'

  return (
    <>
      <div className={`rounded-2xl overflow-hidden transition-all ${status==='completed'?'opacity-60':''} ${isOverdue?'overdue-glow':''}`}
           style={{background:'var(--bg1)',border}}>

        {/* 5분 초과 경고 배너 */}
        {isOverdue && (
          <div className="px-4 py-2 flex items-center gap-2 text-xs font-bold"
               style={{background:'rgba(255,87,87,.15)',color:'var(--red)'}}>
            <AlertTriangle size={13}/>
            발침 예정 시간 {delayMin}분 초과 — 즉시 처리 필요!
            {overdueResidentAlert && (
              <span className="ml-auto" style={{color:'rgba(255,87,87,.7)'}}>
                주치의: {overdueResidentAlert} 알림 발송됨
              </span>
            )}
          </div>
        )}

        <div className="p-4">
          {/* 헤더: 시간 + 상태 */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-bold text-2xl leading-none"
                    style={{color:isOverdue?'var(--red)':status==='in_progress'?'var(--blue)':status==='paused'?'var(--purple)':'var(--teal)'}}>
                {fmtTime(task.scheduled_time)}
              </span>
              {delayMin > 0 && status !== 'completed' && (
                <span className="flex items-center gap-1 text-xs font-bold"
                      style={{color:delayMin>=5?'var(--red)':'var(--orange)'}}>
                  <Clock size={11}/>+{delayMin}분
                </span>
              )}
            </div>
            <StatusBadge status={displayStatus}/>
          </div>

          {/* 핵심 정보 */}
          <div className="flex items-center gap-2.5 flex-wrap text-base">
            <span className="font-mono font-bold text-lg">{task.room}호</span>
            <FloorBadge floor={task.floor}/>
            <span style={{color:'var(--text3)'}}>·</span>
            <span className="font-bold">{task.patient_anonymized}</span>
            <span style={{color:'var(--text3)'}}>·</span>
            <span className="font-mono font-bold" style={{color:'var(--teal)'}}>{task.needle_count}개</span>
            {task.department && (
              <>
                <span style={{color:'var(--text3)'}}>·</span>
                <span className="text-sm px-2 py-0.5 rounded-lg font-bold"
                      style={{background:'rgba(251,191,36,.1)',color:'var(--amber)'}}>{task.department}</span>
              </>
            )}
          </div>

          {/* 진행 정보 */}
          {task.in_progress_by_name && !task.completed_by_name && status !== 'paused' && (
            <div className="mt-2 flex items-center gap-1.5 text-sm" style={{color:'var(--blue)'}}>
              ▶ <b>{task.in_progress_by_name}</b>
              <span style={{color:'var(--text3)'}}>진행중 ({fmtTime(task.in_progress_at)} 시작)</span>
            </div>
          )}
          {/* 중단 정보 */}
          {status === 'paused' && (
            <div className="mt-2 flex items-center gap-1.5 text-sm" style={{color:'var(--purple)'}}>
              <Pause size={13}/>
              <span>중단됨</span>
              {task.paused_by_name && <b>{task.paused_by_name}</b>}
              {task.pause_reason && <span style={{color:'var(--text3)'}}>— {task.pause_reason}</span>}
            </div>
          )}
          {/* 완료 */}
          {task.completed_by_name && (
            <div className="mt-2 flex items-center gap-1.5 text-sm" style={{color:'var(--green)'}}>
              ✓ <b>{task.completed_by_name}</b>
              <span style={{color:'var(--text3)'}}>완료 {fmtTime(task.completed_at)}</span>
            </div>
          )}
          {task.delay_reason && (
            <div className="mt-2 flex items-center gap-1.5 text-sm" style={{color:'var(--orange)'}}>
              <AlertTriangle size={13}/>{task.delay_reason}
            </div>
          )}
          {task.memo && (
            <div className="mt-2 text-xs rounded-xl px-3 py-2"
                 style={{background:'rgba(255,255,255,.04)',color:'var(--text2)'}}>
              📝 {task.memo}
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        {canAct && (
          <div className="px-4 pb-4 space-y-2">
            <div className="flex gap-2">
              {/* 발침 시작 / 이어받기 */}
              {(status==='scheduled' || status==='paused' || isOverdue) && (
                <button onClick={()=>act('in_progress')} disabled={busy}
                        className="btn btn-blue btn-lg flex-1">
                  <Play size={18} fill="currentColor"/>
                  {status==='paused' ? '이어서 발침' : '발침 시작'}
                </button>
              )}

              {/* 발침 완료 */}
              {(status==='in_progress' || status==='delayed') && (
                <button onClick={()=>act('completed')} disabled={busy}
                        className="btn btn-green btn-lg flex-1">
                  <CheckCircle2 size={18}/>발침 완료
                </button>
              )}

              {/* 중단 버튼 (진행중일 때만) */}
              {status==='in_progress' && (
                <button onClick={()=>setPauseModal(true)} disabled={busy}
                        className="btn btn-purple btn-lg px-4" title="중단">
                  <Pause size={18}/>
                </button>
              )}

              {/* 지연 버튼 */}
              {status!=='completed' && status!=='paused' && (
                <button onClick={()=>setDelayModal(true)} disabled={busy}
                        className="btn btn-orange btn-lg px-4" title="지연처리">
                  <AlertTriangle size={18}/>
                </button>
              )}
            </div>

            {/* 내가 이어받겠습니다 (중단된 경우) */}
            {status==='paused' && task.paused_by_name !== profile.name && (
              <button onClick={()=>act('in_progress')} disabled={busy}
                      className="btn btn-teal w-full py-3 text-sm">
                <UserCheck size={16}/>내가 이어받겠습니다
              </button>
            )}
          </div>
        )}

        {/* 상세 토글 */}
        <button onClick={()=>setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-1 py-2 text-xs"
                style={{color:'var(--text3)',borderTop:'1px solid var(--bg2)'}}>
          {expanded?<><ChevronUp size={12}/>접기</>:<><ChevronDown size={12}/>상세</>}
        </button>

        {expanded && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-1.5 text-xs anim-up" style={{color:'var(--text2)'}}>
            <div><span style={{color:'var(--text3)'}}>등록자 </span>{task.created_by_name}</div>
            <div><span style={{color:'var(--text3)'}}>진료과 </span>{task.department||'—'}</div>
            {task.in_progress_by_name && (
              <div className="col-span-2">
                <span style={{color:'var(--text3)'}}>진행시작 </span>
                <span style={{color:'var(--blue)'}}>{task.in_progress_by_name} {fmtTime(task.in_progress_at)}</span>
              </div>
            )}
            {task.completed_by_name && (
              <div className="col-span-2">
                <span style={{color:'var(--text3)'}}>완료처리 </span>
                <span style={{color:'var(--green)'}}>{task.completed_by_name} {fmtTime(task.completed_at)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {delayModal && <DelayModal onConfirm={r=>{setDelayModal(false);act('delayed',{delayReason:r,alreadyInProgress:!!task.in_progress_by})}} onClose={()=>setDelayModal(false)}/>}
      {pauseModal && <PauseModal onConfirm={r=>{setPauseModal(false);act('paused',{pauseReason:r})}} onClose={()=>setPauseModal(false)}/>}
    </>
  )
}
