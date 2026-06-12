import { Link, Navigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

type PaymentStatus = 'pendente' | 'confirmado' | 'rejeitado' | 'nao_encontrado'

export default function PaymentPendingPage() {
  const { poolId } = useParams()
  const { loading, profile, refreshPoolPaymentStatus } = useAuth()
  const [status, setStatus] = useState<PaymentStatus | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function loadStatus() {
    if (!poolId) return
    setRefreshing(true)
    const nextStatus = await refreshPoolPaymentStatus(poolId)
    setStatus(nextStatus)
    setRefreshing(false)
  }

  useEffect(() => {
    if (!loading && poolId) loadStatus()
  }, [loading, poolId])

  if (!poolId) return <Navigate to="/dashboard" replace />

  if (loading || status === null) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Carregando...</div>
  }

  if (profile?.is_admin || status === 'confirmado') {
    return <Navigate to={`/bolao/${poolId}`} replace />
  }

  const title = status === 'rejeitado' ? 'Pagamento rejeitado' : 'Pagamento pendente'
  const message =
    status === 'rejeitado'
      ? 'Seu pagamento foi marcado como rejeitado. Fale com o administrador para regularizar e liberar o acesso ao bolão.'
      : 'Seu acesso às funcionalidades do bolão será liberado após confirmação manual do pagamento pelo administrador.'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <section className="modern-card p-6 sm:p-8">
        <h1 className="text-2xl font-black tracking-tight text-slate-800">{title}</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{message}</p>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A chave PIX e os detalhes de pagamento sao divulgados externamente.
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            onClick={loadStatus}
            disabled={refreshing}
            className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {refreshing ? 'Atualizando...' : 'Ja paguei, atualizar status'}
          </button>

          <Link
            to={`/bolao/${poolId}/regulamento`}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Ver regulamento
          </Link>
        </div>
      </section>
    </div>
  )
}
