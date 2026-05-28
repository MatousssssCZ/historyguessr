import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import AuthPage from '@/pages/Auth'
import MenuPage from '@/pages/Menu'
import GamePage from '@/pages/Game'
import AccountPage from '@/pages/Account'
import AdminPage from '@/pages/Admin'
import AdminImportPage from '@/pages/AdminImport'
import AdminDailyChallengePage from '@/pages/AdminDailyChallenge'

// ── Auth guard ────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner/>
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace/>
  return <>{children}</>
}

// ── Root redirect ─────────────────────────────────────────
function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenSpinner/>
  return <Navigate to={user ? '/menu' : '/auth'} replace/>
}

// ── Full screen spinner ───────────────────────────────────
function FullScreenSpinner() {
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: 'var(--paper-200)',
    }}>
      <span className="spinner" style={{ width: 28, height: 28 }}/>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect/>}/>
          <Route path="/auth" element={<AuthPage/>}/>
          <Route path="/menu"    element={<RequireAuth><MenuPage/></RequireAuth>}/>
          <Route path="/game"    element={<RequireAuth><GamePage/></RequireAuth>}/>
          <Route path="/account" element={<RequireAuth><AccountPage/></RequireAuth>}/>
          <Route path="/admin"   element={<RequireAuth><AdminPage/></RequireAuth>}/>
          <Route path="/admin/import" element={<RequireAuth><AdminImportPage/></RequireAuth>}/>
          <Route path="/admin/daily" element={<RequireAuth><AdminDailyChallengePage/></RequireAuth>}/>
          <Route path="*"        element={<Navigate to="/" replace/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
