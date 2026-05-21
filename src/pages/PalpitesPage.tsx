import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import TeamWithFlag from '@/components/TeamWithFlag'

interface Match {
  id: string
  home_team: { name: string; flag_code: string | null }
  away_team: { name: string; flag_code: string | null }
  home_score: number | null
  away_score: number | null
  venue: string
  cutoff_at: string
  status: string
}

interface UserPred {
  user_name: string
  home_guess: number
  away_guess: number
  points: number | null
}

export default function PalpitesPage() {
  const { poolId, roundId } = useParams()
  const { profile } = useAuth()
  void profile // evita unused warning até uso futuro
  const [matches, setMatches] = useState<Match[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [userPreds, setUserPreds] = useState<UserPred[]>([])
  const [roundName, setRoundName] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingPreds, setLoadingPreds] = useState(false)

  useEffect(() => {
    if (roundId) loadData()
  }, [roundId])

  async function loadData() {
    setLoading(true)
    const { data: round } = await supabase.from('rounds').select('name').eq('id', roundId!).single()
    setRoundName((round as any)?.name ?? '')

    const { data } = await supabase
      .from('matches')
      .select(`
        id, home_score, away_score, venue, cutoff_at, status,
        home_team:teams!matches_home_team_id_fkey(name, flag_code),
        away_team:teams!matches_away_team_id_fkey(name, flag_code)
      `)
      .eq('round_id', roundId!)
      .order('kickoff_at')

    setMatches((data ?? []) as unknown as Match[])
    setLoading(false)
  }

  async function loadPreds(matchId: string) {
    const selectedMatch = matches.find(m => m.id === matchId)
    const canViewPreds = selectedMatch ? new Date(selectedMatch.cutoff_at) <= new Date() : false
    if (!canViewPreds) return

    setSelected(matchId)
    setLoadingPreds(true)

    const { data } = await supabase
      .from('predictions')
      .select('home_guess, away_guess, points, profiles(name)')
      .eq('pool_id', poolId!)
      .eq('match_id', matchId)

    const list = (data ?? []).map((r: any) => ({
      user_name: r.profiles?.name ?? 'Desconhecido',
      home_guess: r.home_guess,
      away_guess: r.away_guess,
      points: r.points,
    }))
    setUserPreds(list)
    setLoadingPreds(false)
  }

  const releasedMatchesCount = matches.filter(m => new Date(m.cutoff_at) <= new Date()).length
  const hiddenMatchesCount = Math.max(matches.length - releasedMatchesCount, 0)

  return (
    <div className="space-y-6">
      <div className="modern-card soft-hover fade-rise relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -top-10 -right-12 h-28 w-28 rounded-full bg-sky-200/40 blur-2xl" />
        <div className="absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-emerald-200/40 blur-2xl" />

        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-800">Palpites — {roundName}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="modern-chip">{matches.length} jogos</span>
            <span className="modern-chip">{releasedMatchesCount} jogos liberados</span>
            <span className="modern-chip">{hiddenMatchesCount} jogos ocultos</span>
          </div>
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 inline-block">
            ⏳ Palpites alheios ficam visíveis apenas após o cutoff de cada partida.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-10">Carregando...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {matches.map(m => {
            const canViewPreds = new Date(m.cutoff_at) <= new Date()
            return (
            <button
              key={m.id}
              onClick={() => canViewPreds ? loadPreds(m.id) : undefined}
              disabled={!canViewPreds}
              className={`modern-card p-4 text-left transition ${canViewPreds ? 'soft-hover hover:border-brand-200 cursor-pointer' : 'cursor-default opacity-95'} border border-transparent`}
            >
              <div className="text-xs text-gray-500 text-center mb-1 flex items-center justify-center gap-2 font-medium">
                <TeamWithFlag size="sm" compact name={m.home_team?.name} flagCode={m.home_team?.flag_code} />
                <span>×</span>
                <TeamWithFlag size="sm" compact name={m.away_team?.name} flagCode={m.away_team?.flag_code} />
              </div>
              <p className="text-[11px] text-gray-500 text-center mb-1 font-medium">
                Fecha: {new Date(m.cutoff_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
              {m.venue && <p className="text-[11px] text-gray-500 text-center mb-1">{m.venue}</p>}
              {m.status === 'encerrado' && (
                <p className="text-center font-extrabold text-brand-700">
                  {m.home_score} — {m.away_score}
                </p>
              )}
              {canViewPreds && (
                <p className="text-xs text-center text-brand-600 mt-1">Clique para ver palpites</p>
              )}
              {!canViewPreds && (
                <p className="text-xs text-center text-gray-400 mt-1">Disponível após o cutoff</p>
              )}
            </button>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="mt-8 modern-card p-4 sm:p-5">
          {(() => {
            const match = matches.find(m => m.id === selected)!
            return (
              <h2 className="text-lg font-semibold text-gray-700 mb-3">
                Palpites: {match?.home_team?.name} × {match?.away_team?.name}
              </h2>
            )
          })()}
          {loadingPreds ? (
            <p className="text-gray-400">Carregando palpites...</p>
          ) : userPreds.length === 0 ? (
            <p className="text-gray-400">Nenhum palpite registrado.</p>
          ) : (
            <div className="rounded-xl overflow-hidden border border-gray-100 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left">Participante</th>
                    <th className="px-4 py-2 text-center">Palpite</th>
                    <th className="px-4 py-2 text-right">Pontos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {userPreds.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{p.user_name}</td>
                      <td className="px-4 py-2 text-center font-bold">
                        {p.home_guess} × {p.away_guess}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {p.points !== null ? (
                          <span className="bg-brand-100 text-brand-700 font-bold px-2 py-0.5 rounded-full text-xs">
                            {p.points} pts
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
