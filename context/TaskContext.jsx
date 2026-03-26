import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { fetchTasks, subscribeToTasks, calcStats } from '../services/tasks.js'
import { todayKST } from '../utils/index.js'

const TaskCtx = createContext(null)

export function TaskProvider({ children }) {
  const [dateStr, setDateStr] = useState(todayKST())
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const unsubRef  = useRef(null)
  const mountedRef = useRef(true)
  const initialLoad = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const load = useCallback(async (date, showSpinner = false) => {
    // 최초 로딩만 스피너, realtime 업데이트는 조용히 갱신
    if (showSpinner) setLoading(true)
    try {
      const data = await fetchTasks(date)
      if (mountedRef.current) {
        setTasks(data)
        setError(null)
      }
    } catch (e) {
      if (mountedRef.current) setError(e.message)
    } finally {
      if (mountedRef.current) setLoading(false)
      initialLoad.current = false
    }
  }, [])

  useEffect(() => {
    initialLoad.current = true
    load(dateStr, true) // 날짜 변경 시 스피너 표시

    // 이전 구독 해제
    if (unsubRef.current) unsubRef.current()

    // Realtime 구독 (오늘만, 조용히 갱신)
    if (dateStr === todayKST()) {
      unsubRef.current = subscribeToTasks(dateStr, () => {
        if (mountedRef.current) load(dateStr, false)
      })
    }

    return () => { if (unsubRef.current) unsubRef.current() }
  }, [dateStr, load])

  // 로딩 타임아웃 (5초 후 강제 해제)
  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => {
      if (mountedRef.current) setLoading(false)
    }, 5000)
    return () => clearTimeout(timer)
  }, [loading])

  function optimistic(taskId, patch) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t))
  }
  function optimisticAdd(task) {
    setTasks(prev => [...prev, task].sort((a,b) =>
      new Date(a.scheduled_time) - new Date(b.scheduled_time)
    ))
  }

  const refresh = () => load(dateStr, false)
  const stats = calcStats(tasks)

  return (
    <TaskCtx.Provider value={{
      tasks, dateStr, setDateStr, loading, error,
      refresh, optimistic, optimisticAdd, stats
    }}>
      {children}
    </TaskCtx.Provider>
  )
}

export const useTasks = () => useContext(TaskCtx)
