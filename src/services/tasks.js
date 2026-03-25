import { supabase } from './supabase.js'
import { todayKST } from '../utils/index.js'

/* ── 오늘 태스크 조회 ────────────────────────────────── */
export async function fetchTasks(dateStr = todayKST()) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('task_date', dateStr)
    .order('scheduled_time', { ascending: true })
  if (error) throw error
  return data || []
}

/* ── 날짜 목록 (히스토리용) ──────────────────────────── */
export async function fetchAvailableDates() {
  const { data, error } = await supabase
    .from('tasks')
    .select('task_date')
    .order('task_date', { ascending: false })
  if (error) return [todayKST()]
  return [...new Set((data || []).map(r => r.task_date))]
}

/* ── 태스크 생성 ─────────────────────────────────────── */
export async function createTask(payload, profile) {
  const row = {
    task_date:          payload.taskDate || todayKST(),
    scheduled_time:     payload.scheduledAt,
    room:               payload.room,
    floor:              payload.floor,
    patient_anonymized: payload.patientAnonymized,
    needle_count:       payload.needleCount,
    department:         payload.department || '',
    memo:               payload.memo || '',
    status:             'scheduled',
    created_by:         profile.id,
    created_by_name:    profile.name,
  }
  const { data, error } = await supabase
    .from('tasks').insert(row).select().single()
  if (error) throw error

  // 감사 로그
  await logAudit({ taskId: data.id, action: '태스크생성', actorId: profile.id, actorName: profile.name, newStatus: 'scheduled' })
  return data
}

/* ── 상태 업데이트 ───────────────────────────────────── */
export async function updateTaskStatus(taskId, newStatus, profile, extra = {}) {
  const now = new Date().toISOString()
  const patch = { status: newStatus }

  if (newStatus === 'in_progress') {
    patch.in_progress_by      = profile.id
    patch.in_progress_by_name = profile.name
    patch.in_progress_at      = now
  }
  if (newStatus === 'delayed') {
    patch.delay_reason = extra.delayReason || ''
    // 진행 중 담당자가 없으면 지연 처리자로 기록
    if (!extra.alreadyInProgress) {
      patch.in_progress_by      = profile.id
      patch.in_progress_by_name = profile.name
      patch.in_progress_at      = now
    }
  }
  if (newStatus === 'completed') {
    patch.completed_by      = profile.id
    patch.completed_by_name = profile.name
    patch.completed_at      = now
  }

  // 현재 상태 조회 (audit log용)
  const { data: current } = await supabase
    .from('tasks').select('status').eq('id', taskId).single()

  const { data, error } = await supabase
    .from('tasks').update(patch).eq('id', taskId).select().single()
  if (error) throw error

  // 감사 로그
  await logAudit({
    taskId,
    action: `상태변경`,
    actorId: profile.id,
    actorName: profile.name,
    oldStatus: current?.status,
    newStatus,
    note: extra.delayReason || '',
  })
  return data
}

/* ── 태스크 삭제 ─────────────────────────────────────── */
export async function deleteTask(taskId, profile) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw error
  await logAudit({ taskId, action: '태스크삭제', actorId: profile.id, actorName: profile.name })
}

/* ── 감사 로그 기록 ──────────────────────────────────── */
async function logAudit({ taskId, action, actorId, actorName, oldStatus, newStatus, note }) {
  await supabase.from('audit_logs').insert({
    task_id:    taskId,
    action,
    actor_id:   actorId,
    actor_name: actorName,
    old_status: oldStatus || null,
    new_status: newStatus || null,
    note:       note || null,
  })
}

/* ── Realtime 구독 (오늘 태스크) ─────────────────────── */
export function subscribeToTasks(dateStr, onUpdate) {
  const channel = supabase
    .channel(`tasks_${dateStr}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks', filter: `task_date=eq.${dateStr}` },
      () => onUpdate()
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

/* ── 일별 통계 계산 ──────────────────────────────────── */
export function calcStats(tasks) {
  const stats = { total: 0, scheduled: 0, in_progress: 0, delayed: 0, completed: 0, needles: 0 }
  const byFloor  = {}
  const byDoctor = {}
  tasks.forEach(t => {
    stats.total++
    stats[t.status] = (stats[t.status] || 0) + 1
    stats.needles += t.needle_count || 0
    byFloor[t.floor]           = (byFloor[t.floor] || 0) + 1
    byDoctor[t.created_by_name] = (byDoctor[t.created_by_name] || 0) + 1
  })
  return { ...stats, byFloor, byDoctor }
}
