import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, History, Download, Users, LogOut, BarChart3, Activity } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { can } from '../services/auth.js'
import { ROLE_LABEL, ROLE_COLOR, pad } from '../utils/index.js'
import { useState, useEffect } from 'react'

function Clock() {
  const [t, setT] = useState('')
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setT(`${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="font-mono text-sm font-bold" style={{ color: 'var(--teal)' }}>{t}</span>
}

export default function Layout() {
  const { profile, logout } = useAuth()
  const nav = useNavigate()

  const NAV = [
    { to: '/',          icon: LayoutDashboard, label: '대시보드',    end: true },
    { to: '/new',       icon: PlusCircle,      label: '신규 등록',   perm: 'createTask' },
    { to: '/history',   icon: History,         label: '일별 기록' },
    { to: '/analytics', icon: BarChart3,       label: '통계' },
    { to: '/export',    icon: Download,        label: '내보내기',    perm: 'export' },
    { to: '/users',     icon: Users,           label: '사용자 관리', perm: 'manageUsers' },
  ].filter(n => !n.perm || can(profile, n.perm))

  async function doLogout() { await logout(); nav('/login') }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg0)' }}>
      {/* 사이드바 */}
      <aside className="flex flex-col shrink-0 border-r"
             style={{ width: 200, background: 'var(--bg1)', borderColor: 'var(--border)' }}>
        {/* 로고 */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(0,212,170,.12)', border: '1px solid rgba(0,212,170,.22)' }}>
              <Activity size={16} color="var(--teal)" />
            </div>
            <div>
              <div className="text-xs font-bold" style={{ color: 'var(--text1)' }}>발침관리시스템</div>
              <div className="text-[9px]" style={{ color: 'var(--text3)' }}>대전한방병원</div>
            </div>
          </div>
          <Clock />
        </div>

        {/* 네비 */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer no-underline ${
                  isActive
                    ? 'text-[var(--teal)]'
                    : 'text-[var(--text2)] hover:text-[var(--text1)] hover:bg-white/5'
                }`
              }
              style={({ isActive }) => isActive
                ? { background: 'rgba(0,212,170,.1)', borderLeft: '2px solid var(--teal)' }
                : {}
              }>
              <n.icon size={15} />
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* 유저 */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                 style={{ background: `${ROLE_COLOR[profile?.role]}20`, color: ROLE_COLOR[profile?.role] }}>
              {profile?.name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: 'var(--text1)' }}>{profile?.name}</div>
              <div className="text-[10px]" style={{ color: ROLE_COLOR[profile?.role] }}>{ROLE_LABEL[profile?.role]}</div>
            </div>
          </div>
          <button onClick={doLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all"
            style={{ color: 'var(--text3)' }}
            onMouseEnter={e => { e.currentTarget.style.color='var(--red)'; e.currentTarget.style.background='rgba(255,87,87,.08)' }}
            onMouseLeave={e => { e.currentTarget.style.color='var(--text3)'; e.currentTarget.style.background='transparent' }}>
            <LogOut size={13} />로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
