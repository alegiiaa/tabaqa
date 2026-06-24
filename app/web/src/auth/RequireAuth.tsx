import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/** Gate for authenticated routes: bounces to /login (remembering where you came from). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="auth-booting" aria-busy="true" />
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children}</>
}
