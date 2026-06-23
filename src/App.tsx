import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { useEffect } from 'react'
import PrivateRoute from '@/components/PrivateRoute'
import PaidRoute from '@/components/PaidRoute'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import CadastroPage from '@/pages/CadastroPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import DashboardPage from '@/pages/DashboardPage'
import BolaoPage from '@/pages/BolaoPage'
import RodadaPage from '@/pages/RodadaPage'
import ResultadosPage from '@/pages/ResultadosPage'
import RankingPage from '@/pages/RankingPage'
import AdminPage from '@/pages/AdminPage'
import RegulamentoPage from '@/pages/RegulamentoPage'
import GroupPredictionsPage from '@/pages/GroupPredictionsPage'
import PodiumPredictionsPage from '@/pages/PodiumPredictionsPage'
import MeusPalpitesPage from '@/pages/MeusPalpitesPage'
import PaymentPendingPage from '@/pages/PaymentPendingPage'
import ParticipanteStatsPage from '@/pages/ParticipanteStatsPage'

const LAST_PATH_KEY = 'wcp-last-path'
const RESTORE_BLOCKLIST = ['/login', '/cadastro', '/esqueceu-senha', '/reset-senha']

function RouteTracker() {
  const location = useLocation()
  useEffect(() => {
    if (!RESTORE_BLOCKLIST.includes(location.pathname)) {
      localStorage.setItem(LAST_PATH_KEY, location.pathname)
    }
  }, [location.pathname])
  return null
}

function RootRedirect() {
  const { user, profile, loading } = useAuth()

  // Fast path: redirect immediately to last visited page.
  // PrivateRoute handles the auth check from there.
  const lastPath = localStorage.getItem(LAST_PATH_KEY)
  if (lastPath) return <Navigate to={lastPath} replace />

  // No saved path: wait for auth + profile before deciding where to go.
  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Carregando...</div>
  }
  if (!user) return <Navigate to="/login" replace />
  if (profile?.active_pool_id) return <Navigate to={`/bolao/${profile.active_pool_id}`} replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <RouteTracker />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<CadastroPage />} />
          <Route path="/esqueceu-senha" element={<ForgotPasswordPage />} />
          <Route path="/reset-senha" element={<ResetPasswordPage />} />
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/bolao/:poolId/pagamento" element={<PaymentPendingPage />} />
              <Route path="/bolao/:poolId/regulamento" element={<RegulamentoPage />} />

              <Route element={<PaidRoute />}>
                <Route path="/bolao/:poolId" element={<BolaoPage />} />
                <Route path="/bolao/:poolId/palpites" element={<MeusPalpitesPage />} />
                <Route path="/bolao/:poolId/rodada/:roundId" element={<RodadaPage />} />
                <Route path="/bolao/:poolId/rodada/:roundId/palpites" element={<ResultadosPage />} />
                <Route path="/bolao/:poolId/ranking" element={<RankingPage />} />
                <Route path="/bolao/:poolId/classificacao" element={<GroupPredictionsPage />} />
                <Route path="/bolao/:poolId/colocados" element={<PodiumPredictionsPage />} />
                <Route path="/bolao/:poolId/admin" element={<AdminPage />} />
                <Route path="/bolao/:poolId/participante/:userId" element={<ParticipanteStatsPage />} />
              </Route>
            </Route>
          </Route>
          <Route index element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
