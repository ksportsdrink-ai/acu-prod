import { useState, useMemo } from 'react'
import { RefreshCw, Plus, Download, AlertTriangle } from 'lucide-react'
import { useTasks } from '../context/TaskContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { can, canAccessFloor } from '../services/auth.js'
import { updateTaskStatus, deleteTask } from '../services/tasks.js'
import { exportCSV } from '../utils/index.js'
import { StatusBadge, FloorBadge, Spinner, toast, DelayModal } from '../components/ui.jsx'
import TaskCard from '../components/TaskCard.jsx'
import { fmtTime, fmtDateKr, minDiff, STATUS_LABEL } from '../utils/index.js'
import { useNavigate } from 'react-router-dom'

const FLOORS = ['전체', '5층', '6층', '7층']
const STATUS_FILTERS = [
  { v: 'all',         l: '전체' },
  { v: 'scheduled',   l: '예정' },
  { v: 'in_progress', l: '진행중' },
  { v: 'delayed',     l: '지연' },
  { v: 'completed',   l: '완료' },
]

export default function DashboardPage() {
  const { tasks, refresh, loading, dateStr, stats, optimistic } = useTasks()
  const { profile } = useAuth()
  const nav = useNavigate()
  const [floor, setFloor]   = useState('전체')
  const [statusF, setStatusF] = useState('all')
  const [delayTarget, setDelayTarget] = useState(null)
  const [busy, setBusy] = useState(null)

  // 접근 가능 층 필터 + 상태 필터
  const filtered = useMemo(() =>
    tasks.filter(t => {
      if (!canAccessFloor(profile, t.floor)) return false
      if (floor !== '전체' && t.floor !== floor) return false
      if (statusF !== 'all' && t.status !== statusF) return false
      return true
    }).sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time))
  , [tasks, floor, statusF, profile])

  async function tableAct(task, newStatus, extra = {}) {
    if (busy) return
    setBusy(task.id + newStatus)
    const now = new Date().toISOString()
    const opt = { status: newStatus }
    if (newStatus === 'in_progress')  { opt.in_progress_by_name = profile.name; opt.in_progress_at = now }
    if (newStatus === 'completed')    { opt.completed_by_name = profile.name; opt.completed_at = now }
    if (newStatus === 'delayed')      { opt.delay_reason = extra.delayReason || '' }
    optimistic(task.id, opt)
    try {
      await updateTaskStatus(task.id, newStatus, profile, extra)
      refresh()
      toast({ in_progress:'▶ 진행 시작', completed:'✅ 완료!', delayed:'⚠ 지연 처리' }[newStatus] || '처리됨',
             newStatus === 'completed' ? 'success' : 'info')
    } catch {
      optimistic(task.id, { status: task.status })
      toast('오류 발생', 'error')
    } finally { setBusy(null) }
  }

  function doExport() {
    if (!tasks.length) { toast('내보낼 기록이 없습니다', 'warning'); return }
    exportCSV(tasks, dateStr)
    toast(`📥 CSV 내보내기 완료 (${tasks.length}건)`, 'success')
  }

  return (
    <div className="flex flex-col h-full">
      {/* 상단 바 */}
      <div className="px-4 py-3 flex items-center justify-between shrink-0 border-b"
           style={{ background: 'var(--bg1)', borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-base font-bold" style={{ color: 'var(--text1)' }}>대시보드</h1>
          <p className="text-xs" style={{ color: 'var(--text3)' }}>{fmtDateKr(dateStr)} · {stats.total}건</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="btn btn-ghost p-2"><RefreshCw size={15} /></button>
          {can(profile, 'export') && (
            <button onClick={doExport} className="btn btn-ghost p-2" style={{ color: 'var(--green)' }}>
              <Download size={15} />
            </button>
          )}
          {can(profile, 'createTask') && (
            <button onClick={() => nav('/new')} className="btn btn-teal px-3 py-2 text-sm">
              <Plus size={15} />등록
            </button>
          )}
        </div>
      </div>

      {/* 통계 스트립 */}
      <div className="grid grid-cols-5 shrink-0 border-b"
           style={{ background: 'var(--bg1)', borderColor: 'var(--border)' }}>
        {[
          { l:'예정',    v: stats.scheduled   || 0, c: 'var(--amber)' },
          { l:'진행중',  v: stats.in_progress  || 0, c: 'var(--blue)' },
          { l:'지연',    v: stats.delayed      || 0, c: 'var(--red)' },
          { l:'완료',    v: stats.completed    || 0, c: 'var(--green)' },
          { l:'총침수',  v: stats.needles      || 0, c: 'var(--teal)', s: '개' },
        ].map(s => (
          <div key={s.l} className="text-center py-2.5 border-r last:border-r-0"
               style={{ borderColor: 'var(--border)' }}>
            <div className="font-mono font-bold text-xl" style={{ color: s.c }}>{s.v}{s.s||''}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex gap-1.5 px-4 py-2 overflow-x-auto shrink-0 border-b items-center"
           style={{ background: 'var(--bg1)', borderColor: 'var(--border)' }}>
        {FLOORS.map(f => (
          <button key={f} onClick={() => setFloor(f)}
            className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all"
            style={floor === f
              ? { background: 'rgba(0,212,170,.15)', color: 'var(--teal)', border: '1px solid rgba(0,212,170,.3)' }
              : { background: 'transparent', color: 'var(--text3)', border: '1px solid rgba(255,255,255,.05)' }}>
            {f}
          </button>
        ))}
        <div className="w-px h-4 shrink-0" style={{ background: 'var(--border)' }} />
        {STATUS_FILTERS.map(o => (
          <button key={o.v} onClick={() => setStatusF(statusF === o.v ? 'all' : o.v)}
            className="px-2.5 py-1 rounded-full text-xs whitespace-nowrap shrink-0 transition-all"
            style={statusF === o.v
              ? { background: 'rgba(0,212,170,.12)', color: 'var(--teal)' }
              : { color: 'var(--text3)' }}>
            {o.l}
          </button>
        ))}
        <span className="ml-auto text-xs shrink-0" style={{ color: 'var(--text3)' }}>{filtered.length}건</span>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-auto">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p style={{ color: 'var(--text3)' }}>해당 작업이 없습니다</p>
            {can(profile, 'createTask') && (
              <button onClick={() => nav('/new')} className="btn btn-teal px-4 py-2 text-sm">
                <Plus size={14} />신규 등록
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 모바일 카드 (< sm) */}
            <div className="sm:hidden p-3 space-y-3">
              {filtered.map(t => <TaskCard key={t.id} task={t} />)}
            </div>

            {/* 데스크탑 테이블 */}
            <div className="hidden sm:block p-3">
              <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px]">
                    <thead>
                      <tr style={{ background: 'var(--bg0)', borderBottom: '1px solid var(--border)' }}>
                        {['시간','호실/층','환자','침수','의사','상태','진행담당','진행시작','완료담당','완료시각','지연사유','처리'].map(h => (
                          <th key={h} className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                              style={{ color: 'var(--text3)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(t => {
                        const isOD = t.status !== 'completed' && minDiff(t.scheduled_time) >= 5 && t.status === 'scheduled'
                        const dispSt = isOD ? 'delayed' : t.status
                        return (
                          <tr key={t.id}
                              className={`border-b transition-colors hover:bg-white/[0.02] ${t.status==='completed'?'opacity-55':''} ${isOD||t.status==='delayed'?'row-delayed':''} ${t.status==='in_progress'?'row-in_progress':''}`}
                              style={{ borderColor: 'rgba(45,55,80,.5)' }}>
                            <td className="px-3 py-3">
                              <span className="font-mono font-bold text-sm"
                                    style={{ color: isOD||t.status==='delayed'?'var(--red)':'var(--teal)' }}>
                                {fmtTime(t.scheduled_time)}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-sm">{t.room}호</span>
                                <FloorBadge floor={t.floor} />
                              </div>
                            </td>
                            <td className="px-3 py-3 font-bold text-sm">{t.patient_anonymized}</td>
                            <td className="px-3 py-3">
                              <span className="font-mono font-bold text-sm" style={{ color: 'var(--teal)' }}>{t.needle_count}개</span>
                            </td>
                            <td className="px-3 py-3 text-sm" style={{ color: 'var(--text2)' }}>{t.created_by_name}</td>
                            <td className="px-3 py-3"><StatusBadge status={dispSt} /></td>
                            <td className="px-3 py-3 text-xs" style={{ color: 'var(--blue)' }}>{t.in_progress_by_name || '—'}</td>
                            <td className="px-3 py-3 text-xs font-mono" style={{ color: 'var(--blue)' }}>{fmtTime(t.in_progress_at)}</td>
                            <td className="px-3 py-3 text-xs" style={{ color: 'var(--green)' }}>{t.completed_by_name || '—'}</td>
                            <td className="px-3 py-3 text-xs font-mono" style={{ color: 'var(--green)' }}>{fmtTime(t.completed_at)}</td>
                            <td className="px-3 py-3 text-xs max-w-[90px]" style={{ color: 'var(--orange)' }}>{t.delay_reason || '—'}</td>
                            <td className="px-3 py-3">
                              {can(profile, 'updateStatus') && t.status !== 'completed' && (
                                <div className="flex gap-1">
                                  {(t.status === 'scheduled' || isOD) && (
                                    <button onClick={() => tableAct(t, 'in_progress')} disabled={!!busy}
                                            className="btn btn-blue px-2.5 py-1.5 text-xs">▶</button>
                                  )}
                                  {(t.status === 'in_progress' || t.status === 'delayed') && (
                                    <button onClick={() => tableAct(t, 'completed')} disabled={!!busy}
                                            className="btn btn-green px-2.5 py-1.5 text-xs">✓완료</button>
                                  )}
                                  <button onClick={() => setDelayTarget(t)} disabled={!!busy}
                                          className="btn btn-orange px-2 py-1.5 text-xs" title="지연처리">
                                    <AlertTriangle size={12} />
                                  </button>
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
          onConfirm={r => {
            tableAct(delayTarget, 'delayed', { delayReason: r, alreadyInProgress: !!delayTarget.in_progress_by })
            setDelayTarget(null)
          }}
          onClose={() => setDelayTarget(null)}
        />
      )}
    </div>
  )
}
