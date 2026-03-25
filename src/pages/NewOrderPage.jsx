import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Zap, Plus } from 'lucide-react'
import { createTask } from '../services/tasks.js'
import { useTasks } from '../context/TaskContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { parseQuickInput, anonymize, detectFloor, validRoom, fmtTime, pad } from '../utils/index.js'
import { FloorBadge, toast } from '../components/ui.jsx'

const DEPTS = ['한방신경과','한방내과','한방재활의학과','침구과','기타']

export default function NewOrderPage() {
  const { profile } = useAuth()
  const { refresh } = useTasks()
  const nav = useNavigate()
  const [mode, setMode] = useState('fast')

  // fast input
  const [raw, setRaw]       = useState('')
  const [preview, setPreview] = useState(null)
  const [fastErr, setFastErr] = useState('')
  const [baseHour, setBaseHour] = useState(new Date().getHours())

  // manual form
  const now = new Date()
  const [form, setForm] = useState({
    h: pad(now.getHours()), m: pad(now.getMinutes()),
    room: '', name: '', count: '', dept: '한방신경과', memo: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(null)

  function handleFast(val) {
    setRaw(val); setFastErr('')
    if (val.trim().split(/\s+/).length >= 4) {
      const r = parseQuickInput(val, baseHour)
      if (r.error) { setFastErr(r.error); setPreview(null) }
      else setPreview(r)
    } else setPreview(null)
  }

  async function submitFast() {
    if (!preview) return
    setSubmitting(true)
    try {
      const t = await createTask({
        scheduledAt: preview.scheduledAt,
        room: preview.room, floor: preview.floor,
        patientAnonymized: preview.patientAnonymized,
        needleCount: preview.needleCount,
        department: '한방신경과',
      }, profile)
      refresh()
      toast(`✅ 등록: ${preview.patientAnonymized} (${preview.room}호)`, 'success')
      setDone(preview); setRaw(''); setPreview(null)
    } catch (e) { toast('등록 실패: ' + e.message, 'error') }
    finally { setSubmitting(false) }
  }

  function setF(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => { const n = {...e}; delete n[k]; return n })
  }

  function validateManual() {
    const e = {}
    if (!form.room)          e.room  = '호실 입력'
    else if (!validRoom(form.room)) e.room = '유효 범위: 501~517 / 601~618 / 701~717'
    if (!form.name)          e.name  = '환자명 입력'
    if (!form.count || parseInt(form.count) < 1) e.count = '침 갯수 입력'
    setErrors(e); return !Object.keys(e).length
  }

  async function submitManual(e) {
    e.preventDefault()
    if (!validateManual()) return
    setSubmitting(true)
    try {
      const sched = new Date()
      sched.setHours(parseInt(form.h), parseInt(form.m), 0, 0)
      const payload = {
        scheduledAt: sched.toISOString(), room: form.room,
        floor: detectFloor(form.room) || '기타',
        patientAnonymized: anonymize(form.name),
        needleCount: parseInt(form.count),
        department: form.dept, memo: form.memo,
      }
      await createTask(payload, profile)
      refresh()
      toast(`✅ 등록: ${payload.patientAnonymized} (${form.room}호)`, 'success')
      setDone({ ...payload, preview: { time: `${form.h}:${form.m}`, floor: payload.floor, patient: payload.patientAnonymized, count: payload.needleCount } })
    } catch (e) { toast('등록 실패: ' + e.message, 'error') }
    finally { setSubmitting(false) }
  }

  const pv = done?.preview || preview

  if (done) return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">
      <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
           style={{ background: 'rgba(52,211,153,.12)', border: '2px solid rgba(52,211,153,.3)' }}>✅</div>
      <h2 className="text-xl font-bold" style={{ color: 'var(--green)' }}>등록 완료</h2>
      <div className="card p-4 w-full max-w-sm space-y-2.5 text-sm" style={{ background: 'var(--bg1)' }}>
        {[
          ['시간', <span className="font-mono font-bold" style={{ color: 'var(--teal)' }}>{pv.time}</span>],
          ['호실', <span className="font-bold">{done.room}호 <FloorBadge floor={pv.floor} /></span>],
          ['환자', <span className="font-bold">{pv.patient}</span>],
          ['침수', <span className="font-mono font-bold" style={{ color: 'var(--teal)' }}>{pv.count}개</span>],
        ].map(([l, v]) => (
          <div key={l} className="flex justify-between items-center">
            <span style={{ color: 'var(--text3)' }}>{l}</span>{v}
          </div>
        ))}
      </div>
      <div className="flex gap-3 w-full max-w-sm">
        <button onClick={() => setDone(null)} className="btn btn-teal flex-1 py-3.5 text-base">
          <Plus size={17} />추가 등록
        </button>
        <button onClick={() => nav('/')} className="btn btn-ghost flex-1 py-3.5 text-base">
          <ArrowLeft size={17} />대시보드
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-lg mx-auto p-4 pb-10">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => nav('/')} className="btn btn-ghost p-2.5"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="font-bold text-lg" style={{ color: 'var(--text1)' }}>신규 발침 등록</h1>
            <p className="text-xs" style={{ color: 'var(--text3)' }}>환자명 자동 익명화 · 층 자동 감지</p>
          </div>
        </div>

        {/* 모드 전환 */}
        <div className="flex rounded-2xl p-1 mb-5"
             style={{ background: 'var(--bg1)', border: '1px solid var(--border)' }}>
          {[{ k:'fast',l:'⚡ 빠른 입력' },{ k:'manual',l:'📝 상세 입력' }].map(m => (
            <button key={m.k} onClick={() => setMode(m.k)}
                    className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
                    style={mode === m.k ? { background: 'var(--teal)', color: '#0c0f18' } : { color: 'var(--text3)' }}>
              {m.l}
            </button>
          ))}
        </div>

        {/* ── FAST INPUT ── */}
        {mode === 'fast' && (
          <div className="space-y-4">
            <div className="rounded-2xl p-4"
                 style={{ background: 'rgba(0,212,170,.06)', border: '1px solid rgba(0,212,170,.18)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} color="var(--teal)" />
                <span className="text-xs font-bold" style={{ color: 'var(--teal)' }}>빠른 입력 형식</span>
              </div>
              <div className="font-mono text-base mb-1" style={{ color: 'var(--text1)' }}>
                <span style={{ color: 'var(--amber)' }}>분</span>{' '}
                <span style={{ color: 'var(--blue)' }}>호실</span>{' '}
                <span style={{ color: '#f9a8d4' }}>이름</span>{' '}
                <span style={{ color: 'var(--teal)' }}>침수</span>
              </div>
              <div className="font-mono font-bold text-lg mb-1" style={{ color: 'var(--text2)' }}>예) 26 713 허준영 45</div>
              <div className="text-xs" style={{ color: 'var(--text3)' }}>
                기준 시 {pad(baseHour)} + 26분 → {pad(baseHour)}:26 · 713 → 7층 · 허준영 → 허준X
              </div>
            </div>

            {/* 기준 시 선택 */}
            <div>
              <label className="lbl">기준 시</label>
              <select className="inp" value={baseHour} onChange={e => setBaseHour(parseInt(e.target.value))}>
                {Array.from({length:24},(_,h) => (
                  <option key={h} value={h}>{pad(h)}시</option>
                ))}
              </select>
            </div>

            <div>
              <label className="lbl">빠른 입력</label>
              <input className="inp font-mono text-center"
                     style={{ fontSize: 24, letterSpacing: '.1em', padding: 16 }}
                     value={raw} onChange={e => handleFast(e.target.value)}
                     placeholder="26 713 허준영 45" autoFocus />
              {fastErr && (
                <div className="mt-2 text-sm px-3 py-2 rounded-xl"
                     style={{ background: 'rgba(255,87,87,.08)', color: 'var(--red)', border: '1px solid rgba(255,87,87,.2)' }}>
                  {fastErr}
                </div>
              )}
            </div>

            {preview && (
              <div className="rounded-2xl p-4 space-y-2 anim-up"
                   style={{ background: 'rgba(0,212,170,.06)', border: '1px solid rgba(0,212,170,.25)' }}>
                <p className="text-xs font-bold" style={{ color: 'var(--teal)' }}>📋 미리보기</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span style={{ color: 'var(--text3)' }}>시간 </span>
                    <span className="font-mono font-bold" style={{ color: 'var(--teal)' }}>{preview.preview.time}</span>
                  </div>
                  <div><span style={{ color: 'var(--text3)' }}>호실 </span>
                    <span className="font-bold">{preview.room}호</span>
                    <FloorBadge floor={preview.floor} className="ml-1" />
                  </div>
                  <div><span style={{ color: 'var(--text3)' }}>환자 </span>
                    <span className="font-bold">{preview.patientAnonymized}</span>
                    <span className="text-xs" style={{ color: 'var(--text3)' }}> (익명화)</span>
                  </div>
                  <div><span style={{ color: 'var(--text3)' }}>침수 </span>
                    <span className="font-mono font-bold" style={{ color: 'var(--teal)' }}>{preview.needleCount}개</span>
                  </div>
                </div>
                <div className="text-xs" style={{ color: 'var(--text2)' }}>등록의: {profile.name}</div>
              </div>
            )}

            <button onClick={submitFast} disabled={!preview || submitting}
                    className="btn btn-teal w-full py-4 text-lg">
              {submitting ? '등록 중...' : <><Plus size={20} />발침 등록</>}
            </button>
          </div>
        )}

        {/* ── MANUAL ── */}
        {mode === 'manual' && (
          <form onSubmit={submitManual} className="space-y-4">
            <div>
              <label className="lbl">⏰ 예약 시간</label>
              <div className="flex items-center gap-3">
                <input type="number" min={0} max={23} className="inp text-center font-mono font-bold"
                       style={{ fontSize: 22 }} value={form.h}
                       onChange={e => setF('h', pad(e.target.value))} />
                <span className="text-2xl font-bold" style={{ color: 'var(--text3)' }}>:</span>
                <input type="number" min={0} max={59} className="inp text-center font-mono font-bold"
                       style={{ fontSize: 22 }} value={form.m}
                       onChange={e => setF('m', pad(e.target.value))} />
              </div>
              <div className="flex gap-2 mt-2">
                {[10,20,30,60].map(min => (
                  <button key={min} type="button" className="btn btn-ghost px-3 py-2 text-sm"
                    onClick={() => { const t = new Date(Date.now()+min*60000); setF('h',pad(t.getHours())); setF('m',pad(t.getMinutes())) }}>
                    +{min}분
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lbl">🏥 호실</label>
                <input className={`inp font-mono font-bold ${errors.room?'border-red-500':''}`}
                       style={{ fontSize: 20 }} value={form.room}
                       onChange={e => setF('room', e.target.value)} placeholder="713" maxLength={3} />
                {errors.room && <p className="text-xs mt-1" style={{ color: 'var(--red)' }}>{errors.room}</p>}
                {form.room && (
                  <p className="text-xs mt-1" style={{ color: detectFloor(form.room) ? 'var(--teal)' : 'var(--red)' }}>
                    {detectFloor(form.room) ? `→ ${detectFloor(form.room)}` : '유효 범위 외'}
                  </p>
                )}
              </div>
              <div>
                <label className="lbl">🪡 침 갯수</label>
                <input type="number" min={1} max={200}
                       className={`inp font-mono font-bold ${errors.count?'border-red-500':''}`}
                       style={{ fontSize: 20 }} value={form.count}
                       onChange={e => setF('count', e.target.value)} placeholder="40" />
                {errors.count && <p className="text-xs mt-1" style={{ color: 'var(--red)' }}>{errors.count}</p>}
              </div>
            </div>

            <div>
              <label className="lbl">👤 환자명 (즉시 익명화)</label>
              <input className={`inp ${errors.name?'border-red-500':''}`} style={{ fontSize: 18 }}
                     value={form.name} onChange={e => setF('name', e.target.value)} placeholder="홍길동" />
              {form.name && (
                <p className="text-xs mt-1.5" style={{ color: 'var(--teal)' }}>
                  🔒 저장 시: <strong>{anonymize(form.name)}</strong> (원본 미저장)
                </p>
              )}
              {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--red)' }}>{errors.name}</p>}
            </div>

            <div>
              <label className="lbl">🏷 진료과</label>
              <select className="inp" value={form.dept} onChange={e => setF('dept', e.target.value)}>
                {DEPTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="lbl">📝 메모</label>
              <input className="inp" value={form.memo} onChange={e => setF('memo', e.target.value)}
                     placeholder="예: 좌측 편마비, 요통..." />
            </div>

            <button type="submit" disabled={submitting} className="btn btn-teal w-full py-4 text-lg">
              {submitting ? '등록 중...' : <><Plus size={20} />발침 등록</>}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
