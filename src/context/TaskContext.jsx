import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { fetchTasks, subscribeToTasks, calcStats } from '../services/tasks.js'
import { todayKST } from '../utils/index.js'

const TaskCtx = createContext(null)

export function TaskProvider({ children }) {
  const [dateStr, setDateStr] = useState(todayKST())
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const unsubRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const load = useCallback(async (date) => {
    try {
      setLoading(true)
      const data = await fetchTasks(date)
      if (mountedRef.current) {
        setTasks(data)
        setError(null)
      }
    } catch (e) {
      if (mountedRef.current) setError(e.message)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(dateStr)
    if (unsubRef.current) unsubRef.current()
    if (dateStr === todayKST()) {
      unsubRef.current = subscribeToTasks(dateStr, () => {
        if (mountedRef.current) load(dateStr)
      })
    }
    return () => { if (unsubRef.current) unsubRef.current() }
  }, [dateStr, load])

  function optimistic(taskId, patch) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t))
  }
  function optimisticAdd(task) {
    setTasks(prev => [...prev, task].sort((a,b) =>
      new Date(a.scheduled_time) - new Date(b.scheduled_time)
    ))
  }

  const refresh = () => load(dateStr)
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
