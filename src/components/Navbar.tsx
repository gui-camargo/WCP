import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export default function Navbar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [latestRoundId, setLatestRoundId] = useState<string | null>(null)

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

  const palpitesHref = useMemo(() => {
    if (!activePoolId || !latestRoundId) return homeHref
    return `/bolao/${activePoolId}/rodada/${latestRoundId}/palpites`
  }, [activePoolId, homeHref, latestRoundId])

  const adminHref = useMemo(() => {
    if (!activePoolId) return '/dashboard'
    return `/bolao/${activePoolId}/admin`
  }, [activePoolId])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <nav className="bg-brand-700 text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/dashboard" className="font-bold text-xl tracking-tight">
          🏆 Bolão Copa
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to={homeHref} className="hover:text-brand-100">Home</Link>
          <Link to={palpitesHref} className="hover:text-brand-100">Palpites</Link>
          {profile?.is_admin && (
            <Link to={adminHref} className="hover:text-brand-100">Admin</Link>
          )}
          <span className="text-brand-200">{profile?.name}</span>
          <button
            onClick={handleSignOut}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-xs"
          >
            Sair
          </button>
        </div>
      </div>
    </nav>
  )
}
