import { Navigate, Outlet, useParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function PaidRoute() {
  const { poolId } = useParams()
  const { loading, profile, getPoolPaymentStatus } = useAuth()
  const [paymentStatus, setPaymentStatus] = useState<'pendente' | 'confirmado' | 'rejeitado' | 'nao_encontrado' | null>(null)
  const [checkingPayment, setCheckingPayment] = useState(true)
  // Stable ref to avoid re-triggering the effect when getPoolPaymentStatus identity changes
  const getPaymentRef = useRef(getPoolPaymentStatus)
  getPaymentRef.current = getPoolPaymentStatus

  useEffect(() => {
    let active = true

    async function checkPayment() {
      if (!poolId || loading) return
      if (profile?.is_admin) {
        if (active) {
          setPaymentStatus('confirmado')
          setCheckingPayment(false)
        }
        return
      }

      setCheckingPayment(true)
      const status = await getPaymentRef.current(poolId)
      if (active) {
        setPaymentStatus(status)
        setCheckingPayment(false)
      }
    }

    checkPayment()
    return () => {
      active = false
    }
  }, [poolId, loading, profile?.is_admin])

  if (loading || checkingPayment) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Carregando...</div>
  }

  if (!poolId) {
    return <Navigate to="/dashboard" replace />
  }

  if (paymentStatus !== 'confirmado') {
    return <Navigate to={`/bolao/${poolId}/pagamento`} replace />
  }

  return <Outlet />
}
