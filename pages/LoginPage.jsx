import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Eye, EyeOff, Activity, Shield } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail]     = useState('')
  const [pw, setPw]           = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [consent, setConsent] = useState(false)
  const [err, setErr]         = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!consent) { setErr('개인정보 처리 동의가 필요합니다'); return }
    setErr(''); setLoading(true)
    const r = await login(email, pw)
    setLoading(false)
    if (r.ok) nav('/')
    else setErr(r.msg)
  }

  const ACCOUNTS = [
    { email:'doctor1@hospital.kr',    label:'의사',      name:'Dr.Hur' },
    { email:'intern1@hospital.kr',    label:'인턴(7층)', name:'이인턴' },
    { email:'intern2@hospital.kr',    label:'인턴(5~6)', name:'박스태프' },
    { email:'admin@hospital.kr',      label:'관리자',    name:'김관리자' },
    { email:'superadmin@hospital.kr', label:'최고관리자',name:'최고관리자' },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'var(--bg0)' }}>
      {/* 배경 그리드 */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.025]"
           style={{ backgroundImage: 'linear-gradient(var(--teal) 1px,transparent 1px),linear-gradient(90deg,var(--teal) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="relative w-full max-w-sm anim-fade">
        {/* 헤더 */}
        <div className="text-center mb-7">
          <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4"
               style={{ background: 'rgba(0,212,170,.1)', border: '1px solid rgba(0,212,170,.2)' }}>
            <Activity size={26} color="var(--teal)" />
          </div>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text1)' }}>침 발침 관리 시스템</h1>
          <p className="text-sm" style={{ color: 'var(--text3)' }}>대전대학교 대전한방병원 5~7층 병동</p>
        </div>

        {/* 폼 */}
        <div className="card p-6 mb-4" style={{ background: 'var(--bg1)' }}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="lbl">이메일</label>
              <input className="inp" type="email" value={email}
                     onChange={e => setEmail(e.target.value)}
                     placeholder="doctor1@hospital.kr" autoComplete="email" required />
            </div>
            <div>
              <label className="lbl">비밀번호</label>
              <div className="relative">
                <input className="inp pr-11" type={showPw ? 'text' : 'password'} value={pw}
                       onChange={e => setPw(e.target.value)}
                       placeholder="비밀번호" autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 개인정보 동의 */}
            <div className="rounded-2xl p-3.5"
                 style={{ background: 'rgba(0,212,170,.05)', border: '1px solid rgba(0,212,170,.15)' }}>
              <div className="flex items-start gap-2 mb-2.5">
                <Shield size={14} color="var(--teal)" className="mt-0.5 shrink-0" />
                <p className="text-xs" style={{ color: 'var(--text2)' }}>
                  본 시스템은 <strong style={{ color: 'var(--teal)' }}>개인정보보호법</strong> 및{' '}
                  <strong style={{ color: 'var(--teal)' }}>의료법</strong>에 따라 환자명을 즉시 익명화합니다.
                  수집 데이터는 발침 업무 목적으로만 사용됩니다.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                       style={{ accentColor: 'var(--teal)', width: 16, height: 16 }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text1)' }}>
                  개인정보 처리 방침에 동의합니다
                </span>
              </label>
            </div>

            {err && (
              <div className="text-sm px-3 py-2.5 rounded-xl anim-up"
                   style={{ background: 'rgba(255,87,87,.08)', color: 'var(--red)', border: '1px solid rgba(255,87,87,.2)' }}>
                {err}
              </div>
            )}

            <button type="submit" disabled={loading}
                    className="btn btn-teal w-full py-3.5 text-base">
              {loading
                ? <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                       style={{ borderColor: '#0c0f18', borderTopColor: 'transparent' }} />
                : '로그인'}
            </button>
          </form>
        </div>

        {/* 테스트 계정 */}
        <div className="card p-4" style={{ background: 'var(--bg1)' }}>
          <p className="text-xs text-center mb-3" style={{ color: 'var(--text3)' }}>
            테스트 계정 — 비밀번호: <span className="font-mono font-bold" style={{ color: 'var(--teal)' }}>1234</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ACCOUNTS.map(a => (
              <button key={a.email}
                      onClick={() => { setEmail(a.email); setPw('1234'); setConsent(true) }}
                      className="py-2 px-3 rounded-xl text-left text-xs font-semibold transition-all"
                      style={{ background: 'rgba(255,255,255,.04)', color: 'var(--text2)', border: '1px solid rgba(255,255,255,.06)' }}>
                <span className="block" style={{ color: 'var(--text1)' }}>{a.label}</span>
                <span style={{ color: 'var(--text3)' }}>{a.name}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text3)' }}>
          내부 전용 시스템 · 비인가 접근 금지
        </p>
      </div>
    </div>
  )
}
