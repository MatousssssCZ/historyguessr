import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import ErrorBoundary from '@/components/ErrorBoundary'
import AuthPage from '@/pages/Auth'
import MenuPage from '@/pages/Menu'
import GamePage from '@/pages/Game'
import PreGameLobbyPage from '@/pages/PreGameLobby'
import AccountPage from '@/pages/Account'
import DailyChallengePage from '@/pages/Daily'
import ResetPasswordPage from '@/pages/ResetPassword'
import StatsPage from '@/pages/Stats'
import PrivacyPage from '@/pages/Privacy'
import TermsPage from '@/pages/Terms'

// Líně načítané (těžké / méně časté) sekce — menší první bundle pro běžného hráče
const AdminPage = lazy(() => import('@/pages/Admin'))
const AdminImportPage = lazy(() => import('@/pages/AdminImport'))
const AdminDailyChallengePage = lazy(() => import('@/pages/AdminDailyChallenge'))
const MultiplayerLobbyPage = lazy(() => import('@/pages/MultiplayerLobby'))
const MultiplayerGamePage = lazy(() => import('@/pages/MultiplayerGame'))

// ── Auth guard ────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner/>
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace/>
  return <>{children}</>
}

// ── Admin guard ───────────────────────────────────────────
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <FullScreenSpinner/>
  if (!user) return <Navigate to="/auth" replace/>
  if (!isAdmin) return <Navigate to="/menu" replace/>
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
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<FullScreenSpinner/>}>
            <Routes>
              <Route path="/" element={<RootRedirect/>}/>
              <Route path="/auth" element={<AuthPage/>}/>
              <Route path="/auth/callback" element={<RootRedirect/>}/>
              <Route path="/reset-password" element={<ResetPasswordPage/>}/>
              <Route path="/menu"    element={<RequireAuth><MenuPage/></RequireAuth>}/>
              <Route path="/play"    element={<RequireAuth><PreGameLobbyPage/></RequireAuth>}/>
              <Route path="/game"    element={<RequireAuth><GamePage/></RequireAuth>}/>
              <Route path="/account" element={<RequireAuth><AccountPage/></RequireAuth>}/>
              <Route path="/stats"   element={<RequireAuth><StatsPage/></RequireAuth>}/>
              <Route path="/admin"   element={<RequireAdmin><AdminPage/></RequireAdmin>}/>
              <Route path="/admin/import" element={<RequireAdmin><AdminImportPage/></RequireAdmin>}/>
              <Route path="/admin/daily" element={<RequireAdmin><AdminDailyChallengePage/></RequireAdmin>}/>
              <Route path="/daily"   element={<RequireAuth><DailyChallengePage/></RequireAuth>}/>
              <Route path="/multiplayer/lobby" element={<RequireAuth><MultiplayerLobbyPage/></RequireAuth>}/>
              <Route path="/multiplayer/game/:roomId" element={<RequireAuth><MultiplayerGamePage/></RequireAuth>}/>
              <Route path="/privacy" element={<PrivacyPage/>}/>
              <Route path="/terms"   element={<TermsPage/>}/>
              <Route path="*"        element={<Navigate to="/" replace/>}/>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
