import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface Pool {
  id: string
  name: string
  owner_id: string
  is_default_global?: boolean
}

export default function DashboardPage() {
  const { user, profile, setActivePool } = useAuth()
  const navigate = useNavigate()
  const [pools, setPools] = useState<Pool[]>([])
  const [newPoolName, setNewPoolName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectingPoolId, setSelectingPoolId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [memberPoolIds, setMemberPoolIds] = useState<string[]>([])

  useEffect(() => {
    if (user) loadPools()
  }, [user])

  useEffect(() => {
    if (loading || !profile?.active_pool_id) return
    const activePool = pools.find(pool => pool.id === profile.active_pool_id)
    if (activePool) {
      navigate(`/bolao/${activePool.id}`, { replace: true })
      return
    }

    if (pools.length > 0 && profile.active_pool_id) {
      void setActivePool(null)
    }
  }, [loading, pools, profile?.active_pool_id, navigate, setActivePool])

  async function loadPools() {
    setLoading(true)
    console.info('[Dashboard] loadPools:start', { userId: user!.id })

    const { data, error } = await supabase
      .from('pool_members')
      .select('pool_id, pools(id, name, owner_id, is_default_global)')
      .eq('user_id', user!.id)

    if (error) {
      console.error('[Dashboard] loadPools:error', {
        userId: user!.id,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
    } else {
      console.info('[Dashboard] loadPools:success', {
        userId: user!.id,
        rows: data?.length ?? 0,
      })
    }

    const memberList = (data ?? []).map((r: any) => r.pools).filter(Boolean) as Pool[]
    const memberIds = (data ?? []).map((r: any) => r.pool_id).filter(Boolean) as string[]

    const { data: defaultPoolData } = await supabase
      .from('pools')
      .select('id, name, owner_id, is_default_global')
      .eq('is_default_global', true)
      .limit(1)

    const defaultPool = (defaultPoolData?.[0] as Pool | undefined) ?? null
    const merged = [...memberList]
    if (defaultPool && !merged.some(pool => pool.id === defaultPool.id)) {
      merged.push(defaultPool)
    }

    setMemberPoolIds(memberIds)
    setPools(merged)
    setLoading(false)
  }

  async function createPool() {
    if (!newPoolName.trim()) return
    setCreating(true)
    const { data, error } = await (supabase.from('pools') as any)
      .insert({ name: newPoolName.trim(), owner_id: user!.id })
      .select()
      .single()

    if (!error && data) {
      await (supabase.from('pool_members') as any).insert({ pool_id: data.id, user_id: user!.id })
      setPools(prev => [...prev, data])
      await setActivePool(data.id)
      navigate(`/bolao/${data.id}`)
    }
    setNewPoolName('')
    setShowForm(false)
    setCreating(false)
  }

  async function handleChooseActivePool(poolId: string) {
    setSelectingPoolId(poolId)

    if (!memberPoolIds.includes(poolId)) {
      await (supabase.from('pool_members') as any).insert({ pool_id: poolId, user_id: user!.id })
      setMemberPoolIds(prev => (prev.includes(poolId) ? prev : [...prev, poolId]))
    }

    const { error } = await setActivePool(poolId)
    if (!error) {
      navigate(`/bolao/${poolId}`)
    }
    setSelectingPoolId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Olá, {profile?.name ?? '...'} 👋</h1>
          <p className="text-gray-500 text-sm">
            {profile?.active_pool_id ? 'Redirecionando para o seu bolão ativo...' : 'Escolha seu bolão ativo'}
          </p>
        </div>
        {profile?.is_admin && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            + Novo Bolão
          </button>
        )}
      </div>

      {profile?.is_admin && showForm && (
        <div className="bg-white rounded-xl shadow p-4 mb-6 flex gap-3">
          <input
            type="text"
            value={newPoolName}
            onChange={e => setNewPoolName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createPool()}
            placeholder="Nome do bolão..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={createPool}
            disabled={creating}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {creating ? '...' : 'Criar'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-center py-10">Carregando...</p>
      ) : pools.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🎯</p>
          <p>Você ainda não participa de nenhum bolão.</p>
          <p className="text-sm">{profile?.is_admin ? 'Crie um ou peça para um amigo te adicionar!' : 'Peça para um administrador te adicionar.'}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {pools.map(pool => (
            <div
              key={pool.id}
              className="bg-white rounded-xl shadow hover:shadow-md transition p-5 border border-transparent hover:border-brand-200"
            >
              <h2 className="font-semibold text-lg text-gray-800">{pool.name}</h2>
              <p className="text-sm text-gray-400 mt-1">
                {pool.owner_id === user?.id ? 'Você é o dono' : 'Participante'}
              </p>
              {pool.is_default_global && (
                <span className="inline-block mt-2 text-xs font-semibold px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                  Bolão padrão
                </span>
              )}

              <div className="mt-4 flex items-center justify-between">
                {profile?.active_pool_id === pool.id ? (
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
                    Bolão ativo
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Defina como bolão ativo</span>
                )}

                <button
                  onClick={() => handleChooseActivePool(pool.id)}
                  disabled={selectingPoolId === pool.id}
                  className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {selectingPoolId === pool.id
                    ? 'Entrando...'
                    : profile?.active_pool_id === pool.id
                      ? 'Entrar'
                      : 'Escolher'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
