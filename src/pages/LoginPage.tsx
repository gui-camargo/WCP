import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import logo from '@/assets/logo.png'

interface Pool {
  id: string
  name: string
}

export default function LoginPage() {
  const { signIn, user, profile, setActivePool } = useAuth()
  const navigate = useNavigate()
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
      console.error('[Login] joinError', joinError)
      setError('Não conseguimos te adicionar ao bolão. Tente novamente.')
      setShouldRedirect(false)
      setLoading(false)
      return
    }

    const { error: setActiveError } = await setActivePool(defaultPool.id)
    if (setActiveError) {
      console.error('[Login] setActiveError', setActiveError)
      setError('Não conseguimos preparar seu bolão. Tente novamente.')
      setShouldRedirect(false)
      setLoading(false)
      return
    }

    navigate(`/bolao/${defaultPool.id}`, { replace: true })
  }

  useEffect(() => {
    if (shouldRedirect && user && profile) {
      console.info('[Login] redirectToPool:triggered', { userId: user.id, profileId: profile.id })
      void redirectToPool()
    }
  }, [shouldRedirect, user, profile])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    console.info('[Login] submit:start', { email })

    const { error } = await signIn(email, password)

    if (error) {
      console.error('[Login] submit:error', { email, error })
      setError('Email ou senha inválidos.')
      setLoading(false)
    } else {
      console.info('[Login] submit:success', { email })
      setShouldRedirect(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-accent-600 px-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl -mr-48 -mt-48" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -ml-48 -mb-48" />
      
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 relative z-10">
        <div className="text-center mb-12">
          <img src={logo} alt="Bolão Logo" className="h-40 w-40 mx-auto object-contain drop-shadow-lg" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-brand-600 to-accent-500 hover:from-brand-700 hover:to-accent-600 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50 shadow-lg hover:shadow-xl"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Não tem conta?{' '}
          <Link to="/cadastro" className="text-brand-600 font-medium hover:underline">
            Cadastre-se
          </Link>
        </p>

        <p className="text-center text-sm text-gray-500 mt-3">
          <Link to="/esqueceu-senha" className="text-brand-600 font-medium hover:underline">
            Esqueceu sua senha?
          </Link>
        </p>
      </div>
    </div>
  )
}
