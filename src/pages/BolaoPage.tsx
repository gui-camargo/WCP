import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import TeamWithFlag from '@/components/TeamWithFlag'

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

const PHASE_LABELS: Record<string, string> = {
  grupos: 'Fase de Grupos',
  oitavas: 'Oitavas de Final',
  quartas: 'Quartas de Final',
  semi: 'Semifinal',
  terceiro_lugar: 'Disputa de 3º',
  final: 'Final',
}

export default function BolaoPage() {
  const { poolId } = useParams()
  const { user, profile } = useAuth()
  const [poolName, setPoolName] = useState('')
  const [rounds, setRounds] = useState<Round[]>([])
  const [topRanking, setTopRanking] = useState<LeaderboardRow[]>([])
  const [myRanking, setMyRanking] = useState<LeaderboardRow | null>(null)
  const [yesterdayMatches, setYesterdayMatches] = useState<MatchRow[]>([])
  const [upcomingTodayMatches, setUpcomingTodayMatches] = useState<MatchRow[]>([])
  const [predictionsByMatch, setPredictionsByMatch] = useState<Record<string, PredictionRow>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (poolId && user) loadData()
  }, [poolId, user])

  async function loadData() {
    setLoading(true)

    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const startYesterday = new Date(startToday)
    startYesterday.setDate(startYesterday.getDate() - 1)
    const startTomorrow = new Date(startToday)
    startTomorrow.setDate(startTomorrow.getDate() + 1)

    const { data: pool } = await supabase.from('pools').select('name').eq('id', poolId!).single()
    setPoolName((pool as any)?.name ?? '')

    const { data: roundData } = await supabase
      .from('rounds')
      .select('*')
      .eq('pool_id', poolId!)
      .order('created_at')
    const nextRounds = (roundData ?? []) as Round[]
    setRounds(nextRounds)

    const roundIds = nextRounds.map(r => r.id)

    const [{ data: topData }, { data: mineData }] = await Promise.all([
      supabase
        .from('leaderboard')
        .select('user_id, user_name, total_points, rank')
        .eq('pool_id', poolId!)
        .order('rank', { ascending: true })
        .limit(5),
      supabase
        .from('leaderboard')
        .select('user_id, user_name, total_points, rank')
        .eq('pool_id', poolId!)
        .eq('user_id', user!.id)
        .maybeSingle(),
    ])

    setTopRanking((topData ?? []) as LeaderboardRow[])
    setMyRanking((mineData as LeaderboardRow | null) ?? null)

    if (roundIds.length > 0) {
      const { data: matchesData } = await supabase
        .from('matches')
        .select(`
          id, round_id, kickoff_at, venue, status, home_score, away_score,
          home_team:teams!matches_home_team_id_fkey(name, flag_code),
          away_team:teams!matches_away_team_id_fkey(name, flag_code)
        `)
        .in('round_id', roundIds)
        .gte('kickoff_at', startYesterday.toISOString())
        .lt('kickoff_at', startTomorrow.toISOString())
        .order('kickoff_at')

      const allMatches = ((matchesData ?? []) as unknown as MatchRow[])
      const yesterday = allMatches.filter(m => {
        const d = new Date(m.kickoff_at)
        return d >= startYesterday && d < startToday && m.status === 'encerrado'
      })
      const upcoming = allMatches.filter(m => {
        const d = new Date(m.kickoff_at)
        return d >= startToday && d < startTomorrow && d >= now && m.status !== 'encerrado'
      })

      setYesterdayMatches(yesterday)
      setUpcomingTodayMatches(upcoming)

      const matchIds = allMatches.map(m => m.id)
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
      setYesterdayMatches([])
      setUpcomingTodayMatches([])
      setPredictionsByMatch({})
    }

    setLoading(false)
  }

  function formatDateTime(value: string) {
    return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  function findRoundName(roundId: string) {
    return rounds.find(r => r.id === roundId)?.name ?? 'Rodada'
  }

  const byPhase = rounds.reduce<Record<string, Round[]>>((acc, r) => {
    acc[r.phase] = acc[r.phase] ?? []
    acc[r.phase].push(r)
    return acc
  }, {})

  const phaseOrder = ['grupos', 'oitavas', 'quartas', 'semi', 'terceiro_lugar', 'final']

  return (
    <div className="space-y-8">
      <div className="modern-card soft-hover fade-rise relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -top-12 -right-16 h-40 w-40 rounded-full bg-sky-200/40 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-emerald-200/40 blur-2xl" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="modern-chip">Bolão ativo</span>
            <span className="modern-chip">{rounds.length} rodadas</span>
            <span className="modern-chip">{upcomingTodayMatches.length} jogos hoje</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-800">{poolName}</h1>

          <div className="flex flex-wrap gap-2 mt-4">
            <Link
              to={`/bolao/${poolId}/ranking`}
              className="inline-flex items-center px-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition"
            >
              Ver ranking completo
            </Link>
            {profile?.is_admin && (
              <Link
                to={`/bolao/${poolId}/admin`}
                className="inline-flex items-center px-3 py-2 rounded-xl bg-white/90 border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-white transition"
              >
                Administração
              </Link>
            )}
          </div>
        </div>
      </div>

      {!loading && (
        <div className="grid grid-cols-1 2xl:grid-cols-12 gap-4 mb-2">
          <section className="2xl:col-span-4 modern-card soft-hover fade-rise p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-bold text-gray-800">Ranking</h2>
              <Link to={`/bolao/${poolId}/ranking`} className="text-xs sm:text-sm text-brand-600 hover:underline">
                Ver completo
              </Link>
            </div>
            {topRanking.length === 0 ? (
              <p className="text-sm text-gray-400">Sem ranking ainda.</p>
            ) : (
              <div className="space-y-2">
                {topRanking.map(row => (
                  <div key={row.user_id} className="flex items-center justify-between rounded-xl bg-gradient-to-r from-slate-50 to-white px-3 py-2.5 border border-gray-100">
                    <p className="text-sm text-gray-700 font-medium">#{row.rank} {row.user_name}</p>
                    <p className="text-sm font-bold text-gray-800">{row.total_points} pts</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Minha colocação</p>
              {myRanking ? (
                <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-brand-50 to-sky-50 px-3 py-2.5 border border-brand-100">
                  <p className="text-sm font-bold text-brand-700">#{myRanking.rank} {myRanking.user_name}</p>
                  <p className="text-sm font-bold text-brand-700">{myRanking.total_points} pts</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Você ainda não apareceu no ranking.</p>
              )}
            </div>
          </section>

          <section className="2xl:col-span-4 modern-card soft-hover fade-rise p-4 sm:p-5">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-3">Partidas de ontem</h2>
            {yesterdayMatches.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma partida encerrada ontem.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-auto pr-1">
                {yesterdayMatches.map(match => {
                  const pred = predictionsByMatch[match.id]
                  return (
                    <div key={match.id} className="rounded-xl border border-gray-100 bg-gradient-to-br from-white to-slate-50 p-3">
                      <p className="text-[11px] text-gray-400 font-medium">{formatDateTime(match.kickoff_at)}</p>
                      <p className="text-xs text-gray-500 mb-1">{findRoundName(match.round_id)}</p>
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                        <TeamWithFlag size="sm" name={match.home_team?.name} flagCode={match.home_team?.flag_code} />
                        <span className="font-extrabold">{match.home_score} × {match.away_score}</span>
                        <TeamWithFlag size="sm" name={match.away_team?.name} flagCode={match.away_team?.flag_code} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Meu palpite:{' '}
                        {pred ? `${pred.home_guess} × ${pred.away_guess}` : 'não enviado'}
                      </p>
                      <p className="text-xs font-bold mt-1 text-brand-700">
                        Pontuação: {pred?.points ?? 0} pts
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="2xl:col-span-4 modern-card soft-hover fade-rise p-4 sm:p-5">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-3">Próximas partidas de hoje</h2>
            {upcomingTodayMatches.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma partida restante para hoje.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-auto pr-1">
                {upcomingTodayMatches.map(match => {
                  const pred = predictionsByMatch[match.id]
                  return (
                    <div key={match.id} className="rounded-xl border border-gray-100 bg-gradient-to-br from-white to-sky-50/40 p-3">
                      <p className="text-[11px] text-gray-400 font-medium">{formatDateTime(match.kickoff_at)}</p>
                      <p className="text-xs text-gray-500">{findRoundName(match.round_id)}</p>
                      {match.venue && <p className="text-xs text-gray-400">{match.venue}</p>}
                      <div className="mt-1 flex items-center gap-2 text-sm font-medium text-gray-800">
                        <TeamWithFlag size="sm" name={match.home_team?.name} flagCode={match.home_team?.flag_code} />
                        <span className="font-extrabold">×</span>
                        <TeamWithFlag size="sm" name={match.away_team?.name} flagCode={match.away_team?.flag_code} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {pred ? `Meu palpite: ${pred.home_guess} × ${pred.away_guess}` : 'Meu palpite: não enviado'}
                      </p>
                      <div className="mt-2">
                        <Link
                          to={`/bolao/${poolId}/rodada/${match.round_id}`}
                          className="inline-flex text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition"
                        >
                          {pred ? 'Alterar palpite' : 'Enviar palpite'}
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-center py-10">Carregando rodadas...</p>
      ) : rounds.length === 0 ? (
        <div className="modern-card text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📅</p>
          <p>Nenhuma rodada disponível ainda.</p>
        </div>
      ) : (
        phaseOrder
          .filter(p => byPhase[p])
          .map(phase => (
            <div key={phase} className="mb-8">
              <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">
                {PHASE_LABELS[phase] ?? phase}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {byPhase[phase].map(round => {
                  return (
                    <Link
                      key={round.id}
                      to={`/bolao/${poolId}/rodada/${round.id}`}
                      className="modern-card soft-hover p-4 border border-transparent hover:border-brand-200 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-gray-800">{round.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Palpites fecham por jogo (cutoff individual).</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">Abrir</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))
      )}
    </div>
  )
}
