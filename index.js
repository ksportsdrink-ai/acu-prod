/* ── 호실 / 층 ─────────────────────────────────────────
   5층: 501~517 / 6층: 601~618 / 7층: 701~717
──────────────────────────────────────────────────────── */
export function detectFloor(room) {
  const n = parseInt(room, 10)
  if (n >= 501 && n <= 517) return '5층'
  if (n >= 601 && n <= 618) return '6층'
  if (n >= 701 && n <= 717) return '7층'
  return null
}
export function validRoom(room) { return detectFloor(room) !== null }
export function floorClass(floor) {
  return { '5층':'floor-5', '6층':'floor-6', '7층':'floor-7' }[floor] || ''
}

/* ── 익명화 ──────────────────────────────────────────── */
export function anonymize(name) {
  if (!name) return '익명'
  const t = [...name.trim()]
  if (t.length >= 3) return t.slice(0,2).join('') + 'X'
  if (t.length === 2) return t[0] + 'X'
  return 'X'
}

/* ── 빠른 입력 파서 ──────────────────────────────────── */
export function parseQuickInput(raw, baseHour) {
  const parts = raw.trim().split(/\s+/)
  if (parts.length < 4)
    return { error: '4개 필요: 분 호실 이름 침수   예) 26 713 허준영 45' }
  const minStr   = parts[0]
  const room     = parts[1]
  const countStr = parts[parts.length - 1]
  const nameParts = parts.slice(2, parts.length - 1)
  const minute = parseInt(minStr, 10)
  const count  = parseInt(countStr, 10)
  if (isNaN(minute) || minute < 0 || minute > 59)
    return { error: `분이 올바르지 않습니다: "${minStr}" (0~59)` }
  if (!validRoom(room))
    return { error: `유효하지 않은 호실: ${room}\n범위: 501~517 / 601~618 / 701~717` }
  if (!nameParts.length) return { error: '환자명을 입력하세요' }
  if (isNaN(count) || count < 1) return { error: `침 갯수 오류: "${countStr}"` }
  const hour = baseHour ?? new Date().getHours()
  const scheduled = new Date()
  scheduled.setHours(hour, minute, 0, 0)
  return {
    scheduledAt: scheduled.toISOString(),
    room, floor: detectFloor(room),
    patientAnonymized: anonymize(nameParts.join(' ')),
    needleCount: count,
    preview: { time:`${pad(hour)}:${pad(minute)}`, floor:detectFloor(room), patient:anonymize(nameParts.join(' ')), count }
  }
}

/* ── 시간 유틸 ───────────────────────────────────────── */
export function pad(n) { return String(n).padStart(2,'0') }
export function todayKST() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
export function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export function fmtDateKr(dateStr) {
  if (!dateStr) return ''
  const [y,m,d] = dateStr.split('-')
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`
}
export function minDiff(from) {
  return Math.floor((Date.now() - new Date(from).getTime()) / 60000)
}

/* ── 상태 ────────────────────────────────────────────── */
export const STATUS_LABEL = {
  scheduled:   '발침예정',
  in_progress: '진행중',
  paused:      '중단됨',
  delayed:     '지연/초과',
  completed:   '발침완료',
}
export const STATUS_BADGE = {
  scheduled:   'badge-scheduled',
  in_progress: 'badge-in_progress',
  paused:      'badge-paused',
  delayed:     'badge-delayed',
  completed:   'badge-completed',
}

/* ── 역할 ────────────────────────────────────────────── */
export const ROLE_LABEL = {
  superadmin:'최고관리자', admin:'관리자', doctor:'의사', intern:'인턴/스태프', viewer:'조회전용'
}
export const ROLE_COLOR = {
  superadmin:'#ff5757', admin:'#f59e3f', doctor:'#4d9fff', intern:'#34d399', viewer:'#8892b0'
}

/* ── 진료과 ──────────────────────────────────────────── */
export const DEPTS = ['L','I','M2','N','G','P','F','OED','NP','AM1','AM2','AM3','PT1','PT2','GY','PED']

/* ── CSV ─────────────────────────────────────────────── */
export function exportCSV(tasks, dateStr) {
  const headers = ['날짜','예약시간','호실','층','환자(익명)','침갯수','진료과',
    '등록자','진행담당자','진행시작','완료담당자','완료시각','상태','지연사유','중단사유','메모']
  const rows = tasks.map(t => [
    t.task_date||dateStr, fmtTime(t.scheduled_time),
    t.room, t.floor, t.patient_anonymized, t.needle_count, t.department||'',
    t.created_by_name||'', t.in_progress_by_name||'',
    t.in_progress_at ? fmtTime(t.in_progress_at) : '',
    t.completed_by_name||'', t.completed_at ? fmtTime(t.completed_at) : '',
    STATUS_LABEL[t.status]||t.status,
    t.delay_reason||'', t.pause_reason||'', t.memo||'',
  ])
  const csv = [headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href=url; a.download=`발침기록_${dateStr}.csv`; a.click()
  URL.revokeObjectURL(url)
}

/* ── 브라우저 알림 ───────────────────────────────────── */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

export function sendNotification(title, body, tag = '') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag,
    requireInteraction: true,
  })
}
