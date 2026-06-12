import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
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
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
