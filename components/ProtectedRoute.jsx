import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg0)'}}>
      <div style={{width:28,height:28,borderRadius:'50%',border:'2px solid var(--teal)',borderTopColor:'transparent'}} className="animate-spin"/>
    </div>
  )
  if (!profile) return <Navigate to="/login" replace />
  return children
}
