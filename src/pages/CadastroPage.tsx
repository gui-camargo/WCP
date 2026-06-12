import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface Pool {
  id: string
  name: string
}

export default function CadastroPage() {
  const { signUp, user, profile, setActivePool } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [shouldRedirect, setShouldRedirect] = useState(false)

  async function redirectToPool() {
    if (!user) return

    if (profile?.active_pool_id) {
      navigate(`/bolao/${profile.active_pool_id}`, { replace: true })
      return
    }

    const { data: defaultPoolData, error: defaultPoolError } = await supabase
      .from('pools')
      .select('id, name')
      .eq('is_default_global', true)
      .single()

    if (defaultPoolError || !defaultPoolData) {
      setError('Não conseguimos encontrar seu bolão. Tente novamente mais tarde.')
      setShouldRedirect(false)
      setLoading(false)
      return
    }

    const defaultPool = defaultPoolData as Pool

    const { error: joinError } = await (supabase.from('pool_members') as any).upsert(
      { pool_id: defaultPool.id, user_id: user.id },
      { onConflict: 'pool_id,user_id', ignoreDuplicates: true }
    )

    if (joinError) {
      console.error('[Cadastro] joinError', joinError)
      setError('Não conseguimos te adicionar ao bolão. Tente novamente.')
      setShouldRedirect(false)
      setLoading(false)
      return
    }

    const { error: setActiveError } = await setActivePool(defaultPool.id)
    if (setActiveError) {
      console.error('[Cadastro] setActiveError', setActiveError)
      setError('Não conseguimos preparar seu bolão. Tente novamente.')
      setShouldRedirect(false)
      setLoading(false)
      return
    }

    navigate(`/bolao/${defaultPool.id}`, { replace: true })
  }

  useEffect(() => {
    if (shouldRedirect && user && profile) {
      console.info('[Cadastro] redirectToPool:triggered', { userId: user.id, profileId: profile.id })
      void redirectToPool()
    }
  }, [shouldRedirect, user, profile])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    console.info('[Cadastro] submit:start', { email, nameLength: name.trim().length })

    setLoading(true)
    try {
      const { error } = await signUp(email, password, name)
      if (error) {
        console.error('[Cadastro] submit:error', { email, error })
        setError(error)
        setLoading(false)
      } else {
        console.info('[Cadastro] submit:success', { email })
        setShouldRedirect(true)
      }
    } catch (err) {
      console.error('[Cadastro] submit:unexpected_error', err)
      setError('Erro inesperado no cadastro. Veja o console para detalhes.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-accent-600 px-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl -mr-48 -mt-48" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -ml-48 -mb-48" />
      
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 relative z-10">
        <div className="text-center mb-8">
          <span className="text-5xl">🏆</span>
          <h1 className="text-2xl font-bold text-brand-700 mt-2">Criar conta</h1>
          <p className="text-gray-500 text-sm mt-1">Participe do bolão da Copa</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              placeholder="Nome ou Apelido"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-brand-600 to-accent-500 hover:from-brand-700 hover:to-accent-600 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50 shadow-lg hover:shadow-xl"
          >
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Já tem conta?{' '}
          <Link to="/login" className="text-brand-600 font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
