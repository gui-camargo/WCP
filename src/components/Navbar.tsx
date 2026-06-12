import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import icon from '@/assets/icon.png'

export default function Navbar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [latestRoundId, setLatestRoundId] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const activePoolId = profile?.active_pool_id ?? null

  useEffect(() => {
    let cancelled = false

    async function loadLatestRound() {
      if (!activePoolId) {
        setLatestRoundId(null)
        return
      }

      const { data } = await supabase
        .from('rounds')
        .select('id')
        .eq('pool_id', activePoolId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (!cancelled) {
        const latest = (data as Array<{ id: string }> | null)?.[0] ?? null
        setLatestRoundId(latest?.id ?? null)
      }
    }

    loadLatestRound()
    return () => {
      cancelled = true
    }
  }, [activePoolId])

  const homeHref = useMemo(() => {
    if (!activePoolId) return '/dashboard'
    return `/bolao/${activePoolId}`
  }, [activePoolId])

  const meusPalpitesHref = useMemo(() => {
    if (!activePoolId) return '/dashboard'
    return `/bolao/${activePoolId}/palpites`
  }, [activePoolId])

  const jogosHref = useMemo(() => {
    if (!activePoolId || !latestRoundId) return homeHref
    return `/bolao/${activePoolId}/rodada/${latestRoundId}/palpites`
  }, [activePoolId, homeHref, latestRoundId])

  const regulamentoHref = useMemo(() => {
    if (!activePoolId) return '/dashboard'
    return `/bolao/${activePoolId}/regulamento`
  }, [activePoolId])

  const rankingHref = useMemo(() => {
    if (!activePoolId) return '/dashboard'
    return `/bolao/${activePoolId}/ranking`
  }, [activePoolId])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function handleMobileNavigate() {
    setMobileMenuOpen(false)
    setUserMenuOpen(false)
  }

  return (
    <nav className="bg-blue-950 text-white shadow-lg relative z-20">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link to="/dashboard" className="inline-flex items-center gap-2 font-bold text-xl tracking-tight">
          <img src={icon} alt="Ícone Bolão" className="h-7 w-7 rounded-md bg-white/10 p-0.5" />
          <span className="font-bebas tracking-wider uppercase">
            <span className="hidden md:inline text-lg">Bolão 'Bruno Ba-BET' Copa 2026</span>
            <span className="md:hidden text-lg">Bolão 'Bruno Ba-BET' 2026</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1 rounded-xl bg-white/10 border border-white/15 px-2 py-1">
            <Link to={homeHref} className="px-2 py-1 rounded-lg hover:bg-white/10 transition">Home</Link>
            <Link to={meusPalpitesHref} className="px-2 py-1 rounded-lg hover:bg-white/10 transition">Meus Palpites</Link>
            <Link to={jogosHref} className="px-2 py-1 rounded-lg hover:bg-white/10 transition">Resultados</Link>
            <Link to={rankingHref} className="px-2 py-1 rounded-lg hover:bg-white/10 transition">Ranking</Link>
            <Link to={regulamentoHref} className="px-2 py-1 rounded-lg hover:bg-white/10 transition">Regulamento</Link>
          </div>

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(open => !open)}
              className="inline-flex items-center gap-2 bg-white text-blue-900 px-3 py-1.5 rounded-xl text-sm font-semibold hover:bg-blue-50 transition"
            >
              {profile?.name ?? 'Usuário'}
              <span className="text-xs">▾</span>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-xl bg-white text-gray-700 shadow-lg border border-gray-100 overflow-hidden z-30">
                <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">Conta logada</div>
                {profile?.is_admin && activePoolId && (
                  <Link
                    to={`/bolao/${activePoolId}/admin`}
                    onClick={() => setUserMenuOpen(false)}
                    className="block w-full text-left px-3 py-2 text-sm font-medium hover:bg-gray-50 transition"
                  >
                    Administração
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-red-50 hover:text-red-600 transition"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 p-2 hover:bg-white/20 transition"
          onClick={() => setMobileMenuOpen(open => !open)}
          aria-label="Abrir menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm1 4a1 1 0 100 2h12a1 1 0 100-2H4z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/15 bg-blue-950 backdrop-blur px-4 py-4 space-y-3">
          <Link to={homeHref} onClick={handleMobileNavigate} className="block rounded-lg px-3 py-2 bg-white/5 hover:bg-white/10 transition">
            Home
          </Link>
          <Link to={meusPalpitesHref} onClick={handleMobileNavigate} className="block rounded-lg px-3 py-2 bg-white/5 hover:bg-white/10 transition">
            Meus Palpites
          </Link>
          <Link to={jogosHref} onClick={handleMobileNavigate} className="block rounded-lg px-3 py-2 bg-white/5 hover:bg-white/10 transition">
            Resultados
          </Link>
          <Link to={rankingHref} onClick={handleMobileNavigate} className="block rounded-lg px-3 py-2 bg-white/5 hover:bg-white/10 transition">
            Ranking
          </Link>
          <Link to={regulamentoHref} onClick={handleMobileNavigate} className="block rounded-lg px-3 py-2 bg-white/5 hover:bg-white/10 transition">
            Regulamento
          </Link>

          <div className="border-t border-white/15 pt-3 mt-3">
            <div className="px-1 text-xs text-brand-100 mb-2">Usuário logado</div>
            <div className="flex items-center justify-between rounded-lg bg-white text-brand-700 px-3 py-2">
              <span className="text-sm font-semibold truncate">{profile?.name ?? 'Usuário'}</span>
              <button
                onClick={handleSignOut}
                className="text-sm font-semibold text-red-600 hover:text-red-700"
              >
                Sair
              </button>
            </div>
            {profile?.is_admin && activePoolId && (
              <Link
                to={`/bolao/${activePoolId}/admin`}
                onClick={handleMobileNavigate}
                className="mt-2 block rounded-lg px-3 py-2 bg-white/5 hover:bg-white/10 transition text-sm"
              >
                Administração
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
