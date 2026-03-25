import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase.js'
import { getSession, signIn as authSignIn, signOut as authSignOut } from '../services/auth.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 초기 세션 복원
    getSession().then(s => {
      if (s) setProfile(s.profile)
      setLoading(false)
    })

    // Auth 상태 변화 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setProfile(null)
        return
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const s = await getSession()
        if (s) setProfile(s.profile)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function login(email, password) {
    const r = await authSignIn(email, password)
    if (r.ok) setProfile(r.profile)
    return r
  }

  async function logout() {
    await authSignOut()
    setProfile(null)
  }

  return (
    <AuthCtx.Provider value={{ profile, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
