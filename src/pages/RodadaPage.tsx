import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import TeamWithFlag from '@/components/TeamWithFlag'

interface Match {
  id: string
  group_id: string | null
  home_team_id: string
  away_team_id: string
  kickoff_at: string
  venue: string
  cutoff_at: string
  status: string
  home_score: number | null
  away_score: number | null
  group: { code: string } | null
  home_team: { name: string; flag_code: string | null }
  away_team: { name: string; flag_code: string | null }
}

interface Prediction {
  match_id: string
  home_guess: number | null
  away_guess: number | null
  points: number | null
}

interface GuessDraft {
  home: string
  away: string
}

interface SaveFeedback {
  type: 'success' | 'error'
  message: string
}

export default function RodadaPage() {
  const { poolId, roundId } = useParams()
  const { user } = useAuth()
  const [roundName, setRoundName] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [preds, setPreds] = useState<Record<string, Prediction>>({})
  const [guessDrafts, setGuessDrafts] = useState<Record<string, GuessDraft>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saveFeedback, setSaveFeedback] = useState<Record<string, SaveFeedback>>({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (roundId && user) loadData()
  }, [roundId, user])

  async function loadData() {
    setLoading(true)
    setErrorMsg(null)

    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select('name')
      .eq('id', roundId!)
      .single()

    if (roundError) {
      console.error('[Rodada] load round error', roundError)
      setErrorMsg('Nao foi possivel carregar a rodada.')
      setLoading(false)
      return
    }

    setRoundName((round as any)?.name ?? '')

    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select(`
        id, group_id, home_team_id, away_team_id, kickoff_at, venue, cutoff_at, status, home_score, away_score,
        group:groups(code),
        home_team:teams!matches_home_team_id_fkey(name, flag_code),
        away_team:teams!matches_away_team_id_fkey(name, flag_code)
      `)
      .eq('round_id', roundId!)
      .order('kickoff_at')

    if (matchError) {
      console.error('[Rodada] load matches error', matchError)
      setErrorMsg('Nao foi possivel carregar os jogos desta rodada.')
      setLoading(false)
      return
    }

    setMatches((matchData ?? []) as unknown as Match[])

    const { data: predData, error: predError } = await supabase
      .from('predictions')
      .select('match_id, home_guess, away_guess, points')
      .eq('pool_id', poolId!)
      .eq('user_id', user!.id)
      .in('match_id', (matchData ?? []).map((m: any) => m.id))

    if (predError) {
      console.error('[Rodada] load predictions error', predError)
      setErrorMsg('Jogos carregados, mas houve erro ao carregar palpites.')
    }

    const map: Record<string, Prediction> = {}
    for (const p of (predData ?? []) as any[]) map[p.match_id] = p
    setPreds(map)

    const drafts: Record<string, GuessDraft> = {}
    for (const m of (matchData ?? []) as any[]) {
      const p = map[m.id]
      drafts[m.id] = {
        home: p?.home_guess !== null && p?.home_guess !== undefined ? String(p.home_guess) : '',
        away: p?.away_guess !== null && p?.away_guess !== undefined ? String(p.away_guess) : '',
      }
    }
    setGuessDrafts(drafts)

    setLoading(false)
  }

  function isMatchOpen(match: Match) {
    return match.status !== 'encerrado' && new Date(match.cutoff_at) > new Date()
  }

  async function savePrediction(matchId: string, home: number, away: number) {
    setSaving(s => ({ ...s, [matchId]: true }))
    setSaveFeedback(prev => {
      const next = { ...prev }
      delete next[matchId]
      return next
    })

    const existing = preds[matchId]
    let saveError: any = null

    if (existing) {
      const { error } = await (supabase.from('predictions') as any)
        .update({ home_guess: home, away_guess: away })
        .eq('pool_id', poolId!)
        .eq('match_id', matchId)
        .eq('user_id', user!.id)
      saveError = error
    } else {
      const { error } = await (supabase.from('predictions') as any).insert({
        pool_id: poolId!, match_id: matchId, user_id: user!.id,
        home_guess: home, away_guess: away,
      })
      saveError = error
    }

    if (saveError) {
      console.error('[Rodada] save prediction error', saveError)
      setSaveFeedback(prev => ({
        ...prev,
        [matchId]: {
          type: 'error',
          message: 'Erro ao salvar. Tente novamente.',
        },
      }))
      setSaving(s => ({ ...s, [matchId]: false }))
      return
    }

    setPreds(p => ({ ...p, [matchId]: { match_id: matchId, home_guess: home, away_guess: away, points: null } }))
    setSaveFeedback(prev => ({
      ...prev,
      [matchId]: {
        type: 'success',
        message: 'Palpite salvo com sucesso.',
      },
    }))
    setSaving(s => ({ ...s, [matchId]: false }))
  }

  function updateDraft(matchId: string, side: 'home' | 'away', value: string) {
    setGuessDrafts(prev => ({
      ...prev,
      [matchId]: {
        home: side === 'home' ? value : (prev[matchId]?.home ?? ''),
        away: side === 'away' ? value : (prev[matchId]?.away ?? ''),
      },
    }))
  }

  function canSaveMatch(matchId: string) {
    const match = matches.find(m => m.id === matchId)
    if (!match || !isMatchOpen(match) || saving[matchId]) return false
    const draft = guessDrafts[matchId]
    if (!draft) return false
    const h = Number.parseInt(draft.home, 10)
    const a = Number.parseInt(draft.away, 10)
    return Number.isInteger(h) && Number.isInteger(a) && h >= 0 && a >= 0
  }

  async function handleSaveClick(matchId: string) {
    const draft = guessDrafts[matchId]
    if (!draft) return
    const h = Number.parseInt(draft.home, 10)
    const a = Number.parseInt(draft.away, 10)
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) return
    await savePrediction(matchId, h, a)
  }

  return (
    <div className="space-y-6">
      <div className="modern-card soft-hover fade-rise relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -top-10 -right-12 h-28 w-28 rounded-full bg-sky-200/40 blur-2xl" />
        <div className="absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-emerald-200/40 blur-2xl" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="modern-chip">Rodada ativa</span>
            <span className="modern-chip">Cutoff por jogo</span>
            <span className="modern-chip">{matches.length} partidas</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-800">{roundName}</h1>
          <p className="text-sm mt-1 text-gray-600">Palpites fecham individualmente conforme o cutoff de cada partida.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-10">Carregando jogos...</p>
      ) : errorMsg ? (
        <p className="text-red-500 text-center py-10">{errorMsg}</p>
      ) : matches.length === 0 ? (
        <p className="text-gray-400 text-center py-10">Nenhum jogo encontrado para esta rodada.</p>
      ) : (
        <div className="space-y-8">
          {Object.entries(
            matches.reduce<Record<string, Match[]>>((acc, match) => {
              const key = match.group?.code ?? 'Sem Grupo'
              acc[key] = acc[key] ?? []
              acc[key].push(match)
              return acc
            }, {})
          )
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([groupCode, groupMatches]) => (
              <section key={groupCode}>
                <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">Grupo {groupCode}</h2>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {groupMatches.map(m => {
                    const pred = preds[m.id]
                    const isMatchLocked = !isMatchOpen(m)
                    return (
                      <div key={m.id} className="modern-card soft-hover p-4 sm:p-5">
                        <p className="text-xs text-gray-500 mb-1 text-center font-medium">
                          {new Date(m.kickoff_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                        {m.venue && <p className="text-[11px] text-center mb-1 text-gray-500">{m.venue}</p>}
                        <p className="text-[11px] text-center mb-3 text-brand-700 font-semibold">
                          Fecha em {new Date(m.cutoff_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                        <div className="flex items-center justify-center gap-3">
                          <TeamWithFlag
                            name={m.home_team?.name}
                            flagCode={m.home_team?.flag_code}
                            size="sm"
                            compact
                            align="right"
                            className="flex-1 text-right font-semibold text-gray-800"
                          />
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={guessDrafts[m.id]?.home ?? ''}
                            onChange={e => updateDraft(m.id, 'home', e.target.value)}
                            disabled={isMatchLocked || saving[m.id]}
                            className="w-12 text-center border border-gray-300 rounded px-1 py-1.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100 disabled:text-gray-400"
                          />
                          <span className="text-gray-400 font-bold">×</span>
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={guessDrafts[m.id]?.away ?? ''}
                            onChange={e => updateDraft(m.id, 'away', e.target.value)}
                            disabled={isMatchLocked || saving[m.id]}
                            className="w-12 text-center border border-gray-300 rounded px-1 py-1.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100 disabled:text-gray-400"
                          />
                          <TeamWithFlag
                            name={m.away_team?.name}
                            flagCode={m.away_team?.flag_code}
                            size="sm"
                            compact
                            align="left"
                            className="flex-1 text-left font-semibold text-gray-800"
                          />
                        </div>

                        <div className="mt-3 text-center">
                          <button
                            onClick={() => handleSaveClick(m.id)}
                            disabled={!canSaveMatch(m.id)}
                            className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            {saving[m.id] ? 'Salvando...' : 'Salvar palpite'}
                          </button>

                          {saveFeedback[m.id] && (
                            <p
                              className={`mt-2 text-xs font-medium ${saveFeedback[m.id].type === 'success' ? 'text-green-600' : 'text-red-500'}`}
                            >
                              {saveFeedback[m.id].message}
                            </p>
                          )}
                        </div>

                        {m.status === 'encerrado' && m.home_score !== null && (
                          <div className="mt-3 text-center">
                            <span className="text-xs text-gray-400">Resultado: </span>
                            <span className="text-xs font-extrabold text-gray-700">
                              {m.home_score} × {m.away_score}
                            </span>
                            {pred?.points !== null && pred?.points !== undefined && (
                              <span className="ml-2 text-xs bg-brand-100 text-brand-700 font-bold px-2 py-0.5 rounded-full">
                                {pred.points} pts
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  )
}
