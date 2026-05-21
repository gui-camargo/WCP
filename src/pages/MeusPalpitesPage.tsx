import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Round {
  id: string
  name: string
  phase: string
}

const PHASE_LABELS: Record<string, string> = {
  oitavas: 'Oitavas de Final',
  quartas: 'Quartas de Final',
  semi: 'Semifinal',
  terceiro_lugar: 'Disputa de 3o Lugar',
  final: 'Final',
}



export default function MeusPalpitesPage() {
  const { poolId } = useParams()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [groupRounds, setGroupRounds] = useState<Round[]>([])
  const [otherRounds, setOtherRounds] = useState<Record<string, Round[]>>({})
  const [specialDeadline, setSpecialDeadline] = useState<string | null>(null)
  // removido: groupPeriod
  const [roundPeriods, setRoundPeriods] = useState<Record<string, { start: string | null; end: string | null }>>({})
  // removido: groupStatus
  const [roundStatus, setRoundStatus] = useState<Record<string, string>>({})
  const [roundProgress, setRoundProgress] = useState<Record<string, { filled: number; total: number }>>({})
  const [groupClassificationProgress, setGroupClassificationProgress] = useState<{ filled: number; total: number }>({
    filled: 0,
    total: 0,
  })

  useEffect(() => {
    if (poolId && user) {
      loadData()
    }
  }, [poolId, user])

  async function loadData() {
    if (!poolId || !user) return
    setLoading(true)

    const [{ data: poolData }, { data: roundsData }] = await Promise.all([
      supabase
        .from('pools')
        .select('group_predictions_cutoff_at')
        .eq('id', poolId)
        .single(),
      supabase
        .from('rounds')
        .select('id, name, phase, created_at')
        .eq('pool_id', poolId)
        .order('created_at', { ascending: true }),
    ])

    const rounds = (roundsData ?? []) as Array<Round & { created_at: string }>
    const groups = rounds.filter(round => round.phase === 'grupos').map(({ id, name, phase }) => ({ id, name, phase }))
    setGroupRounds(groups)
    const groupRoundIds = new Set(groups.map(round => round.id))

    const groupedOthers = rounds
      .filter(round => round.phase !== 'grupos')
      .reduce<Record<string, Round[]>>((acc, round) => {
        acc[round.phase] = acc[round.phase] ?? []
        acc[round.phase].push({ id: round.id, name: round.name, phase: round.phase })
        return acc
      }, {})

    setOtherRounds(groupedOthers)

    const roundIds = rounds.map(round => round.id)
    let matchesData: Array<{ id: string; round_id: string; group_id: string | null; cutoff_at: string; kickoff_at?: string; status?: string }> = []

    if (roundIds.length > 0) {
      const { data } = await supabase
        .from('matches')
        .select('id, round_id, group_id, cutoff_at, kickoff_at, status')
        .in('round_id', roundIds)

      matchesData = (data ?? []) as Array<{ id: string; round_id: string; group_id: string | null; cutoff_at: string; kickoff_at?: string; status?: string }>
    }
    // Período e status para classificação de grupos
    // removido: groupMatches
    // removido: groupKickoffs e groupCutoffs
    // removido: setGroupPeriod

    // Status para classificação de grupos
    // removido: groupStatusValue e lógica associada
    // removido: setGroupStatus

    // Período e status para cada rodada
    const nextRoundPeriods: Record<string, { start: string | null; end: string | null }> = {}
    const nextRoundStatus: Record<string, string> = {}
    const now = new Date()
    for (const round of rounds) {
      const roundMatches = matchesData.filter(m => m.round_id === round.id)
      const kickoffs = roundMatches.map(m => m.kickoff_at).filter(Boolean).sort()
      const cutoffs = roundMatches.map(m => m.cutoff_at).filter(Boolean).sort()
      nextRoundPeriods[round.id] = {
        start: kickoffs[0] ?? null,
        end: cutoffs[cutoffs.length - 1] ?? null,
      }
      // Status lógica
      let status = 'Pendente'
      if (kickoffs.length && cutoffs.length) {
        const start = new Date(kickoffs[0])
        const end = new Date(cutoffs[cutoffs.length - 1])
        if (now < start) status = 'Em aberto'
        else if (now >= start && now <= end) status = 'Em andamento'
        else if (now > end) status = 'Encerrada'
      }
      nextRoundStatus[round.id] = status
    }
    setRoundPeriods(nextRoundPeriods)
    setRoundStatus(nextRoundStatus)

    const totalByRound = matchesData.reduce<Record<string, number>>((acc, match) => {
      acc[match.round_id] = (acc[match.round_id] ?? 0) + 1
      return acc
    }, {})

    const matchIds = matchesData.map(match => match.id)
    const filledByRound: Record<string, number> = {}

    if (matchIds.length > 0) {
      const { data: predictionsData } = await supabase
        .from('predictions')
        .select('match_id, home_guess, away_guess, match:matches!predictions_match_id_fkey(round_id)')
        .eq('pool_id', poolId)
        .eq('user_id', user.id)
        .in('match_id', matchIds)

      for (const row of (predictionsData ?? []) as any[]) {
        if (row.home_guess === null || row.away_guess === null) continue
        const roundId = row.match?.round_id as string | undefined
        if (!roundId) continue
        filledByRound[roundId] = (filledByRound[roundId] ?? 0) + 1
      }
    }

    const nextRoundProgress: Record<string, { filled: number; total: number }> = {}
    for (const round of rounds) {
      nextRoundProgress[round.id] = {
        filled: filledByRound[round.id] ?? 0,
        total: totalByRound[round.id] ?? 0,
      }
    }
    setRoundProgress(nextRoundProgress)

    const groupIds = new Set(
      matchesData
        .filter(match => groupRoundIds.has(match.round_id) && Boolean(match.group_id))
        .map(match => match.group_id as string)
    )

    let filledGroups = 0
    if (groupIds.size > 0) {
      const { data: gpData } = await supabase
        .from('group_predictions')
        .select('group_id, first_id, second_id')
        .eq('pool_id', poolId)
        .eq('user_id', user.id)

      filledGroups = ((gpData ?? []) as Array<{ group_id: string; first_id: string | null; second_id: string | null }>)
        .filter(row => groupIds.has(row.group_id) && Boolean(row.first_id) && Boolean(row.second_id)).length
    }

    setGroupClassificationProgress({
      filled: filledGroups,
      total: groupIds.size,
    })

    const manualDeadline = (poolData as any)?.group_predictions_cutoff_at ?? null
    if (manualDeadline) {
      setSpecialDeadline(manualDeadline)
      setLoading(false)
      return
    }

    if (groupRoundIds.size > 0) {
      const firstCutoff = matchesData
        .filter(match => groupRoundIds.has(match.round_id))
        .map(match => match.cutoff_at)
        .filter(Boolean)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null

      setSpecialDeadline(firstCutoff)
    } else {
      setSpecialDeadline(null)
    }

    setLoading(false)
  }

  const orderedOtherPhases = useMemo(() => {
    const phaseOrder = ['oitavas', 'quartas', 'semi', 'terceiro_lugar', 'final']
    const phases = Object.keys(otherRounds)
    return phases.sort((a, b) => {
      const ia = phaseOrder.indexOf(a)
      const ib = phaseOrder.indexOf(b)
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
  }, [otherRounds])

  return (
    <div className="space-y-6">
      <section className="modern-card soft-hover fade-rise relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-sky-200/40 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-emerald-200/40 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-800">Meus Palpites</h1>
          <p className="text-sm text-gray-600">Escolha o tipo de palpite e navegue por fase e rodada.</p>
        </div>
      </section>

      <section className="modern-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-800">Palpite para Classificação de Grupos</h2>
          <Link
            to={poolId ? `/bolao/${poolId}/classificacao` : '/dashboard'}
            className="inline-flex items-center px-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition"
          >
            Abrir
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1">
            {groupClassificationProgress.filled} / {groupClassificationProgress.total} preenchidos
          </span>
          {specialDeadline && (
            <span className="inline-flex items-center rounded-full bg-rose-100 text-rose-700 text-xs font-bold px-3 py-1 border border-rose-200">
              Prazo: {(() => {
                const d = new Date(specialDeadline)
                const date = d.toLocaleDateString('pt-BR', { dateStyle: 'short' })
                const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                return `${date} - ${time}`
              })()}
            </span>
          )}
        </div>

        <p className="text-sm text-gray-600">Escolha 1o e 2o colocados de cada grupo.</p>

        {/* Nenhum texto de prazo, apenas selo acima */}
      </section>

      <section className="modern-card p-4 sm:p-5 space-y-4">
        <h2 className="text-lg font-bold text-gray-800">Palpite Fase de Grupos</h2>

        {loading ? (
          <p className="text-sm text-gray-400">Carregando rodadas...</p>
        ) : groupRounds.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma rodada da fase de grupos cadastrada.</p>
        ) : (
          <div className="space-y-2">
            {groupRounds.map((round, index) => (
              <Link
                key={round.id}
                to={`/bolao/${poolId}/rodada/${round.id}`}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2 hover:bg-slate-50 transition"
              >
                <span className="text-sm text-gray-700">
                  <span className="font-bold">Rodada {index + 1}</span>
                  {roundPeriods[round.id]?.start && roundPeriods[round.id]?.end && (
                    <>
                      {' '}-{' '}
                      {`${new Date(roundPeriods[round.id].start!).toLocaleDateString('pt-BR', { dateStyle: 'short' })} até ${new Date(roundPeriods[round.id].end!).toLocaleDateString('pt-BR', { dateStyle: 'short' })}`}
                    </>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                    {roundProgress[round.id]?.filled ?? 0} / {roundProgress[round.id]?.total ?? 0} preenchidos
                  </span>
                  <span className={`inline-flex items-center rounded-full text-xs font-semibold px-2 py-1 ${
                    roundStatus[round.id] === 'Encerrada' ? 'bg-gray-200 text-gray-600' :
                    roundStatus[round.id] === 'Em andamento' ? 'bg-yellow-100 text-yellow-800' :
                    roundStatus[round.id] === 'Em aberto' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {roundStatus[round.id]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="modern-card p-4 sm:p-5 space-y-4">
        <h2 className="text-lg font-bold text-gray-800">Palpite Outras Fases</h2>

        {loading ? (
          <p className="text-sm text-gray-400">Carregando fases...</p>
        ) : orderedOtherPhases.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma fase eliminatória cadastrada.</p>
        ) : (
          <div className="space-y-4">
            {orderedOtherPhases.map(phase => (
              <div key={phase} className="rounded-xl border border-gray-100 bg-white p-3">
                <h3 className="text-sm font-bold text-gray-700 mb-2">{PHASE_LABELS[phase] ?? phase}</h3>
                <div className="space-y-2">
                  {otherRounds[phase].map(round => (
                    <Link
                      key={round.id}
                      to={`/bolao/${poolId}/rodada/${round.id}`}
                      className="flex items-center justify-between rounded-lg border border-gray-100 bg-slate-50 px-3 py-2 hover:bg-slate-100 transition"
                    >
                      <span className="text-sm text-gray-700">{round.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                          {roundProgress[round.id]?.filled ?? 0} / {roundProgress[round.id]?.total ?? 0} preenchidos
                        </span>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700">Abrir</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}