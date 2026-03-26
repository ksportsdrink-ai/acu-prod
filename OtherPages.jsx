import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Download, UserPlus, Trash2, Pencil, X } from 'lucide-react'
import { useTasks } from '../context/TaskContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchTasks, fetchAvailableDates, calcStats } from '../services/tasks.js'
import { getAllProfiles, updateProfile } from '../services/auth.js'
import { StatusBadge, FloorBadge, Spinner, Modal, toast } from '../components/ui.jsx'
import { fmtTime, fmtDateKr, todayKST, exportCSV, STATUS_LABEL, ROLE_LABEL, ROLE_COLOR } from '../utils/index.js'

/* ── 히스토리 ─────────────────────────────────────────── */
export function HistoryPage() {
  const { setDateStr } = useTasks()
  const [dates, setDates]   = useState([])
  const [sel, setSel]       = useState(todayKST())
  const [tasks, setTasks]   = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchAvailableDates().then(d => { setDates(d); if (d.length) setSel(d[0]) }) }, [])
  useEffect(() => {
    setLoading(true)
    fetchTasks(sel).then(t => { setTasks(t); setLoading(false) })
    setDateStr(sel)
  }, [sel, setDateStr])

  const stats = useMemo(() => calcStats(tasks), [tasks])
  const sorted = [...tasks].sort((a,b) => new Date(a.scheduled_time)-new Date(b.scheduled_time))
  const idx = dates.indexOf(sel)

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 py-3 border-b flex items-center justify-between"
           style={{ background: 'var(--bg1)', borderColor: 'var(--border)' }}>
        <div>
          <h1 className="font-bold text-base" style={{ color: 'var(--text1)' }}>일별 기록</h1>
          <p className="text-xs" style={{ color: 'var(--text3)' }}>날짜별 발침 기록 조회</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => idx < dates.length-1 && setSel(dates[idx+1])} disabled={idx >= dates.length-1}
                  className="btn btn-ghost p-2 disabled:opacity-30"><ChevronLeft size={15}/></button>
          <select className="inp text-sm py-1.5 w-auto" style={{ background: 'var(--bg2)', minWidth: 130 }}
                  value={sel} onChange={e => setSel(e.target.value)}>
            {dates.map(d => <option key={d} value={d}>{d}{d===todayKST()?' (오늘)':''}</option>)}
          </select>
          <button onClick={() => idx > 0 && setSel(dates[idx-1])} disabled={idx <= 0}
                  className="btn btn-ghost p-2 disabled:opacity-30"><ChevronRight size={15}/></button>
        </div>
      </div>
      <div className="p-4">
        <h2 className="font-bold text-base mb-4" style={{ color: 'var(--text1)' }}>{fmtDateKr(sel)}</h2>
        <div className="grid grid-cols-5 gap-2 mb-4">
          {[
            {l:'전체',v:stats.total,c:'var(--text2)'},
            {l:'완료',v:stats.completed||0,c:'var(--green)'},
            {l:'지연',v:stats.delayed||0,c:'var(--red)'},
            {l:'미완료',v:(stats.scheduled||0)+(stats.in_progress||0),c:'var(--amber)'},
            {l:'총침수',v:stats.needles,c:'var(--teal)',s:'개'},
          ].map(s => (
            <div key={s.l} className="card p-2.5 text-center" style={{ background: 'var(--bg1)' }}>
              <div className="font-mono font-bold text-xl" style={{ color: s.c }}>{s.v}{s.s||''}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>{s.l}</div>
            </div>
          ))}
        </div>
        {loading ? <Spinner /> : sorted.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--text3)' }}>해당 날짜의 기록이 없습니다</div>
        ) : (
          <div className="space-y-2">
            {sorted.map(t => (
              <div key={t.id} className={`card p-4 space-y-2 ${t.status==='completed'?'opacity-55':''}`}
                   style={{ background: 'var(--bg1)', borderLeft: t.status==='delayed'?'2px solid var(--red)': t.status==='in_progress'?'2px solid var(--blue)':'1px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-lg" style={{ color: 'var(--teal)' }}>{fmtTime(t.scheduled_time)}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="font-bold">{t.room}호</span>
                  <FloorBadge floor={t.floor} />
                  <span style={{ color: 'var(--text3)' }}>·</span>
                  <span className="font-bold">{t.patient_anonymized}</span>
                  <span style={{ color: 'var(--text3)' }}>·</span>
                  <span className="font-mono font-bold" style={{ color: 'var(--teal)' }}>{t.needle_count}개</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs" style={{ color: 'var(--text2)' }}>
                  {t.in_progress_by_name && (
                    <div><span style={{ color: 'var(--text3)' }}>진행 </span>
                      <span style={{ color: 'var(--blue)' }}>{t.in_progress_by_name} {fmtTime(t.in_progress_at)}</span>
                    </div>
                  )}
                  {t.completed_by_name && (
                    <div><span style={{ color: 'var(--text3)' }}>완료 </span>
                      <span style={{ color: 'var(--green)' }}>{t.completed_by_name} {fmtTime(t.completed_at)}</span>
                    </div>
                  )}
                  {t.delay_reason && (
                    <div className="col-span-2" style={{ color: 'var(--orange)' }}>⚠ {t.delay_reason}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── 통계 ─────────────────────────────────────────────── */
function Bar({ label, val, max, color }) {
  const pct = max > 0 ? (val / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-20 text-right truncate" style={{ color: 'var(--text2)' }}>{label}</span>
      <div className="flex-1 rounded-full h-2" style={{ background: 'var(--bg3)' }}>
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono text-xs font-bold w-6 text-right" style={{ color }}>{val}</span>
    </div>
  )
}

export function AnalyticsPage() {
  const { tasks, dateStr } = useTasks()
  const s = useMemo(() => calcStats(tasks), [tasks])
  const fMax = Math.max(...Object.values(s.byFloor||{}), 1)
  const dMax = Math.max(...Object.values(s.byDoctor||{}), 1)
  const cr = s.total > 0 ? Math.round((s.completed/s.total)*100) : 0
  const dr = s.total > 0 ? Math.round((s.delayed/s.total)*100) : 0

  return (
    <div className="flex-1 overflow-auto p-4">
      <h1 className="font-bold text-lg mb-1" style={{ color: 'var(--text1)' }}>통계</h1>
      <p className="text-xs mb-5" style={{ color: 'var(--text3)' }}>{fmtDateKr(dateStr)} 기준</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          {l:'총 발침건',v:s.total,c:'var(--text1)'},
          {l:'발침완료',v:s.completed||0,c:'var(--green)'},
          {l:'완료율',v:`${cr}%`,c:'var(--teal)'},
          {l:'총 침수',v:`${s.needles}개`,c:'var(--blue)'},
        ].map(k => (
          <div key={k.l} className="card p-4 text-center" style={{ background: 'var(--bg1)' }}>
            <div className="font-mono font-bold text-2xl" style={{ color: k.c }}>{k.v}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text3)' }}>{k.l}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4" style={{ background: 'var(--bg1)' }}>
          <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text1)' }}>상태 분포</h3>
          <div className="flex flex-wrap gap-2">
            {[
              {l:'예정',v:s.scheduled||0,c:'var(--amber)'},
              {l:'진행중',v:s.in_progress||0,c:'var(--blue)'},
              {l:'지연',v:s.delayed||0,c:'var(--red)'},
              {l:'완료',v:s.completed||0,c:'var(--green)'},
            ].map(x => (
              <div key={x.l} className="flex-1 min-w-[55px] text-center py-2 rounded-xl"
                   style={{ background: `${x.c}10`, border: `1px solid ${x.c}20` }}>
                <div className="font-mono font-bold text-xl" style={{ color: x.c }}>{x.v}</div>
                <div className="text-[10px]" style={{ color: x.c }}>{x.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4" style={{ background: 'var(--bg1)' }}>
          <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text1)' }}>층별 발침건수</h3>
          <div className="space-y-2.5">
            {Object.entries(s.byFloor||{}).map(([f,v]) => (
              <Bar key={f} label={f} val={v} max={fMax}
                   color={f==='5층'?'var(--amber)':f==='6층'?'var(--blue)':'var(--purple)'} />
            ))}
          </div>
        </div>
        <div className="card p-4" style={{ background: 'var(--bg1)' }}>
          <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text1)' }}>의사별 발침건수</h3>
          <div className="space-y-2.5">
            {Object.entries(s.byDoctor||{}).map(([d,v]) => (
              <Bar key={d} label={d} val={v} max={dMax} color="var(--teal)" />
            ))}
          </div>
        </div>
      </div>
      <div className="card p-4 mt-4" style={{ background: 'var(--bg1)' }}>
        <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text1)' }}>지연 분석</h3>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="font-mono font-bold text-3xl" style={{ color: 'var(--orange)' }}>{dr}%</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text3)' }}>지연율</div>
          </div>
          <div>
            <div className="font-mono font-bold text-3xl" style={{ color: cr>=80?'var(--green)':'var(--red)' }}>{cr}%</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text3)' }}>완료율</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── 내보내기 ─────────────────────────────────────────── */
export function ExportPage() {
  const { tasks, dateStr } = useTasks()
  const [dates, setDates] = useState([])
  const [sel, setSel] = useState(dateStr)
  const [selTasks, setSelTasks] = useState([])
  const stats = useMemo(() => calcStats(selTasks), [selTasks])

  useEffect(() => { fetchAvailableDates().then(setDates) }, [])
  useEffect(() => { fetchTasks(sel).then(setSelTasks) }, [sel])

  function doExport() {
    if (!selTasks.length) { toast('내보낼 기록이 없습니다','warning'); return }
    exportCSV(selTasks, sel)
    toast(`📥 CSV 내보내기 완료 (${selTasks.length}건)`, 'success')
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <h1 className="font-bold text-lg mb-1" style={{ color: 'var(--text1)' }}>기록 내보내기</h1>
      <p className="text-xs mb-5" style={{ color: 'var(--text3)' }}>CSV · EMR 수동 입력용 · 환자명 익명화</p>
      <div className="card p-5 max-w-md space-y-4" style={{ background: 'var(--bg1)' }}>
        <div>
          <label className="lbl">날짜 선택</label>
          <select className="inp" value={sel} onChange={e => setSel(e.target.value)}>
            {dates.map(d => <option key={d} value={d}>{d}{d===todayKST()?' (오늘)':''}</option>)}
          </select>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg2)' }}>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[{l:'총건수',v:stats.total},{l:'완료',v:stats.completed||0},{l:'총침수',v:stats.needles,s:'개'}].map(s => (
              <div key={s.l}>
                <div className="font-mono font-bold text-xl" style={{ color: 'var(--teal)' }}>{s.v}{s.s||''}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs rounded-2xl p-3"
             style={{ background: 'rgba(77,159,255,.06)', color: 'var(--blue)', border: '1px solid rgba(77,159,255,.15)' }}>
          🔒 익명화된 환자명만 포함됩니다 (원본 미저장)
        </div>
        <button onClick={doExport} disabled={!selTasks.length}
                className="btn btn-teal w-full py-3.5 text-base">
          <Download size={17} />CSV 내보내기 ({selTasks.length}건)
        </button>
      </div>
    </div>
  )
}

/* ── 사용자 관리 ──────────────────────────────────────── */
export function UsersPage() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(null)
  const { profile: me } = useAuth()

  useEffect(() => {
    getAllProfiles().then(p => { setProfiles(p); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function saveEdit(updates) {
    try {
      await updateProfile(editing.id, updates)
      setProfiles(p => p.map(x => x.id === editing.id ? {...x,...updates} : x))
      setEditing(null)
      toast('프로필 업데이트 완료', 'success')
    } catch (e) { toast('업데이트 실패: ' + e.message, 'error') }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 py-3 border-b" style={{ background: 'var(--bg1)', borderColor: 'var(--border)' }}>
        <h1 className="font-bold text-base" style={{ color: 'var(--text1)' }}>사용자 관리</h1>
        <p className="text-xs" style={{ color: 'var(--text3)' }}>
          신규 계정은 Supabase 대시보드 Authentication → Users 에서 생성 후 여기서 역할/층 설정
        </p>
      </div>
      <div className="p-4 space-y-2">
        {loading ? <Spinner /> : profiles.map(p => (
          <div key={p.id} className="card p-4 flex items-center gap-3" style={{ background: 'var(--bg1)' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                 style={{ background: `${ROLE_COLOR[p.role]}15`, color: ROLE_COLOR[p.role] }}>
              {p.name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm" style={{ color: 'var(--text1)' }}>{p.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: `${ROLE_COLOR[p.role]}12`, color: ROLE_COLOR[p.role] }}>
                  {ROLE_LABEL[p.role]}
                </span>
                {!p.is_active && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,87,87,.1)', color: 'var(--red)' }}>비활성</span>
                )}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                {p.email} · {p.accessible_floors?.join(', ')}
              </div>
            </div>
            {me.role === 'superadmin' && p.id !== me.id && (
              <button onClick={() => setEditing(p)} className="btn btn-ghost p-2">
                <Pencil size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {editing && <EditProfileModal profile={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
    </div>
  )
}

function EditProfileModal({ profile, onSave, onClose }) {
  const [form, setForm] = useState({
    name: profile.name,
    role: profile.role,
    department: profile.department || '',
    accessible_floors: profile.accessible_floors || [],
    is_active: profile.is_active,
  })
  function setF(k,v) { setForm(f=>({...f,[k]:v})) }
  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="font-bold" style={{ color: 'var(--text1)' }}>프로필 수정</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10"><X size={15}/></button>
      </div>
      <div className="p-4 space-y-3">
        <div><label className="lbl">이름</label>
          <input className="inp" value={form.name} onChange={e=>setF('name',e.target.value)}/></div>
        <div><label className="lbl">역할</label>
          <select className="inp" value={form.role} onChange={e=>setF('role',e.target.value)}>
            {Object.entries(ROLE_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label className="lbl">진료과</label>
          <input className="inp" value={form.department} onChange={e=>setF('department',e.target.value)}/></div>
        <div>
          <label className="lbl">접근 층</label>
          <div className="flex gap-4 mt-1">
            {['5층','6층','7층'].map(f => (
              <label key={f} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.accessible_floors.includes(f)}
                  onChange={e => setF('accessible_floors', e.target.checked
                    ? [...form.accessible_floors, f]
                    : form.accessible_floors.filter(x=>x!==f))}
                  style={{ accentColor: 'var(--teal)', width: 16, height: 16 }} />
                <span className="text-sm">{f}</span>
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={e=>setF('is_active',e.target.checked)}
                 style={{ accentColor: 'var(--teal)', width: 16, height: 16 }} />
          <span className="text-sm">계정 활성화</span>
        </label>
      </div>
      <div className="p-4 flex gap-2">
        <button onClick={() => onSave(form)} className="btn btn-teal flex-1 py-3">저장</button>
        <button onClick={onClose} className="btn btn-ghost flex-1 py-3">취소</button>
      </div>
    </Modal>
  )
}

/* ── 주치의(레지던트) 관리 ──────────────────────────── */
import { getResidents, upsertResident, deleteResident } from '../services/tasks.js'
import { DEPTS } from '../utils/index.js'
import { Bell, Trash2 as Trash } from 'lucide-react'

export function ResidentsPage() {
  const [residents, setResidents] = useState([])
  const [editDept, setEditDept]   = useState('')
  const [editName, setEditName]   = useState('')
  const [saving, setSaving]       = useState(false)
  const { profile } = useAuth()

  useEffect(()=>{ load() },[])
  async function load() {
    const data = await getResidents().catch(()=>[])
    setResidents(data)
  }

  async function save() {
    if(!editDept||!editName.trim()){toast('과와 이름을 입력하세요','error');return}
    setSaving(true)
    try {
      await upsertResident(editDept, editName.trim(), profile)
      toast(`${editDept} 주치의 등록 완료`,'success')
      setEditDept(''); setEditName('')
      load()
    } catch(e) { toast('저장 실패: '+e.message,'error') }
    finally { setSaving(false) }
  }

  async function del(dept) {
    if(!confirm(`${dept} 주치의를 삭제하시겠습니까?`)) return
    await deleteResident(dept).catch(()=>{})
    toast('삭제됨','warning')
    load()
  }

  const residentMap = {}
  residents.forEach(r=>{ residentMap[r.department]=r.name })

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 py-3 border-b" style={{background:'var(--bg1)',borderColor:'var(--border)'}}>
        <h1 className="font-bold text-base flex items-center gap-2" style={{color:'var(--text1)'}}>
          <Bell size={16} style={{color:'var(--amber)'}}/>주치의 관리
        </h1>
        <p className="text-xs" style={{color:'var(--text3)'}}>
          5분 이상 발침 지연 시 해당 과 주치의에게 브라우저 알림이 발송됩니다
        </p>
      </div>

      <div className="p-4 max-w-lg space-y-5">
        {/* 등록 폼 */}
        <div className="card p-4 space-y-3" style={{background:'var(--bg1)'}}>
          <h3 className="font-bold text-sm" style={{color:'var(--text1)'}}>주치의 등록 / 수정</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="lbl">진료과</label>
              <select className="inp" value={editDept} onChange={e=>setEditDept(e.target.value)}>
                <option value="">과 선택</option>
                {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">주치의 이름</label>
              <input className="inp" value={editName} onChange={e=>setEditName(e.target.value)}
                     placeholder="예: 김레지던트" onKeyDown={e=>e.key==='Enter'&&save()}/>
            </div>
          </div>
          <button onClick={save} disabled={saving} className="btn btn-teal w-full py-3">
            {saving?'저장 중...':'등록 / 수정'}
          </button>
        </div>

        {/* 현재 주치의 목록 */}
        <div className="card p-4" style={{background:'var(--bg1)'}}>
          <h3 className="font-bold text-sm mb-3" style={{color:'var(--text1)'}}>등록된 주치의</h3>
          {DEPTS.map(d=>{
            const name = residentMap[d]
            return (
              <div key={d} className="flex items-center justify-between py-2.5 border-b last:border-0"
                   style={{borderColor:'var(--border)'}}>
                <div className="flex items-center gap-3">
                  <span className="w-12 text-xs font-bold px-2 py-1 rounded-lg text-center"
                        style={{background:'rgba(251,191,36,.1)',color:'var(--amber)'}}>{d}</span>
                  {name
                    ? <span className="text-sm font-semibold" style={{color:'var(--text1)'}}>{name}</span>
                    : <span className="text-sm" style={{color:'var(--text3)'}}>미등록</span>
                  }
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>{setEditDept(d);setEditName(name||'')}}
                          className="btn btn-ghost px-3 py-1.5 text-xs">
                    {name?'수정':'등록'}
                  </button>
                  {name && (
                    <button onClick={()=>del(d)}
                            className="p-2 rounded-xl transition-all"
                            style={{color:'var(--red)'}}
                            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,87,87,.1)'}
                            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <Trash size={14}/>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="text-xs rounded-2xl p-3"
             style={{background:'rgba(251,191,36,.06)',color:'var(--amber)',border:'1px solid rgba(251,191,36,.2)'}}>
          💡 알림은 해당 주치의가 시스템에 로그인된 브라우저에서 수신됩니다.
          실제 SMS/카카오 알림은 추후 연동 예정입니다.
        </div>
      </div>
    </div>
  )
}
