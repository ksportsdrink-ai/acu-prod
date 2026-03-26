import { useState, useMemo, useEffect, useRef } from 'react'
import { RefreshCw, Plus, Download, AlertTriangle, Bell, Pause, UserCheck } from 'lucide-react'
import { useTasks } from '../context/TaskContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { can, canAccessFloor } from '../services/auth.js'
import { updateTaskStatus, getResidents } from '../services/tasks.js'
import { exportCSV, DEPTS, sendNotification, requestNotificationPermission } from '../utils/index.js'
import { StatusBadge, FloorBadge, Spinner, toast, DelayModal, PauseModal } from '../components/ui.jsx'
import TaskCard from '../components/TaskCard.jsx'
import { fmtTime, fmtDateKr, minDiff, STATUS_LABEL } from '../utils/index.js'
import { useNavigate } from 'react-router-dom'

const FLOORS = ['전체','5층','6층','7층']

export default function DashboardPage() {
  const { tasks, refresh, loading, dateStr, stats, optimistic } = useTasks()
  const { profile } = useAuth()
  const nav = useNavigate()

  const [floor, setFloor]     = useState('전체')
  const [deptF, setDeptF]     = useState('전체')
  const [statusF, setStatusF] = useState('all')
  const [delayTarget, setDelayTarget] = useState(null)
  const [pauseTarget, setPauseTarget] = useState(null)
  const [busy, setBusy] = useState(null)
  const [residents, setResidents] = useState({})  // { dept: name }
  const notifiedRef = useRef(new Set()) // 이미 알림 보낸 task id

  // 주치의 로드
  useEffect(() => {
    getResidents().then(list => {
      const map = {}
      list.forEach(r => { map[r.department] = r.name })
      setResidents(map)
    }).catch(()=>{})
  }, [])

  // 알림 권한 요청 (한 번)
  useEffect(() => { requestNotificationPermission() }, [])

  // 5분 이상 지연 → 주치의 알림
  useEffect(() => {
    tasks.forEach(t => {
      if (t.status === 'completed') return
      const d = minDiff(t.scheduled_time)
      if (d >= 5 && !notifiedRef.current.has(t.id)) {
        notifiedRef.current.add(t.id)
        const resident = residents[t.department]
        if (resident) {
          sendNotification(
            `⚠️ 발침 지연 알림 [${t.department}]`,
            `${t.room}호 ${t.patient_anonymized} — ${d}분 초과\n주치의: ${resident}`,
            `overdue_${t.id}`
          )
          toast(`🔔 [${t.department}] ${t.room}호 발침 ${d}분 초과 — 주치의 ${resident} 알림`, 'error', 6000)
        }
      }
    })
  }, [tasks, residents])

  // 과별 필터 목록 (오늘 있는 과만)
  const activeDepts = useMemo(() => {
    const s = new Set(tasks.map(t=>t.department).filter(Boolean))
    return ['전체', ...DEPTS.filter(d=>s.has(d))]
  }, [tasks])

  const filtered = useMemo(() =>
    tasks.filter(t => {
      if (!canAccessFloor(profile, t.floor)) return false
      if (floor !== '전체' && t.floor !== floor) return false
      if (deptF !== '전체' && t.department !== deptF) return false
      if (statusF !== 'all' && t.status !== statusF) return false
      return true
    }).sort((a,b)=>new Date(a.scheduled_time)-new Date(b.scheduled_time))
  , [tasks,floor,deptF,statusF,profile])

  // 지연 건수 (경고 배너용)
  const overdueCount = useMemo(()=>
    tasks.filter(t=>t.status!=='completed'&&minDiff(t.scheduled_time)>=5).length
  ,[tasks])

  async function tableAct(task, newStatus, extra={}) {
    if (busy) return
    setBusy(task.id+newStatus)
    const now = new Date().toISOString()
    const opt = {status:newStatus}
    if (newStatus==='in_progress')  { opt.in_progress_by_name=profile.name; opt.in_progress_at=now; opt.paused_by_name=null }
    if (newStatus==='completed')    { opt.completed_by_name=profile.name; opt.completed_at=now }
    if (newStatus==='delayed')      { opt.delay_reason=extra.delayReason||'' }
    if (newStatus==='paused')       { opt.paused_by_name=profile.name; opt.paused_at=now; opt.pause_reason=extra.pauseReason||'' }
    optimistic(task.id, opt)
    try {
      await updateTaskStatus(task.id, newStatus, profile, extra)
      refresh()
      toast({in_progress:'▶ 진행',completed:'✅ 완료!',delayed:'⚠ 지연',paused:'⏸ 중단'}[newStatus]||'처리됨',
            newStatus==='completed'?'success':newStatus==='paused'?'warning':'info')
    } catch {
      optimistic(task.id,{status:task.status}); toast('오류 발생','error')
    } finally { setBusy(null) }
  }

  const STATUS_OPTS = [
    {v:'all',l:'전체'},{v:'scheduled',l:'예정'},{v:'in_progress',l:'진행중'},
    {v:'paused',l:'중단됨'},{v:'delayed',l:'지연'},{v:'completed',l:'완료'},
  ]

  return (
    <div className="flex flex-col h-full">
      {/* 상단 바 */}
      <div className="px-4 py-3 flex items-center justify-between shrink-0 border-b"
           style={{background:'var(--bg1)',borderColor:'var(--border)'}}>
        <div>
          <h1 className="text-base font-bold" style={{color:'var(--text1)'}}>대시보드</h1>
          <p className="text-xs" style={{color:'var(--text3)'}}>{fmtDateKr(dateStr)} · {stats.total}건</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="btn btn-ghost p-2"><RefreshCw size={15}/></button>
          {can(profile,'export') && (
            <button onClick={()=>exportCSV(tasks,dateStr)} className="btn btn-ghost p-2" style={{color:'var(--green)'}}>
              <Download size={15}/>
            </button>
          )}
          {can(profile,'createTask') && (
            <button onClick={()=>nav('/new')} className="btn btn-teal px-3 py-2 text-sm">
              <Plus size={15}/>등록
            </button>
          )}
        </div>
      </div>

      {/* 지연 경고 배너 */}
      {overdueCount > 0 && (
        <div className="mx-4 mt-3 alert-banner px-4 py-2.5 flex items-center gap-2.5">
          <AlertTriangle size={16} style={{color:'var(--red)'}}/>
          <span className="text-sm font-bold" style={{color:'var(--red)'}}>
            {overdueCount}건 발침 지연 중 — 즉시 확인 필요
          </span>
          <button onClick={()=>setStatusF('delayed')} className="ml-auto text-xs underline" style={{color:'var(--red)'}}>
            지연 건만 보기
          </button>
        </div>
      )}

      {/* 통계 */}
      <div className="grid grid-cols-5 shrink-0 border-b mt-3"
           style={{background:'var(--bg1)',borderColor:'var(--border)'}}>
        {[
          {l:'예정',   v:stats.scheduled||0,   c:'var(--amber)'},
          {l:'진행중', v:stats.in_progress||0,  c:'var(--blue)'},
          {l:'중단됨', v:stats.paused||0,        c:'var(--purple)'},
          {l:'완료',   v:stats.completed||0,    c:'var(--green)'},
          {l:'총침수', v:stats.needles||0,       c:'var(--teal)',s:'개'},
        ].map(s=>(
          <div key={s.l} className="text-center py-2.5 border-r last:border-r-0" style={{borderColor:'var(--border)'}}>
            <div className="font-mono font-bold text-xl" style={{color:s.c}}>{s.v}{s.s||''}</div>
            <div className="text-[10px] mt-0.5" style={{color:'var(--text3)'}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="shrink-0 border-b" style={{background:'var(--bg1)',borderColor:'var(--border)'}}>
        {/* 층 탭 */}
        <div className="flex gap-1.5 px-4 pt-2 pb-1 overflow-x-auto items-center">
          {FLOORS.map(f=>(
            <button key={f} onClick={()=>setFloor(f)}
              className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all"
              style={floor===f
                ?{background:'rgba(0,212,170,.15)',color:'var(--teal)',border:'1px solid rgba(0,212,170,.3)'}
                :{background:'transparent',color:'var(--text3)',border:'1px solid rgba(255,255,255,.05)'}}>
              {f}
            </button>
          ))}
          <div className="w-px h-4 shrink-0" style={{background:'var(--border)'}}/>
          {/* 과별 탭 */}
          {activeDepts.map(d=>(
            <button key={d} onClick={()=>setDeptF(d)}
              className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all"
              style={deptF===d
                ?{background:'rgba(251,191,36,.15)',color:'var(--amber)',border:'1px solid rgba(251,191,36,.3)'}
                :{background:'transparent',color:'var(--text3)',border:'1px solid rgba(255,255,255,.05)'}}>
              {d}
            </button>
          ))}
        </div>
        {/* 상태 필터 */}
        <div className="flex gap-1 px-4 pb-2 overflow-x-auto items-center">
          {STATUS_OPTS.map(o=>(
            <button key={o.v} onClick={()=>setStatusF(statusF===o.v?'all':o.v)}
              className="px-2.5 py-1 rounded-full text-xs whitespace-nowrap shrink-0 transition-all"
              style={statusF===o.v
                ?{background:'rgba(0,212,170,.12)',color:'var(--teal)'}
                :{color:'var(--text3)'}}>
              {o.l}
            </button>
          ))}
          <span className="ml-auto text-xs shrink-0" style={{color:'var(--text3)'}}>{filtered.length}건</span>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-auto">
        {loading ? <Spinner/> : filtered.length===0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p style={{color:'var(--text3)'}}>해당 작업이 없습니다</p>
            {can(profile,'createTask') && (
              <button onClick={()=>nav('/new')} className="btn btn-teal px-4 py-2 text-sm">
                <Plus size={14}/>신규 등록
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 모바일 카드 */}
            <div className="sm:hidden p-3 space-y-3">
              {filtered.map(t=>(
                <TaskCard key={t.id} task={t}
                  overdueResidentAlert={minDiff(t.scheduled_time)>=5 && t.status!=='completed' ? residents[t.department] : null}
                />
              ))}
            </div>

            {/* 데스크탑 테이블 */}
            <div className="hidden sm:block p-3">
              <div className="rounded-2xl overflow-hidden border" style={{borderColor:'var(--border)'}}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px]">
                    <thead>
                      <tr style={{background:'var(--bg0)',borderBottom:'1px solid var(--border)'}}>
                        {['시간','호실/층','환자','침수','진료과','등록자','상태','진행담당','진행시작','완료담당','완료시각','메모','처리'].map(h=>(
                          <th key={h} className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                              style={{color:'var(--text3)'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(t=>{
                        const d = minDiff(t.scheduled_time)
                        const isOD = t.status!=='completed'&&t.status!=='paused'&&d>=5
                        const dispSt = isOD&&t.status==='scheduled'?'delayed':t.status
                        const rowCls = isOD||t.status==='delayed'?'row-overdue':
                                       t.status==='paused'?'row-paused':
                                       t.status==='in_progress'?'row-in_progress':
                                       t.status==='completed'?'row-completed':''
                        return (
                          <tr key={t.id} className={`border-b transition-colors hover:bg-white/[0.02] ${rowCls}`}
                              style={{borderColor:'rgba(45,55,80,.5)'}}>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1">
                                {isOD && <AlertTriangle size={12} style={{color:'var(--red)'}}/>}
                                <span className="font-mono font-bold text-sm"
                                      style={{color:isOD?'var(--red)':t.status==='paused'?'var(--purple)':'var(--teal)'}}>
                                  {fmtTime(t.scheduled_time)}
                                </span>
                              </div>
                              {d>0&&t.status!=='completed'&&<div className="text-[10px] mt-0.5" style={{color:d>=5?'var(--red)':'var(--orange)'}}>+{d}분</div>}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-sm">{t.room}호</span>
                                <FloorBadge floor={t.floor}/>
                              </div>
                            </td>
                            <td className="px-3 py-3 font-bold text-sm">{t.patient_anonymized}</td>
                            <td className="px-3 py-3">
                              <span className="font-mono font-bold text-sm" style={{color:'var(--teal)'}}>{t.needle_count}개</span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="px-2 py-0.5 rounded-lg text-xs font-bold"
                                    style={{background:'rgba(251,191,36,.1)',color:'var(--amber)'}}>{t.department||'—'}</span>
                            </td>
                            <td className="px-3 py-3 text-sm" style={{color:'var(--text2)'}}>{t.created_by_name}</td>
                            <td className="px-3 py-3"><StatusBadge status={dispSt}/></td>
                            <td className="px-3 py-3 text-xs" style={{color:'var(--blue)'}}>{t.in_progress_by_name||'—'}</td>
                            <td className="px-3 py-3 text-xs font-mono" style={{color:'var(--blue)'}}>{fmtTime(t.in_progress_at)}</td>
                            <td className="px-3 py-3 text-xs" style={{color:'var(--green)'}}>{t.completed_by_name||'—'}</td>
                            <td className="px-3 py-3 text-xs font-mono" style={{color:'var(--green)'}}>{fmtTime(t.completed_at)}</td>
                            <td className="px-3 py-3 text-xs max-w-[80px]" style={{color:'var(--text2)'}}>
                              {t.pause_reason?<span style={{color:'var(--purple)'}}>⏸ {t.pause_reason}</span>:
                               t.delay_reason?<span style={{color:'var(--orange)'}}>⚠ {t.delay_reason}</span>:
                               t.memo||'—'}
                            </td>
                            <td className="px-3 py-3">
                              {can(profile,'updateStatus') && t.status!=='completed' && (
                                <div className="flex gap-1 flex-wrap">
                                  {(t.status==='scheduled'||t.status==='paused'||isOD) && (
                                    <button onClick={()=>tableAct(t,'in_progress')} disabled={!!busy}
                                            className="btn btn-blue px-2.5 py-1.5 text-xs">
                                      {t.status==='paused'?'이어받기':'▶'}
                                    </button>
                                  )}
                                  {(t.status==='in_progress'||t.status==='delayed') && (
                                    <button onClick={()=>tableAct(t,'completed')} disabled={!!busy}
                                            className="btn btn-green px-2.5 py-1.5 text-xs">✓완료</button>
                                  )}
                                  {t.status==='in_progress' && (
                                    <button onClick={()=>setPauseTarget(t)} disabled={!!busy}
                                            className="btn btn-purple px-2 py-1.5 text-xs" title="중단">
                                      <Pause size={12}/>
                                    </button>
                                  )}
                                  {t.status!=='paused' && (
                                    <button onClick={()=>setDelayTarget(t)} disabled={!!busy}
                                            className="btn btn-orange px-2 py-1.5 text-xs" title="지연">
                                      <AlertTriangle size={12}/>
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {delayTarget && (
        <DelayModal
          onConfirm={r=>{ tableAct(delayTarget,'delayed',{delayReason:r,alreadyInProgress:!!delayTarget.in_progress_by}); setDelayTarget(null) }}
          onClose={()=>setDelayTarget(null)}
        />
      )}
      {pauseTarget && (
        <PauseModal
          onConfirm={r=>{ tableAct(pauseTarget,'paused',{pauseReason:r}); setPauseTarget(null) }}
          onClose={()=>setPauseTarget(null)}
        />
      )}
    </div>
  )
}
