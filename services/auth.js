import { supabase } from './supabase.js'

export const ROLES = {
  superadmin: '최고관리자',
  admin: '관리자',
  doctor: '의사',
  intern: '인턴/스태프',
  viewer: '조회전용',
}
export const ROLE_COLOR = {
  superadmin: '#ff5757',
  admin: '#f59e3f',
  doctor: '#4d9fff',
  intern: '#34d399',
  viewer: '#8892b0',
}
// ── 진료과 목록 ──────────────────────────────────────────
export const DEPARTMENTS = ['L','I','M2','N','G','P','F','OED','NP','AM1','AM2','AM3','PT1','PT2','GY','PED']

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, msg: '이메일 또는 비밀번호가 틀렸습니다' }
  const profile = await getProfile(data.user.id)
  if (!profile) return { ok: false, msg: '계정 프로필을 찾을 수 없습니다. 관리자에게 문의하세요.' }
  if (!profile.is_active) return { ok: false, msg: '비활성화된 계정입니다.' }
  return { ok: true, user: data.user, profile }
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const profile = await getProfile(session.user.id)
  return { session, profile }
}

export async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles').select('*').eq('id', userId).single()
  return data
}

export async function getAllProfiles() {
  const { data, error } = await supabase
    .from('profiles').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function updateProfile(id, updates) {
  const { data, error } = await supabase
    .from('profiles').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export function can(profile, action) {
  if (!profile) return false
  const r = profile.role
  switch (action) {
    // ✅ 인턴도 등록 가능하도록 수정
    case 'createTask':   return ['superadmin','admin','doctor','intern'].includes(r)
    case 'updateStatus': return ['superadmin','admin','doctor','intern'].includes(r)
    case 'manageUsers':  return ['superadmin','admin'].includes(r)
    case 'export':       return ['superadmin','admin','doctor'].includes(r)
    case 'deleteTask':   return ['superadmin','admin'].includes(r)
    case 'viewAudit':    return ['superadmin','admin'].includes(r)
    default: return false
  }
}

export function canAccessFloor(profile, floor) {
  if (!profile) return false
  if (['superadmin','admin'].includes(profile.role)) return true
  return profile.accessible_floors?.includes(floor)
}
