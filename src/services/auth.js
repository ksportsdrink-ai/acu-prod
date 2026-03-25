import { supabase } from './supabase.js'

/* ── 로그인 ──────────────────────────────────────────── */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, msg: '이메일 또는 비밀번호가 틀렸습니다' }

  const profile = await getProfile(data.user.id)
  if (!profile) return { ok: false, msg: '계정 프로필을 찾을 수 없습니다. 관리자에게 문의하세요.' }
  if (!profile.is_active) return { ok: false, msg: '비활성화된 계정입니다. 관리자에게 문의하세요.' }

  return { ok: true, user: data.user, profile }
}

/* ── 로그아웃 ────────────────────────────────────────── */
export async function signOut() {
  await supabase.auth.signOut()
}

/* ── 현재 세션 가져오기 ──────────────────────────────── */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const profile = await getProfile(session.user.id)
  return { session, profile }
}

/* ── 프로필 조회 ─────────────────────────────────────── */
export async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

/* ── 전체 프로필 목록 (관리자용) ─────────────────────── */
export async function getAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

/* ── 프로필 업데이트 ─────────────────────────────────── */
export async function updateProfile(id, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/* ── 새 사용자 초대 생성 (관리자용) ──────────────────── */
export async function inviteUser({ email, name, role, department, floors }) {
  // Supabase Admin API 필요 → 현재는 직접 대시보드에서 생성 후 profiles 수동 수정 안내
  // 실제 운영 시 Edge Function으로 구현 권장
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'ChangeMe!1234', // 초기 비밀번호 (사용자가 변경 필요)
    options: {
      data: { name, role, floors }
    }
  })
  if (error) throw error
  return data
}

/* ── 권한 확인 ───────────────────────────────────────── */
export function can(profile, action) {
  if (!profile) return false
  const r = profile.role
  switch (action) {
    case 'createTask':   return ['superadmin','admin','doctor'].includes(r)
    case 'updateStatus': return ['superadmin','admin','doctor','intern'].includes(r)
    case 'manageUsers':  return ['superadmin','admin'].includes(r)
    case 'export':       return ['superadmin','admin','doctor'].includes(r)
    case 'deleteTask':   return ['superadmin','admin'].includes(r)
    case 'viewAudit':    return ['superadmin','admin'].includes(r)
    default: return false
  }
}

/* ── 층 접근 권한 ────────────────────────────────────── */
export function canAccessFloor(profile, floor) {
  if (!profile) return false
  if (['superadmin','admin'].includes(profile.role)) return true
  return profile.accessible_floors?.includes(floor)
}
