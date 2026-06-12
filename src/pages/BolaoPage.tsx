import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import TeamWithFlag from '@/components/TeamWithFlag'
import ResultMatchCard from '@/components/ResultMatchCard'
import MatchPredictionsModal from '@/components/MatchPredictionsModal'
import { IconAward, IconParticipants, IconUpcomingMatches, IconFinishedMatches, IconMyPredictions, IconRanking } from '@/components/Icons'
import logoAlt from '@/assets/logo_alt.png'
import worldCup2026Logo from '@/assets/FIFA-2026-World-Cup-Logo-75.png'

interface Round {
  id: string
  name: string
  phase: string
}

interface LeaderboardRow {
  user_id: string
  user_name: string
  total_points: number
  rank: number
}

interface MatchRow {
  id: string
  round_id: string
  kickoff_at: string
  venue: string
  cutoff_at: string
  status: 'pendente' | 'encerrado'
  home_score: number | null
  away_score: number | null
  home_team: { name: string; flag_code: string | null } | null
  away_team: { name: string; flag_code: string | null } | null
}

interface PredictionRow {
  match_id: string
  home_guess: number
  away_guess: number
  points: number | null
}

interface UserPred {
  user_id: string
  user_name: string
  home_guess: number
  away_guess: number
  points: number | null
}

interface PrizeOverview {
  confirmed_count: number
  first_prize_cents: number
  second_prize_cents: number
  third_prize_cents: number
}

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export default function BolaoPage() {
  const { poolId } = useParams()
  const { user } = useAuth()
  const [poolName, setPoolName] = useState('')
  const [rounds, setRounds] = useState<Round[]>([])
  const [topRanking, setTopRanking] = useState<LeaderboardRow[]>([])
  const [myRanking, setMyRanking] = useState<LeaderboardRow | null>(null)
  const [recentMatches, setRecentMatches] = useState<MatchRow[]>([])
  const [upcomingTodayMatches, setUpcomingTodayMatches] = useState<MatchRow[]>([])
  const [predictionsByMatch, setPredictionsByMatch] = useState<Record<string, PredictionRow>>({})
  const [selectedPastMatchId, setSelectedPastMatchId] = useState<string | null>(null)
  const [userPreds, setUserPreds] = useState<UserPred[]>([])
  const [loadingPastPreds, setLoadingPastPreds] = useState(false)
  const [prizeOverview, setPrizeOverview] = useState<PrizeOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (poolId && user) loadData()
  }, [poolId, user])

  useEffect(() => {
    if (!selectedPastMatchId) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closePastPredsModal()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedPastMatchId])

  async function loadData() {
    setLoading(true)

    const { data: pool } = await supabase.from('pools').select('name').eq('id', poolId!).single()
    setPoolName((pool as any)?.name ?? '')

    const { data: prizeData, error: prizeError } = await (supabase as any)
      .rpc('get_pool_prize_overview', { p_pool_id: poolId! })

    if (prizeError) {
      setPrizeOverview(null)
    } else {
      const row = Array.isArray(prizeData) ? prizeData[0] : prizeData
      if (row) {
        setPrizeOverview({
          confirmed_count: Number(row.confirmed_count ?? 0),
          first_prize_cents: Number(row.first_prize_cents ?? 0),
          second_prize_cents: Number(row.second_prize_cents ?? 0),
          third_prize_cents: Number(row.third_prize_cents ?? 0),
        })
      } else {
        setPrizeOverview({
          confirmed_count: 0,
          first_prize_cents: 0,
          second_prize_cents: 0,
          third_prize_cents: 0,
        })
      }
    }

    const { data: roundData } = await supabase
      .from('rounds')
      .select('*')
      .eq('pool_id', poolId!)
      .order('created_at')
    const nextRounds = (roundData ?? []) as Round[]
    setRounds(nextRounds)

    const roundIds = nextRounds.map(r => r.id)

    const { data: leaderboardData } = await supabase
      .from('leaderboard')
      .select('user_id, user_name, total_points, rank')
      .eq('pool_id', poolId!)
      .order('rank', { ascending: true })
      .order('user_name', { ascending: true })

    const filteredRows = (leaderboardData ?? []) as LeaderboardRow[]

    setTopRanking(filteredRows.slice(0, 5))
    setMyRanking(filteredRows.find(row => row.user_id === user!.id) ?? null)

    if (roundIds.length > 0) {
      const matchSelect = `
        id, round_id, kickoff_at, venue, cutoff_at, status, home_score, away_score,
        home_team:teams!matches_home_team_id_fkey(name, flag_code),
        away_team:teams!matches_away_team_id_fkey(name, flag_code)
      `

      const [{ data: recentData }, { data: upcomingData }] = await Promise.all([
        supabase
          .from('matches')
          .select(matchSelect)
          .in('round_id', roundIds)
          .eq('status', 'encerrado')
          .order('kickoff_at', { ascending: false })
          .limit(3),
        supabase
          .from('matches')
          .select(matchSelect)
          .in('round_id', roundIds)
          .neq('status', 'encerrado')
          .order('kickoff_at', { ascending: true })
          .limit(3),
      ])

      const recent = ((recentData ?? []) as unknown as MatchRow[]).reverse()
      const upcoming = (upcomingData ?? []) as unknown as MatchRow[]

      setRecentMatches(recent)
      setUpcomingTodayMatches(upcoming)

      const matchIds = [...recent, ...upcoming].map(m => m.id)
      if (matchIds.length > 0) {
        const { data: predsData } = await supabase
          .from('predictions')
          .select('match_id, home_guess, away_guess, points')
          .eq('pool_id', poolId!)
          .eq('user_id', user!.id)
          .in('match_id', matchIds)

        const map: Record<string, PredictionRow> = {}
        for (const p of (predsData ?? []) as PredictionRow[]) map[p.match_id] = p
        setPredictionsByMatch(map)
      } else {
        setPredictionsByMatch({})
      }
    } else {
      setRecentMatches([])
      setUpcomingTodayMatches([])
      setPredictionsByMatch({})
    }

    setLoading(false)
  }

  function dayLabel(kickoffAt: string): { label: string; className: string } {
    const now = new Date()
    const kickoffDate = new Date(kickoffAt)

    if (kickoffDate <= now) {
      return { label: '🔴 Em Andamento', className: 'bg-red-100 text-red-700' }
    }

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const matchDay = new Date(kickoffDate.getFullYear(), kickoffDate.getMonth(), kickoffDate.getDate())
    const time = kickoffDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    if (matchDay.getTime() === today.getTime()) return { label: `HOJE · ${time}`, className: 'bg-emerald-100 text-emerald-700' }
    if (matchDay.getTime() === tomorrow.getTime()) return { label: `Amanhã · ${time}`, className: 'bg-sky-100 text-sky-700' }
    const date = kickoffDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    return { label: `${date} · ${time}`, className: 'bg-gray-100 text-gray-600' }
  }

  function findRoundName(roundId: string) {
    return rounds.find(r => r.id === roundId)?.name ?? 'Rodada'
  }

  function compactRoundLabel(label: string) {
    return label.replace(/rodada\s*(\d+)/gi, 'R$1')
  }

  function formatCents(cents: number) {
    return brlFormatter.format(cents / 100)
  }

  function closePastPredsModal() {
    setSelectedPastMatchId(null)
    setUserPreds([])
  }

  async function openPastPredsModal(matchId: string) {
    if (!poolId) return

    setSelectedPastMatchId(matchId)
    setLoadingPastPreds(true)

    const [predsRes, leaderboardRes] = await Promise.all([
      supabase
        .from('predictions')
        .select('user_id, home_guess, away_guess, points')
        .eq('pool_id', poolId)
        .eq('match_id', matchId),
      supabase
        .from('leaderboard')
        .select('user_id, user_name')
        .eq('pool_id', poolId),
    ])

    const predsData = predsRes.data ?? []
    const predictedUserIds = Array.from(new Set(predsData.map((r: any) => r.user_id).filter(Boolean)))

    const nameByUserId = new Map<string, string>(
      (leaderboardRes.data ?? []).map((row: any) => [row.user_id, row.user_name])
    )

    if (predictedUserIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', predictedUserIds)

      for (const row of profilesData ?? []) {
        if (!nameByUserId.has((row as any).id) && (row as any).name) {
          nameByUserId.set((row as any).id, (row as any).name)
        }
      }
    }

    const list: UserPred[] = predsData.map((r: any) => ({
      user_id: r.user_id,
      user_name: nameByUserId.get(r.user_id) ?? `Usuario ${String(r.user_id).slice(0, 8)}`,
      home_guess: r.home_guess,
      away_guess: r.away_guess,
      points: r.points,
    }))

    setUserPreds(list)
    setLoadingPastPreds(false)
  }

  return (
    <div className="space-y-2">
      <div className="fade-rise relative overflow-hidden px-4 sm:px-0 pt-4 pb-4 sm:pt-4 sm:pb-4 bg-gradient-to-r from-brand-700 via-emerald-600 to-sky-600 rounded-3xl shadow-none -mt-4">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-6 right-6 h-16 w-16 rounded-full bg-white/10 blur-2xl" />
        </div>
        <div className="relative z-10 flex flex-row items-center justify-center gap-2 sm:gap-6 w-full">
          <img src={logoAlt} alt="Logo Bolão" className="h-14 sm:h-24 w-auto drop-shadow-md flex-shrink-0 mx-2 sm:mx-4" />
          <h1 className="flex-1 font-bebas text-xl sm:text-4xl tracking-widest uppercase text-white text-center drop-shadow-lg mx-2">
            {poolName}
          </h1>
          <img src={worldCup2026Logo} alt="Logo Copa do Mundo 2026" className="h-14 sm:h-24 w-auto drop-shadow-md flex-shrink-0 mx-2 sm:mx-4" />
        </div>
      </div>

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-2">
          <section className="lg:col-span-12 modern-card soft-hover fade-rise p-4 sm:p-5 border border-emerald-100 bg-slate-50">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center justify-between gap-2.5 sm:justify-start sm:shrink-0">
                <h2 className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-4 text-sm sm:text-base font-extrabold text-amber-600 shadow-sm">
                  <IconAward className="w-6 h-6 sm:w-7 sm:h-7 text-amber-600" />
                  Premiação
                  <IconAward className="w-6 h-6 sm:w-7 sm:h-7 text-amber-600" />
                </h2>
                <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-center min-w-[120px] sm:min-w-[180px] flex sm:flex-row items-center justify-center gap-2 sm:gap-2.5">
                  <IconParticipants className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-700 flex-shrink-0" />
                  <div className="flex flex-col items-start justify-center gap-0">
                    <p className="text-sm sm:text-base font-extrabold text-emerald-800">{prizeOverview?.confirmed_count ?? 0}</p>
                    <p className="text-xs sm:text-sm font-semibold text-emerald-700">participantes</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-2 w-full sm:w-auto sm:ml-auto">
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-center min-w-[96px] sm:min-w-[88px]">
                  <p className="text-[11px] uppercase tracking-wide font-bold text-yellow-700">1º · 70%</p>
                  <p className="text-sm sm:text-base font-extrabold text-yellow-800">{formatCents(prizeOverview?.first_prize_cents ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center min-w-[96px] sm:min-w-[88px]">
                  <p className="text-[11px] uppercase tracking-wide font-bold text-slate-600">2º · 20%</p>
                  <p className="text-sm sm:text-base font-extrabold text-slate-700">{formatCents(prizeOverview?.second_prize_cents ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center min-w-[96px] sm:min-w-[88px]">
                  <p className="text-[11px] uppercase tracking-wide font-bold text-amber-700">3º · 10%</p>
                  <p className="text-sm sm:text-base font-extrabold text-amber-800">{formatCents(prizeOverview?.third_prize_cents ?? 0)}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="lg:col-span-6 modern-card soft-hover fade-rise p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-gray-800">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-950 text-white flex-shrink-0">
                  <IconUpcomingMatches className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
                Próximas partidas
              </h2>
              <Link
                to={`/bolao/${poolId}/palpites`}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-100 transition"
              >
                Ver palpites
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3"><path fillRule="evenodd" d="M7.22 4.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
              </Link>
            </div>
            <hr className="border-slate-100 mb-3" />
            {upcomingTodayMatches.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma próxima partida encontrada.</p>
            ) : (
              <div className="space-y-2">
                {upcomingTodayMatches.map(match => {
                  const pred = predictionsByMatch[match.id]
                  const day = dayLabel(match.kickoff_at)
                  const hasPred = pred?.home_guess !== undefined && pred?.away_guess !== undefined
                  const canViewPreds = new Date(match.cutoff_at) <= new Date()

                  return (
                    <div key={match.id} className={`rounded-2xl border p-2.5 sm:p-3 transition ${
                      hasPred
                          ? 'border-sky-200 bg-sky-50/60'
                        : 'border-rose-300 bg-rose-50/70 ring-1 ring-rose-200'
                    }`}>
                      {/* meta */}
                      <p className="text-[10px] text-center text-slate-500 font-medium mb-1.5">
                        <span className="sm:hidden">{compactRoundLabel(findRoundName(match.round_id))} · </span>
                        <span className="hidden sm:inline">{findRoundName(match.round_id)} · </span>
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-bold ${day.className}`}>{day.label}</span>
                      </p>

                      {/* times */}
                      <div className="flex items-center justify-center gap-2 mb-2.5">
                        <TeamWithFlag
                          name={match.home_team?.name}
                          flagCode={match.home_team?.flag_code}
                          size="sm"
                          compact
                          reverse
                          align="right"
                          className="flex-1 font-semibold text-gray-800 justify-end"
                        />
                        <span className="text-xs font-bold text-slate-400 px-1">×</span>
                        <TeamWithFlag
                          name={match.away_team?.name}
                          flagCode={match.away_team?.flag_code}
                          size="sm"
                          compact
                          align="left"
                          className="flex-1 font-semibold text-gray-800"
                        />
                      </div>

                      {/* prediction area – main focus */}
                      {canViewPreds && hasPred ? (
                        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                          <span aria-hidden="true" />
                          <div className="justify-self-center flex flex-col items-center gap-0.5 -mt-1">
                            <span className="inline-flex items-center rounded-lg border border-sky-300 bg-sky-100 px-2.5 py-0.5 text-sm sm:text-base font-extrabold text-sky-800 tracking-wide leading-none">
                              {pred.home_guess} × {pred.away_guess}
                            </span>
                            <span className="text-[11px] text-sky-700 font-semibold">seu palpite</span>
                          </div>
                          <button
                            onClick={() => openPastPredsModal(match.id)}
                            className="justify-self-end inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-50 transition"
                          >
                              👁️ Palpites
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3"><path fillRule="evenodd" d="M7.22 4.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
                          </button>
                        </div>
                      ) : hasPred ? (
                        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                          <span aria-hidden="true" />
                          <div className="justify-self-center flex flex-col items-center gap-0.5 -mt-1">
                            <span className="inline-flex items-center rounded-lg border border-sky-300 bg-sky-100 px-2.5 py-0.5 text-sm sm:text-base font-extrabold text-sky-800 tracking-wide leading-none">
                              {pred.home_guess} × {pred.away_guess}
                            </span>
                            <span className="text-[11px] text-sky-700 font-semibold">seu palpite</span>
                          </div>
                          <Link
                            to={`/bolao/${poolId}/rodada/${match.round_id}`}
                            className="justify-self-end inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-50 transition"
                          >
                              ✏️ Alterar
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3"><path fillRule="evenodd" d="M7.22 4.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
                          </Link>
                        </div>
                      ) : (
                        <Link
                          to={`/bolao/${poolId}/rodada/${match.round_id}`}
                          className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold py-1.5 transition"
                        >
                          <span>⚠️</span> Dar palpite
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="lg:col-span-6 modern-card soft-hover fade-rise p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-gray-800">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-950 text-white flex-shrink-0">
                    <IconFinishedMatches className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </span>
                  Partidas passadas
                </h2>
                <Link
                  to={`/bolao/${poolId}/rodada/${recentMatches[recentMatches.length - 1]?.round_id ?? rounds[rounds.length - 1]?.id ?? ''}/palpites`}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-100 transition"
                >
                  Ver resultados
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3"><path fillRule="evenodd" d="M7.22 4.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
                </Link>
              </div>
              <hr className="border-slate-100 mb-3" />
              {recentMatches.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma partida encerrada ainda.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-auto pr-1">
                  {recentMatches.map(match => {
                    const pred = predictionsByMatch[match.id]
                    return (
                      <button
                        key={match.id}
                        type="button"
                        onClick={() => openPastPredsModal(match.id)}
                        className="block w-full text-left"
                      >
                        <ResultMatchCard
                          kickoffAt={match.kickoff_at}
                          venue={match.venue}
                          metaPrefix={findRoundName(match.round_id)}
                          metaPrefixMobile={compactRoundLabel(findRoundName(match.round_id))}
                          homeTeam={match.home_team}
                          awayTeam={match.away_team}
                          homeScore={match.home_score}
                          awayScore={match.away_score}
                          canViewPreds
                          isClosed={match.status === 'encerrado'}
                          myPrediction={pred}
                          className="hover:border-brand-200"
                        />
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

          <section className="lg:col-span-12 modern-card soft-hover fade-rise p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-gray-800">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-950 text-white flex-shrink-0">
                    <IconMyPredictions className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </span>
                  Meus Palpites
                </h2>
                <p className="text-xs text-gray-500 mt-1">Classificação, grupos e mata-mata</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  to={`/bolao/${poolId}/palpites`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-950 hover:bg-blue-900 text-white text-xs font-semibold transition"
                >
                  Abrir
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3"><path fillRule="evenodd" d="M7.22 4.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
                </Link>
              </div>
            </div>
          </section>

          <section className="lg:col-span-12 modern-card soft-hover fade-rise p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-gray-800">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-950 text-white flex-shrink-0">
                  <IconRanking className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
                Ranking
              </h2>
              <Link to={`/bolao/${poolId}/ranking`} className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-100 transition">
                Ver completo
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3"><path fillRule="evenodd" d="M7.22 4.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
              </Link>
            </div>
            <hr className="border-slate-100 mb-3" />
            {topRanking.length === 0 ? (
              <p className="text-sm text-gray-400">Sem ranking ainda.</p>
            ) : (
              <div className="space-y-2">
                {topRanking.map(row => {
                  const isTop = row.rank <= 3
                  const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : '🥉'
                  const outerClass = isTop
                    ? row.rank === 1
                      ? 'bg-yellow-50 border border-yellow-200 shadow-md'
                      : row.rank === 2
                        ? 'bg-slate-50 border border-gray-200 shadow-sm'
                        : 'bg-amber-50 border border-amber-200 shadow-sm'
                    : 'bg-gradient-to-r from-slate-50 to-white border border-gray-100'

                  return (
                    <div key={row.user_id} className={`flex items-center justify-between rounded-xl px-2 py-2 ${outerClass}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={isTop ? 'text-xl sm:text-2xl shrink-0' : 'text-base shrink-0'}>{isTop ? medal : `#${row.rank}`}</span>
                        <p className={isTop ? 'text-sm sm:text-sm font-extrabold text-gray-800 truncate' : 'text-sm text-gray-700 font-medium truncate'}>
                          {row.user_name}
                          {row.user_id === user?.id && (
                            <span
                              title="Você"
                              aria-label="Você (esta é a sua conta)"
                              className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-normal bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm"
                            >você</span>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <span className={isTop ? ('inline-flex items-center px-3 py-1 rounded-full font-bold text-base sm:text-lg ' + (row.total_points >= 100 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-white text-brand-700 border border-gray-100')) : ('inline-flex items-center px-2 py-0.5 rounded-full font-bold text-xs ' + (row.total_points >= 100 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-white text-brand-700 border border-gray-100'))}>
                          {row.total_points}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {myRanking && !topRanking.some(r => r.user_id === user?.id) && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between rounded-xl px-2 py-2 bg-gradient-to-r from-brand-50 to-sky-50 border border-brand-100">
                  <div className="flex items-center gap-2">
                    <span className="text-base">#{myRanking.rank}</span>
                    <p className="text-sm font-bold text-brand-700 truncate">{myRanking.user_name} <span title="Você" aria-label="Você (esta é a sua conta)" className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-normal bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">você</span></p>
                  </div>
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-xs bg-white text-brand-700 border border-gray-100">{myRanking.total_points}</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      <MatchPredictionsModal
        open={Boolean(selectedPastMatchId)}
        match={selectedPastMatchId ? (recentMatches.find(m => m.id === selectedPastMatchId) || upcomingTodayMatches.find(m => m.id === selectedPastMatchId)) ?? null : null}
        userPreds={userPreds}
        loadingPreds={loadingPastPreds}
        onClose={closePastPredsModal}
        currentUserId={user?.id ?? null}
      />
    </div>
  )
}
