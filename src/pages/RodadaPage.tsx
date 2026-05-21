import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import TeamWithFlag from '@/components/TeamWithFlag'
import BackButton from '@/components/BackButton'

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

export default function RodadaPage() {
  const { poolId, roundId } = useParams()
  const { user } = useAuth()
  const [roundName, setRoundName] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [preds, setPreds] = useState<Record<string, Prediction>>({})
  const [guessDrafts, setGuessDrafts] = useState<Record<string, GuessDraft>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [teamFilter, setTeamFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const autoSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const saveSequenceRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (roundId && user) loadData()
  }, [roundId, user])

  useEffect(() => {
    return () => {
      Object.values(autoSaveTimersRef.current).forEach(timer => clearTimeout(timer))
    }
  }, [])

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

  async function savePrediction(matchId: string, home: number, away: number, sequence: number) {
    setSaving(s => ({ ...s, [matchId]: true }))

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

    if (saveSequenceRef.current[matchId] !== sequence) {
      return
    }

    if (saveError) {
      console.error('[Rodada] save prediction error', saveError)
      setSaving(s => ({ ...s, [matchId]: false }))
      return
    }

    setPreds(p => ({ ...p, [matchId]: { match_id: matchId, home_guess: home, away_guess: away, points: null } }))
    setSaving(s => ({ ...s, [matchId]: false }))
  }

  function updateDraft(matchId: string, side: 'home' | 'away', value: string) {
    const currentDraft = guessDrafts[matchId] ?? { home: '', away: '' }
    const nextDraft: GuessDraft = {
      home: side === 'home' ? value : currentDraft.home,
      away: side === 'away' ? value : currentDraft.away,
    }

    setGuessDrafts(prev => ({
      ...prev,
      [matchId]: {
        home: nextDraft.home,
        away: nextDraft.away,
      },
    }))

    scheduleAutoSave(matchId, nextDraft)
  }

  function scheduleAutoSave(matchId: string, draft: GuessDraft) {
    const existingTimer = autoSaveTimersRef.current[matchId]
    if (existingTimer) clearTimeout(existingTimer)

    const match = matches.find(m => m.id === matchId)
    if (!match || !isMatchOpen(match)) return

    const home = Number.parseInt(draft.home, 10)
    const away = Number.parseInt(draft.away, 10)
    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
      return
    }

    const existing = preds[matchId]
    const hasChanged = existing?.home_guess !== home || existing?.away_guess !== away
    if (!hasChanged) {
      return
    }

    const nextSequence = (saveSequenceRef.current[matchId] ?? 0) + 1
    saveSequenceRef.current[matchId] = nextSequence

    autoSaveTimersRef.current[matchId] = setTimeout(() => {
      void savePrediction(matchId, home, away, nextSequence)
    }, 700)
  }

  const submittedPredictionsCount = Object.values(preds).filter(
    p => p.home_guess !== null && p.away_guess !== null
  ).length

  function toInputDate(value: string) {
    const d = new Date(value)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const groupOptions = useMemo(() => {
    return Array.from(new Set(matches.map(m => m.group?.code).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b))
  }, [matches])

  const filteredMatches = useMemo(() => {
    const search = teamFilter.trim().toLowerCase()
    return [...matches]
      .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
      .filter(match => {
        if (groupFilter !== 'all' && (match.group?.code ?? '') !== groupFilter) return false
        if (dateFilter && toInputDate(match.kickoff_at) !== dateFilter) return false
        if (!search) return true
        const home = match.home_team?.name?.toLowerCase() ?? ''
        const away = match.away_team?.name?.toLowerCase() ?? ''
        return home.includes(search) || away.includes(search)
      })
  }, [matches, teamFilter, groupFilter, dateFilter])

  const matchesByDate = useMemo(() => {
    const grouped = filteredMatches.reduce<Record<string, Match[]>>((acc, match) => {
      const key = toInputDate(match.kickoff_at)
      acc[key] = acc[key] ?? []
      acc[key].push(match)
      return acc
    }, {})

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, dateMatches]) => {
        const dayRef = new Date(`${dateKey}T00:00:00`)
        const weekday = dayRef.toLocaleDateString('pt-BR', { weekday: 'long' })
        const weekdayLabel = weekday.charAt(0).toUpperCase() + weekday.slice(1)
        const dateLabel = dayRef.toLocaleDateString('pt-BR', { dateStyle: 'short' })
        return {
          dateKey,
          title: `${weekdayLabel} - ${dateLabel}`,
          matches: dateMatches,
        }
      })
  }, [filteredMatches])

  return (
    <div className="space-y-4">
      <div>
        <BackButton to={poolId ? `/bolao/${poolId}/palpites` : '/dashboard'} label="Meus Palpites" />
      </div>

      <div className="modern-card fade-rise relative overflow-hidden px-4 py-3 sm:px-5 sm:py-4">
        <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-sky-200/30 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 h-16 w-16 rounded-full bg-emerald-200/30 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Fase de grupos</span>
            <h1 className="text-lg font-extrabold tracking-tight text-gray-800 leading-tight">{roundName}</h1>
            <p className="text-xs text-gray-400 mt-0.5">Palpites fecham individualmente 2h antes de cada jogo</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <span className="text-xl font-extrabold text-gray-800 leading-none">
                {submittedPredictionsCount}
                <span className="text-sm font-semibold text-gray-400"> / {matches.length}</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mt-0.5">Palpites</span>
            </div>
          </div>
        </div>
      </div>

      <div className="modern-card px-4 py-2.5 sm:px-5 sm:py-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <label className="flex flex-col gap-0.5 text-xs text-gray-600">
            Time
            <input
              type="text"
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
              placeholder="Digite para filtrar por time"
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>

          <label className="flex flex-col gap-0.5 text-xs text-gray-600">
            Grupo
            <select
              value={groupFilter}
              onChange={e => setGroupFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">Todos</option>
              {groupOptions.map(code => (
                <option key={code} value={code}>Grupo {code}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-0.5 text-xs text-gray-600">
            Data
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-10">Carregando jogos...</p>
      ) : errorMsg ? (
        <p className="text-red-500 text-center py-10">{errorMsg}</p>
      ) : filteredMatches.length === 0 ? (
        <p className="text-gray-400 text-center py-10">Nenhum jogo encontrado para esta rodada.</p>
      ) : (
        <div className="space-y-6">
          {matchesByDate.map(group => (
            <section key={group.dateKey} className="space-y-3">
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-slate-200" />
                <h2 className="text-sm sm:text-base font-extrabold tracking-wide text-gray-700 uppercase text-center">
                  {group.title}
                </h2>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-300 to-slate-200" />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {group.matches.map(m => {
                  const pred = preds[m.id]
                  const isMatchLocked = !isMatchOpen(m)
                  const isClosed = m.status === 'encerrado' || new Date(m.cutoff_at) <= new Date()
                  const draft = guessDrafts[m.id]
                  const draftHome = Number.parseInt(draft?.home ?? '', 10)
                  const draftAway = Number.parseInt(draft?.away ?? '', 10)
                  const hasValidDraft = Number.isInteger(draftHome) && Number.isInteger(draftAway) && draftHome >= 0 && draftAway >= 0
                  const hasSavedPrediction = pred?.home_guess !== null && pred?.home_guess !== undefined && pred?.away_guess !== null && pred?.away_guess !== undefined
                  const isDraftSynced =
                    hasValidDraft &&
                    pred?.home_guess !== null &&
                    pred?.away_guess !== null &&
                    pred?.home_guess === draftHome &&
                    pred?.away_guess === draftAway

                  const cardStateClass = isClosed
                    ? 'border border-gray-200 bg-gray-50/80 opacity-75'
                    : isDraftSynced
                      ? 'border border-emerald-300 bg-white shadow-[0_0_0_1px_rgba(16,185,129,0.10)]'
                      : hasSavedPrediction
                        ? 'border border-emerald-200 bg-white'
                        : 'border border-slate-200 bg-white'

                  return (
                    <div key={m.id} className={`modern-card soft-hover p-4 sm:p-5 relative ${cardStateClass}`}>
                      {isDraftSynced && !saving[m.id] && (
                        <span
                          aria-label="Palpite salvo"
                          title="Palpite salvo"
                          className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200"
                        >
                          ✓
                        </span>
                      )}

                      <div className="mb-2 flex items-center justify-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold px-2 py-0.5">
                          {m.group?.code ? `Grupo ${m.group.code}` : 'Sem grupo'}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 border border-indigo-200">
                          {new Date(m.kickoff_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {m.venue && <p className="text-[11px] text-center mb-1 text-gray-500">{m.venue}</p>}
                      <div className="flex items-center justify-center gap-3">
                        <TeamWithFlag
                          name={m.home_team?.name}
                          flagCode={m.home_team?.flag_code}
                          size="xl"
                          compact
                          reverse
                          align="right"
                          className="flex-1 font-semibold text-gray-800 justify-end"
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
                          size="xl"
                          compact
                          align="left"
                          className="flex-1 font-semibold text-gray-800"
                        />
                      </div>

                      <p className="text-[11px] text-center mt-3 text-slate-600 font-semibold">
                        Fecha em {new Date(m.cutoff_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>

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
