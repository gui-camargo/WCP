import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import PrivateRoute from '@/components/PrivateRoute'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import CadastroPage from '@/pages/CadastroPage'
import DashboardPage from '@/pages/DashboardPage'
import BolaoPage from '@/pages/BolaoPage'
import RodadaPage from '@/pages/RodadaPage'
import PalpitesPage from '@/pages/PalpitesPage'
import RankingPage from '@/pages/RankingPage'
import AdminPage from '@/pages/AdminPage'
import RegulamentoPage from '@/pages/RegulamentoPage'
import GroupPredictionsPage from '@/pages/GroupPredictionsPage'
import MeusPalpitesPage from '@/pages/MeusPalpitesPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<CadastroPage />} />
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/bolao/:poolId" element={<BolaoPage />} />
              <Route path="/bolao/:poolId/palpites" element={<MeusPalpitesPage />} />
              <Route path="/bolao/:poolId/rodada/:roundId" element={<RodadaPage />} />
              <Route path="/bolao/:poolId/rodada/:roundId/palpites" element={<PalpitesPage />} />
              <Route path="/bolao/:poolId/ranking" element={<RankingPage />} />
              <Route path="/bolao/:poolId/classificacao" element={<GroupPredictionsPage />} />
              <Route path="/bolao/:poolId/regulamento" element={<RegulamentoPage />} />
              <Route path="/bolao/:poolId/admin" element={<AdminPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
