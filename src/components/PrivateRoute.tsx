import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function PrivateRoute() {
  const { session, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Carregando...</div>
  return session ? <Outlet /> : <Navigate to="/login" replace />
}
