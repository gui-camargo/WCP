import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface Pool {
  id: string
  name: string
}

export default function DashboardPage() {
  const { user, profile, setActivePool } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Preparando seu bolao...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    void ensureActivePoolAndRedirect()
  }, [user, profile?.active_pool_id])

  async function ensureActivePoolAndRedirect() {
    setError(null)
    setLoading(true)
    setMessage('Preparando seu bolao...')

    if (profile?.active_pool_id) {
      navigate(`/bolao/${profile.active_pool_id}`, { replace: true })
      return
    }

    setMessage('Entrando no bolao padrao...')

    const { data: defaultPoolData, error: defaultPoolError } = await supabase
      .from('pools')
      .select('id, name')
      .eq('is_default_global', true)
      .single()

    if (defaultPoolError || !defaultPoolData) {
      setError('Nao conseguimos encontrar seu bolao. Tente novamente mais tarde.')
      setLoading(false)
      return
    }

    const defaultPool = defaultPoolData as Pool

    const { error: joinError } = await (supabase.from('pool_members') as any).upsert(
      { pool_id: defaultPool.id, user_id: user!.id },
      { onConflict: 'pool_id,user_id', ignoreDuplicates: true }
    )

    if (joinError) {
      setError('Nao conseguimos te adicionar ao bolao. Tente novamente.')
      setLoading(false)
      return
    }

    const { error: setActiveError } = await setActivePool(defaultPool.id)
    if (setActiveError) {
      setError('Nao conseguimos preparar seu bolao. Tente novamente.')
      setLoading(false)
      return
    }

    navigate(`/bolao/${defaultPool.id}`, { replace: true })
  }

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800">Ola, {profile?.name ?? '...'}!</h1>
        {loading && <p className="text-gray-500 mt-2">{message}</p>}
        {!loading && error && (
          <div className="mt-4">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={() => void ensureActivePoolAndRedirect()}
              className="mt-3 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Tentar novamente
            </button>
          </div>
        )}
        {!loading && !error && (
          <p className="text-gray-500 mt-2">Redirecionando...</p>
        )}
      </div>
    </div>
  )
}
