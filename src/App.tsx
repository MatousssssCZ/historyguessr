import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { prefetchMenuHero } from '@/lib/preload'
import { prewarmMap } from '@/lib/mapTiles'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import ErrorBoundary from '@/components/ErrorBoundary'
import UsernameSetup from '@/components/UsernameSetup'
import CompassLoader from '@/components/CompassLoader'
import UpdateWatcher from '@/components/UpdateWatcher'
import EnvBadge from '@/components/EnvBadge'
import GameInviteListener from '@/components/GameInviteListener'
import AuthPage from '@/pages/Auth'
import GuestSetupPage from '@/pages/GuestSetup'
import TryGamePage from '@/pages/TryGame'
import ChallengePage from '@/pages/Challenge'
import LeaderboardPage from '@/pages/Leaderboard'
import PlayerProfilePage from '@/pages/PlayerProfile'
import MenuPage from '@/pages/Menu'
import GamePage from '@/pages/Game'
import CampaignsPage from '@/pages/Campaigns'
import PreGameLobbyPage from '@/pages/PreGameLobby'
import AccountPage from '@/pages/Account'
import PremiumPage from '@/pages/Premium'
import RoadmapPage from '@/pages/Roadmap'
import DailyChallengePage from '@/pages/Daily'
import ResetPasswordPage from '@/pages/ResetPassword'
import StatsPage from '@/pages/Stats'
import FriendsPage from '@/pages/Friends'
import PrivacyPage from '@/pages/Privacy'
import TermsPage from '@/pages/Terms'

// Líně načítané (těžké / méně časté) sekce — menší první bundle pro běžného hráče
const AdminHubPage = lazy(() => import('@/pages/AdminHub'))
const AdminPage = lazy(() => import('@/pages/Admin'))
const AdminImportPage = lazy(() => import('@/pages/AdminImport'))
const AdminDailyChallengePage = lazy(() => import('@/pages/AdminDailyChallenge'))
const AdminReportsPage = lazy(() => import('@/pages/AdminReports'))
const AdminBulkAIPage = lazy(() => import('@/pages/AdminBulkAI'))
const AdminCampaignsPage = lazy(() => import('@/pages/AdminCampaigns'))
const AdminContinentsPage = lazy(() => import('@/pages/AdminContinents'))
const AdminRoadmapPage = lazy(() => import('@/pages/AdminRoadmap'))
const AdminFeedbackPage = lazy(() => import('@/pages/AdminFeedback'))
const AdminPanoramaRepairPage = lazy(() => import('@/pages/AdminPanoramaRepair'))
const AdminEventTasksPage = lazy(() => import('@/pages/AdminEventTasks'))
const EditorPage = lazy(() => import('@/pages/Editor'))
const MultiplayerLobbyPage = lazy(() => import('@/pages/MultiplayerLobby'))
const MultiplayerGamePage = lazy(() => import('@/pages/MultiplayerGame'))

// ── Auth guard ────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner/>
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace/>
  // Vynucené nastavení přezdívky (první přihlášení / historický účet bez ní)
  if (profile && !profile.username) return <UsernameSetup/>
  return <>{children}</>
}

// ── Admin guard ───────────────────────────────────────────
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, loading } = useAuth()
  if (loading) return <FullScreenSpinner/>
  if (!user) return <Navigate to="/auth" replace/>
  if (profile && !profile.username) return <UsernameSetup/>
  if (!isAdmin) return <Navigate to="/menu" replace/>
  return <>{children}</>
}

// ── Editor guard (editor NEBO admin) ─────────────────────
function RequireEditor({ children }: { children: React.ReactNode }) {
  const { user, profile, isEditor, loading } = useAuth()
  if (loading) return <FullScreenSpinner/>
  if (!user) return <Navigate to="/auth" replace/>
  if (profile && !profile.username) return <UsernameSetup/>
  if (!isEditor) return <Navigate to="/menu" replace/>
  return <>{children}</>
}

// ── Root redirect (cíl e-mail potvrzení) ─────────────────
function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenSpinner/>
  return <Navigate to={user ? '/menu' : '/auth'} replace/>
}

// ── Menu gate ─────────────────────────────────────────────
// Menu je přístupné i BEZ účtu (host-first: návštěvník rovnou v menu, účet
// vzniká líně až u první hry). Registrovanému bez přezdívky vynutíme setup.
function MenuGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <FullScreenSpinner/>
  if (user && profile && !profile.username) return <UsernameSetup/>
  return <>{children}</>
}

// ── Domů → vždy do menu (host režim řeší samotné Menu). Login žije na /auth. ─
function HomeRoute() {
  const { loading } = useAuth()
  if (loading) return <FullScreenSpinner/>
  return <Navigate to="/menu" replace/>
}

// ── Host setup (účet vzniká až tady). Přesměrování „už přihlášený → menu"
//    řeší sama stránka, aby přežila zobrazení „Jak hrát" po vytvoření hosta. ─
function GuestRoute() {
  const { loading } = useAuth()
  if (loading) return <FullScreenSpinner/>
  return <GuestSetupPage/>
}

// ── Full screen spinner ───────────────────────────────────
function FullScreenSpinner() {
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: 'var(--paper-200)',
    }}>
      <CompassLoader size={64} light/>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────
export default function App() {
  // Přednačti hero obrázky domovského menu co nejdřív (běží i na Auth/loadingu),
  // ať je panorama menu připravené dřív, než se do menu vejde.
  useEffect(() => { prefetchMenuHero(); prewarmMap() }, [])
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <UpdateWatcher/>
          <EnvBadge/>
          <GameInviteListener/>
          <Suspense fallback={<FullScreenSpinner/>}>
            <Routes>
              <Route path="/" element={<HomeRoute/>}/>
              <Route path="/auth" element={<AuthPage/>}/>
              <Route path="/guest" element={<GuestRoute/>}/>
              <Route path="/try" element={<TryGamePage/>}/>
              <Route path="/vyzva/:eventId" element={<ChallengePage/>}/>
              <Route path="/auth/callback" element={<RootRedirect/>}/>
              <Route path="/reset-password" element={<ResetPasswordPage/>}/>
              <Route path="/menu"    element={<MenuGate><MenuPage/></MenuGate>}/>
              <Route path="/play"    element={<RequireAuth><PreGameLobbyPage/></RequireAuth>}/>
              <Route path="/game"    element={<RequireAuth><GamePage/></RequireAuth>}/>
              <Route path="/campaigns" element={<RequireAuth><CampaignsPage/></RequireAuth>}/>
              <Route path="/campaigns/:categoryId" element={<RequireAuth><CampaignsPage/></RequireAuth>}/>
              <Route path="/account" element={<RequireAuth><AccountPage/></RequireAuth>}/>
              <Route path="/premium" element={<RequireAuth><PremiumPage/></RequireAuth>}/>
              <Route path="/roadmap" element={<RequireAuth><RoadmapPage/></RequireAuth>}/>
              <Route path="/stats"   element={<RequireAuth><StatsPage/></RequireAuth>}/>
              <Route path="/leaderboard" element={<RequireAuth><LeaderboardPage/></RequireAuth>}/>
              <Route path="/player/:userId" element={<RequireAuth><PlayerProfilePage/></RequireAuth>}/>
              <Route path="/friends" element={<RequireAuth><FriendsPage/></RequireAuth>}/>
              <Route path="/admin"   element={<RequireAdmin><AdminHubPage/></RequireAdmin>}/>
              <Route path="/admin/events" element={<RequireAdmin><AdminPage/></RequireAdmin>}/>
              <Route path="/admin/import" element={<RequireAdmin><AdminImportPage/></RequireAdmin>}/>
              <Route path="/admin/daily" element={<RequireAdmin><AdminDailyChallengePage/></RequireAdmin>}/>
              <Route path="/admin/reports" element={<RequireAdmin><AdminReportsPage/></RequireAdmin>}/>
              <Route path="/admin/bulk-ai" element={<RequireAdmin><AdminBulkAIPage/></RequireAdmin>}/>
              <Route path="/admin/campaigns" element={<RequireAdmin><AdminCampaignsPage/></RequireAdmin>}/>
              <Route path="/admin/continents" element={<RequireAdmin><AdminContinentsPage/></RequireAdmin>}/>
              <Route path="/admin/panorama-repair" element={<RequireAdmin><AdminPanoramaRepairPage/></RequireAdmin>}/>
              <Route path="/admin/roadmap" element={<RequireAdmin><AdminRoadmapPage/></RequireAdmin>}/>
              <Route path="/admin/feedback" element={<RequireAdmin><AdminFeedbackPage/></RequireAdmin>}/>
              <Route path="/admin/tasks" element={<RequireAdmin><AdminEventTasksPage/></RequireAdmin>}/>
              <Route path="/editor" element={<RequireEditor><EditorPage/></RequireEditor>}/>
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
