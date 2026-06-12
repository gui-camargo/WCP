import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import TeamWithFlag from '@/components/TeamWithFlag'
import FlagOnly from '@/components/FlagOnly'
import BackButton from '@/components/BackButton'
import ResultMatchCard from '@/components/ResultMatchCard'
import MatchPredictionsModal from '@/components/MatchPredictionsModal'
import { IconFinishedMatches } from '@/components/Icons'

interface Match {
  id: string
  kickoff_at: string
  group: { code: string } | null
  round: { id: string; name: string; phase: string } | null
  home_team: { name: string; flag_code: string | null }
  away_team: { name: string; flag_code: string | null }
  home_score: number | null
  away_score: number | null
  venue: string
  cutoff_at: string
  status: string
}

interface UserPred {
  user_id: string
  user_name: string
  home_guess: number
  away_guess: number
  points: number | null
}

interface GroupStanding {
  group_id: string
  group: { id: string; code: string } | null
  first_id: string | null
  second_id: string | null
  first_team: { id: string; name: string; flag_code: string | null } | null
  second_team: { id: string; name: string; flag_code: string | null } | null
  cutoff_at: string | null
}

interface GroupPred {
  user_id: string
  user_name: string
  first_team: { id: string; name: string; flag_code: string | null } | null
  second_team: { id: string; name: string; flag_code: string | null } | null
  points: number | null
}

interface TeamClassification {
  team_id: string
  team_name: string
  flag_code: string | null
  matches: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  points: number
}

const PHASE_LABELS: Record<string, string> = {
  grupos: 'Fase de Grupos',
  oitavas: 'Oitavas de Final',
  quartas: 'Quartas de Final',
  semi: 'Semifinal',
  terceiro_lugar: 'Disputa de 3o Lugar',
  final: 'Final',
}

function compactRoundLabel(label: string) {
  return label.replace(/rodada\s*(\d+)/gi, 'R$1')
}

export default function ResultadosPage() {
  const { poolId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { profile, user } = useAuth()
  void profile
  const [matches, setMatches] = useState<Match[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [userPreds, setUserPreds] = useState<UserPred[]>([])
  const [groupPreds, setGroupPreds] = useState<GroupPred[]>([])
  const [groupStandings, setGroupStandings] = useState<GroupStanding[]>([])
  const [groupPredictionsRevealAt, setGroupPredictionsRevealAt] = useState<string | null>(null)
  const [myPredictionsByMatch, setMyPredictionsByMatch] = useState<Record<string, { home_guess: number | null; away_guess: number | null; points: number | null }>>({})
  const [loading, setLoading] = useState(true)
  const [loadingPreds, setLoadingPreds] = useState(false)
  const [loadingGroupPreds, setLoadingGroupPreds] = useState(false)
  const [teamFilter, setTeamFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [classificationTeamFilter, setClassificationTeamFilter] = useState('')
  const [classificationGroupFilter, setClassificationGroupFilter] = useState('all')
  const [roundFilter, setRoundFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [isJogosFiltersOpen, setIsJogosFiltersOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 768
  })
  const [isClassificacaoFiltersOpen, setIsClassificacaoFiltersOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 768
  })
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const currentView = searchParams.get('view') === 'classificacao' ? 'classificacao' : 'jogos'
  const hasOpenModal = Boolean(selected || selectedGroupId)
  const selectedGroupStanding = selectedGroupId
    ? groupStandings.find(g => {
        const groupId = g.group_id || g.group?.id
        return groupId === selectedGroupId
      }) ?? null
    : null

  function getGroupSlotTone(predictedTeamId: string | undefined, expectedSlot: 'first' | 'second') {
    if (!selectedGroupStanding) return 'border-slate-200 bg-slate-50'

    const realFirstId = selectedGroupStanding.first_team?.id ?? selectedGroupStanding.first_id
    const realSecondId = selectedGroupStanding.second_team?.id ?? selectedGroupStanding.second_id

    const isExact = expectedSlot === 'first'
      ? predictedTeamId === realFirstId
      : predictedTeamId === realSecondId

    if (isExact) return 'border-emerald-300 bg-emerald-50'

    const isInTopTwo = Boolean(predictedTeamId) && (predictedTeamId === realFirstId || predictedTeamId === realSecondId)
    if (isInTopTwo) return 'border-amber-300 bg-amber-50'

    return 'border-red-300 bg-red-50'
  }

  function getPointsBadge(points: number | null) {
    if (points === null) {
      return {
        text: '-',
        className: 'border-slate-200 bg-slate-100 text-slate-500',
      }
    }
    if (points === 20) {
      return {
        text: '🤩 20 pts',
        className: 'border-yellow-400 bg-yellow-100 text-yellow-700',
      }
    }
    if (points === 15) {
      return {
        text: '😄 15 pts',
        className: 'border-emerald-300 bg-emerald-100 text-emerald-700',
      }
    }
    if (points === 10) {
      return {
        text: '😐 10 pts',
        className: 'border-indigo-300 bg-indigo-100 text-indigo-700',
      }
    }
    if (points === 5) {
      return {
        text: '😬 5 pts',
        className: 'border-orange-300 bg-orange-100 text-orange-700',
      }
    }
    if (points === 0) {
      return {
        text: '😵 0 pts',
        className: 'border-red-300 bg-red-100 text-red-700',
      }
    }

    return {
      text: `${points} pts`,
      className: 'border-slate-300 bg-slate-100 text-slate-700',
    }
  }

  useEffect(() => {
    if (poolId) loadData()
  }, [poolId])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')

    function syncFiltersByBreakpoint(event: MediaQueryListEvent) {
      setIsJogosFiltersOpen(event.matches)
      setIsClassificacaoFiltersOpen(event.matches)
    }

    mediaQuery.addEventListener('change', syncFiltersByBreakpoint)
    return () => mediaQuery.removeEventListener('change', syncFiltersByBreakpoint)
  }, [])

  useEffect(() => {
    if (!hasOpenModal) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeModal()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    history.pushState({ modal: true }, '')

    function onPopState() {
      setSelected(null)
      setSelectedGroupId(null)
    }
    window.addEventListener('popstate', onPopState)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('popstate', onPopState)
    }
  }, [hasOpenModal])

  async function loadData() {
    setLoading(true)

    const { data: poolData } = await supabase
      .from('pools')
      .select('group_predictions_cutoff_at')
      .eq('id', poolId!)
      .single()

    const { data: roundsData } = await supabase
      .from('rounds')
      .select('id')
      .eq('pool_id', poolId!)

    const roundIds = (roundsData ?? []).map((r: any) => r.id)
    if (roundIds.length === 0) {
      setMatches([])
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('matches')
      .select(`
        id, kickoff_at, home_score, away_score, venue, cutoff_at, status,
        group:groups(code),
        round:rounds!matches_round_id_fkey(id, name, phase),
        home_team:teams!matches_home_team_id_fkey(name, flag_code),
        away_team:teams!matches_away_team_id_fkey(name, flag_code)
      `)
      .in('round_id', roundIds)
      .order('kickoff_at')

    const loadedMatches = (data ?? []) as unknown as Match[]
    setMatches(loadedMatches)

    if (user && loadedMatches.length > 0) {
      const { data: myPredsData } = await supabase
        .from('predictions')
        .select('match_id, home_guess, away_guess, points')
        .eq('pool_id', poolId!)
        .eq('user_id', user.id)
        .in('match_id', loadedMatches.map(match => match.id))

      const nextMyPreds: Record<string, { home_guess: number | null; away_guess: number | null; points: number | null }> = {}
      for (const row of (myPredsData ?? []) as Array<{ match_id: string; home_guess: number | null; away_guess: number | null; points: number | null }>) {
        nextMyPreds[row.match_id] = {
          home_guess: row.home_guess,
          away_guess: row.away_guess,
          points: row.points,
        }
      }
      setMyPredictionsByMatch(nextMyPreds)
    } else {
      setMyPredictionsByMatch({})
    }

    const manualGroupPredictionsCutoff = (poolData as any)?.group_predictions_cutoff_at ?? null
    const firstGroupPhaseKickoff = loadedMatches
      .filter(match => match.round?.phase === 'grupos')
      .map(match => match.kickoff_at)
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null

    const autoGroupPredictionsCutoff = firstGroupPhaseKickoff
      ? new Date(new Date(firstGroupPhaseKickoff).getTime() - (2 * 60 * 60 * 1000)).toISOString()
      : null

    setGroupPredictionsRevealAt(manualGroupPredictionsCutoff ?? autoGroupPredictionsCutoff)

    const groupCutoffByCode = loadedMatches.reduce<Record<string, string>>((acc, match) => {
      const code = match.group?.code
      if (!code) return acc
      if (!acc[code] || new Date(match.cutoff_at).getTime() < new Date(acc[code]).getTime()) {
        acc[code] = match.cutoff_at
      }
      return acc
    }, {})

    const groupCodes = Object.keys(groupCutoffByCode)
    if (groupCodes.length > 0) {
      const { data: groupsData } = await supabase
        .from('groups')
        .select('id, code')
        .in('code', groupCodes)

      const groupIds = (groupsData ?? []).map((row: any) => row.id)

      if (groupIds.length === 0) {
        setGroupStandings([])
        setLoading(false)
        return
      }

      const { data: standingsData } = await supabase
        .from('group_standings')
        .select(`
          group_id,
          first_id,
          second_id,
          group:groups(id, code),
          first_team:teams!group_standings_first_id_fkey(id, name, flag_code),
          second_team:teams!group_standings_second_id_fkey(id, name, flag_code)
        `)
        .in('group_id', groupIds)

      const groupCodeToRealId = new Map<string, string>()
      groupsData?.forEach((row: any) => {
        groupCodeToRealId.set(row.code, row.id)
      })

      const standingsByCode = new Map<string, any>()
      for (const row of standingsData ?? []) {
        const code = (row as any).group?.code
        if (code) standingsByCode.set(code, row)
      }

      const normalized: GroupStanding[] = groupCodes
        .sort((a, b) => a.localeCompare(b))
        .map(code => {
          const row = standingsByCode.get(code)
          const realGroupId = groupCodeToRealId.get(code)
          return {
            group_id: realGroupId || (row as any)?.group_id,
            group: (row as any)?.group ?? { id: realGroupId || `missing-${code}`, code },
            first_id: (row as any)?.first_id ?? null,
            second_id: (row as any)?.second_id ?? null,
            first_team: (row as any)?.first_team ?? null,
            second_team: (row as any)?.second_team ?? null,
            cutoff_at: groupCutoffByCode[code] ?? null,
          }
        })

      setGroupStandings(normalized)
    } else {
      setGroupStandings([])
    }

    setLoading(false)
  }

  function closeModal() {
    if (history.state?.modal) {
      history.back()
    } else {
      setSelected(null)
      setSelectedGroupId(null)
    }
  }

  async function loadPreds(matchId: string) {
    const selectedMatch = matches.find(m => m.id === matchId)
    const canViewPreds = selectedMatch ? new Date(selectedMatch.cutoff_at) <= new Date() : false
    if (!canViewPreds) return

    setSelected(matchId)
    setLoadingPreds(true)

    const [predsRes, leaderboardRes] = await Promise.all([
      supabase
        .from('predictions')
        .select('user_id, home_guess, away_guess, points')
        .eq('pool_id', poolId!)
        .eq('match_id', matchId),
      supabase
        .from('leaderboard')
        .select('user_id, user_name')
        .eq('pool_id', poolId!),
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

    const list = predsData.map((r: any) => ({
      user_id: r.user_id,
      user_name: nameByUserId.get(r.user_id) ?? `Usuario ${String(r.user_id).slice(0, 8)}`,
      home_guess: r.home_guess,
      away_guess: r.away_guess,
      points: r.points,
    }))
    setUserPreds(list)
    setLoadingPreds(false)
  }

  async function loadGroupPreds(groupStanding: GroupStanding) {
    const groupId = groupStanding.group_id || groupStanding.group?.id
    if (!groupId || !canViewAllGroupPreds) return

    setSelectedGroupId(groupId)
    setLoadingGroupPreds(true)

    const [predsRes, leaderboardRes] = await Promise.all([
      supabase
        .from('group_predictions')
        .select('user_id, first_id, second_id, points, first_team:teams!group_predictions_first_id_fkey(id, name, flag_code), second_team:teams!group_predictions_second_id_fkey(id, name, flag_code)')
        .eq('pool_id', poolId!)
        .eq('group_id', groupId),
      supabase
        .from('leaderboard')
        .select('user_id, user_name')
        .eq('pool_id', poolId!),
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

    const list: GroupPred[] = predsData.map((row: any) => ({
      user_id: row.user_id,
      user_name: nameByUserId.get(row.user_id) ?? `Usuario ${String(row.user_id).slice(0, 8)}`,
      first_team: row.first_team ?? null,
      second_team: row.second_team ?? null,
      points: row.points,
    }))

    setGroupPreds(list)
    setLoadingGroupPreds(false)
  }

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

  const canViewAllGroupPreds = useMemo(() => {
    if (!groupPredictionsRevealAt) return false
    return new Date(groupPredictionsRevealAt).getTime() <= Date.now()
  }, [groupPredictionsRevealAt])

  const groupResultsApurationAt = useMemo(() => {
    const lastGroupMatchKickoff = matches
      .filter(m => m.round?.phase === 'grupos')
      .map(m => m.kickoff_at)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null

    return lastGroupMatchKickoff
  }, [matches])

  const groupClassifications = useMemo(() => {
    const classificacoes = new Map<string, TeamClassification[]>()
    
    groupStandings.forEach(standing => {
      const groupCode = standing.group?.code
      if (!groupCode) return

      // Buscar TODOS os matches do grupo (para encontrar os times)
      const allGroupMatches = matches.filter(m => m.group?.code === groupCode && m.round?.phase === 'grupos')
      
      // Buscar apenas matches ENCERRADOS para calcular as estatísticas
      const groupMatchesFinished = allGroupMatches.filter(m => m.status === 'encerrado')
      
      // Buscar IDs únicos de times no grupo (de TODOS os matches, não apenas encerrados)
      const teamIds = new Set<string>()
      allGroupMatches.forEach(match => {
        if (match.home_team) teamIds.add(match.home_team.name)
        if (match.away_team) teamIds.add(match.away_team.name)
      })

      const stats: TeamClassification[] = []

      teamIds.forEach(teamName => {
        const homeMatches = groupMatchesFinished.filter(m => m.home_team?.name === teamName)
        const awayMatches = groupMatchesFinished.filter(m => m.away_team?.name === teamName)
        const allMatches = [...homeMatches, ...awayMatches]

        let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0

        homeMatches.forEach(match => {
          if (match.home_score !== null && match.away_score !== null) {
            goalsFor += match.home_score
            goalsAgainst += match.away_score
            if (match.home_score > match.away_score) wins++
            else if (match.home_score === match.away_score) draws++
            else losses++
          }
        })

        awayMatches.forEach(match => {
          if (match.home_score !== null && match.away_score !== null) {
            goalsFor += match.away_score
            goalsAgainst += match.home_score
            if (match.away_score > match.home_score) wins++
            else if (match.away_score === match.home_score) draws++
            else losses++
          }
        })

        const points = wins * 3 + draws * 1
        
        // Buscar o time completo com flag_code
        let teamFlagCode: string | null = null
        const teamInAllMatches = allGroupMatches.find(m => m.home_team?.name === teamName || m.away_team?.name === teamName)
        if (teamInAllMatches) {
          teamFlagCode = teamInAllMatches.home_team?.name === teamName 
            ? teamInAllMatches.home_team?.flag_code ?? null
            : teamInAllMatches.away_team?.flag_code ?? null
        }

        stats.push({
          team_id: teamName,
          team_name: teamName,
          flag_code: teamFlagCode,
          matches: allMatches.length,
          wins,
          draws,
          losses,
          goals_for: goalsFor,
          goals_against: goalsAgainst,
          points,
        })
      })

      // Ordenar por: pontos desc, saldo desc, gols pro desc
      stats.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        const saldoA = a.goals_for - a.goals_against
        const saldoB = b.goals_for - b.goals_against
        if (saldoB !== saldoA) return saldoB - saldoA
        return b.goals_for - a.goals_for
      })

      classificacoes.set(groupCode, stats)
    })

    return classificacoes
  }, [matches, groupStandings])

  const classificationGroupOptions = useMemo(() => {
    return groupStandings
      .map(g => g.group?.code)
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b))) as string[]
  }, [groupStandings])

  const classificationTeamOptions = useMemo(() => {
    return Array.from(
      new Set(
        Array.from(groupClassifications.values())
          .flatMap(list => list.map(team => team.team_name))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [groupClassifications])

  const filteredGroupStandings = useMemo(() => {
    const teamSearch = classificationTeamFilter.trim().toLowerCase()

    return groupStandings.filter(group => {
      const groupCode = group.group?.code ?? ''
      if (classificationGroupFilter !== 'all' && groupCode !== classificationGroupFilter) return false

      if (!teamSearch) return true
      const classification = groupClassifications.get(groupCode) ?? []
      return classification.some(team => team.team_name.toLowerCase().includes(teamSearch))
    })
  }, [groupStandings, groupClassifications, classificationGroupFilter, classificationTeamFilter])

  const roundOptions = useMemo(() => {
    const byRound = new Map<string, { id: string; name: string; firstKickoff: number }>()
    for (const m of matches) {
      const id = m.round?.id
      const name = m.round?.name
      if (!id || !name) continue
      const kickoff = new Date(m.kickoff_at).getTime()
      const current = byRound.get(id)
      if (!current || kickoff < current.firstKickoff) {
        byRound.set(id, { id, name, firstKickoff: kickoff })
      }
    }

    return Array.from(byRound.values())
      .sort((a, b) => a.firstKickoff - b.firstKickoff)
      .map(r => ({ id: r.id, name: r.name }))
  }, [matches])

  const filteredMatches = useMemo(() => {
    const search = teamFilter.trim().toLowerCase()
    return [...matches]
      .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
      .filter(match => {
        if (groupFilter !== 'all' && (match.group?.code ?? '') !== groupFilter) return false
        if (roundFilter !== 'all' && (match.round?.id ?? '') !== roundFilter) return false
        if (dateFilter && toInputDate(match.kickoff_at) !== dateFilter) return false
        if (!search) return true
        const home = match.home_team?.name?.toLowerCase() ?? ''
        const away = match.away_team?.name?.toLowerCase() ?? ''
        return home.includes(search) || away.includes(search)
      })
  }, [matches, teamFilter, groupFilter, roundFilter, dateFilter])

  const matchesByGroup = useMemo(() => {
    const grouped = filteredMatches.reduce<Record<string, Match[]>>((acc, match) => {
      const key = match.group?.code ?? 'Sem grupo'
      acc[key] = acc[key] ?? []
      acc[key].push(match)
      return acc
    }, {})

    return Object.entries(grouped)
      .sort(([a], [b]) => {
        if (a === 'Sem grupo') return 1
        if (b === 'Sem grupo') return -1
        return a.localeCompare(b)
      })
      .map(([groupCode, groupMatches]) => ({ groupCode, matches: groupMatches }))
  }, [filteredMatches])

  const groupedByPhase = useMemo(() => {
    const phaseOrder = ['grupos', 'oitavas', 'quartas', 'semi', 'terceiro_lugar', 'final']

    const byPhase = matchesByGroup
      .flatMap(group => group.matches)
      .reduce<Record<string, Record<string, Record<string, Match[]>>>>((acc, match) => {
        const phase = match.round?.phase ?? 'fase_indefinida'
        const group = match.group?.code ?? 'Sem grupo'
        const round = match.round?.name ?? 'Rodada'
        acc[phase] = acc[phase] ?? {}
        acc[phase][group] = acc[phase][group] ?? {}
        acc[phase][group][round] = acc[phase][group][round] ?? []
        acc[phase][group][round].push(match)
        return acc
      }, {})

    return Object.entries(byPhase)
      .sort(([a], [b]) => {
        const ia = phaseOrder.indexOf(a)
        const ib = phaseOrder.indexOf(b)
        if (ia === -1 && ib === -1) return a.localeCompare(b)
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })
      .map(([phase, groups]) => ({
        phase,
        label: PHASE_LABELS[phase] ?? 'Fase',
        groups: Object.entries(groups)
          .sort(([a], [b]) => {
            if (a === 'Sem grupo') return 1
            if (b === 'Sem grupo') return -1
            return a.localeCompare(b)
          })
          .map(([groupCode, rounds]) => ({
            groupCode,
            rounds: Object.entries(rounds)
              .sort(([, matchesA], [, matchesB]) => {
                const aStart = new Date(matchesA[0]?.kickoff_at ?? 0).getTime()
                const bStart = new Date(matchesB[0]?.kickoff_at ?? 0).getTime()
                return aStart - bStart
              })
              .map(([roundName, roundMatches]) => ({ roundName, matches: roundMatches })),
          })),
      }))
  }, [matchesByGroup])

  useEffect(() => {
    setOpenGroups(prev => {
      const next = { ...prev }
      for (const phaseSection of groupedByPhase) {
        for (const group of phaseSection.groups) {
          const key = `${phaseSection.phase}:${group.groupCode}`
          if (next[key] === undefined) {
            next[key] = true
          }
        }
      }
      return next
    })
  }, [groupedByPhase])

  function toggleGroup(phase: string, groupCode: string) {
    const key = `${phase}:${groupCode}`
    setOpenGroups(prev => {
      const isOpen = prev[key] ?? true
      return { ...prev, [key]: !isOpen }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <BackButton to={poolId ? `/bolao/${poolId}/palpites` : '/dashboard'} label="Meus Palpites" />
      </div>

      <section className="relative px-0.5 py-0.5">
        <div className="border-b border-slate-200 pb-1.5">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-950 text-white flex-shrink-0">
              <IconFinishedMatches className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800 leading-tight">Resultados</h1>
          </div>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-600">Acompanhe jogos, palpites e classificação em um só lugar.</p>
        </div>
      </section>

      <div className="modern-card p-1.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSearchParams({ view: 'jogos' })}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition ${currentView === 'jogos' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-slate-50'}`}
          >
            Jogos
          </button>
          <button
            onClick={() => setSearchParams({ view: 'classificacao' })}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition ${currentView === 'classificacao' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-slate-50'}`}
          >
            Classificacao de Grupos
          </button>
        </div>
      </div>

      {currentView === 'jogos' ? (
        <>
      <div className="modern-card px-4 py-2 sm:px-5 sm:py-2.5">
        <button
          type="button"
          onClick={() => setIsJogosFiltersOpen(prev => !prev)}
          className="w-full flex items-center justify-between gap-2 py-1 text-left"
          aria-expanded={isJogosFiltersOpen}
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-600">Filtros</span>
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-white text-[10px] text-slate-600">
            {isJogosFiltersOpen ? '▾' : '▸'}
          </span>
        </button>

        {isJogosFiltersOpen && (
          <div className="mt-2 grid grid-cols-2 xl:grid-cols-4 gap-2.5">
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
              Rodada
              <select
                value={roundFilter}
                onChange={e => setRoundFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">Todas</option>
                {roundOptions.map(round => (
                  <option key={round.id} value={round.id}>{round.name}</option>
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
        )}
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-10">Carregando...</p>
      ) : filteredMatches.length === 0 ? (
        <p className="text-gray-400 text-center py-10">Nenhum jogo encontrado para os filtros selecionados.</p>
      ) : (
        <div className="space-y-6">
          {groupedByPhase.map(phaseSection => (
            <section key={phaseSection.phase} className="space-y-4">
              <div className="flex items-baseline gap-2 border-b border-slate-200 pb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Fase</p>
                <h2 className="text-sm sm:text-base font-black tracking-tight text-slate-800 leading-tight">{phaseSection.label}</h2>
              </div>

              <div className="space-y-5">
                {phaseSection.groups.map(group => (
                  <section key={group.groupCode} className="modern-card border border-slate-200 overflow-hidden">
                    {(() => {
                      const groupLabel = group.groupCode === 'Sem grupo' ? 'Eliminatorias' : `Grupo ${group.groupCode}`
                      const groupKey = `${phaseSection.phase}:${group.groupCode}`
                      const isOpen = openGroups[groupKey] ?? true
                      const matchesCount = group.rounds.reduce((acc, round) => acc + round.matches.length, 0)
                      const closedMatches = group.rounds.reduce(
                        (acc, round) => acc + round.matches.filter(match => match.status === 'encerrado').length,
                        0
                      )
                      const pendingMatches = matchesCount - closedMatches

                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleGroup(phaseSection.phase, group.groupCode)}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3 transition ${
                              isOpen
                                ? 'bg-gradient-to-r from-slate-900 to-slate-800 text-white'
                                : 'bg-white text-slate-800 hover:bg-slate-50'
                            }`}
                            aria-expanded={isOpen}
                          >
                            <span className="inline-flex items-center gap-2 min-w-0">
                              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                                isOpen ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {group.groupCode === 'Sem grupo' ? 'E' : group.groupCode}
                              </span>
                              <span className="text-xs sm:text-sm font-extrabold tracking-wide uppercase truncate">{groupLabel}</span>
                            </span>

                            <span className="inline-flex items-center gap-1.5 shrink-0">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                isOpen ? 'bg-emerald-400/20 text-emerald-100' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                <span className="sm:hidden">✅ {closedMatches}</span>
                                <span className="hidden sm:inline">✅ {closedMatches} concluidos</span>
                              </span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                isOpen ? 'bg-amber-400/20 text-amber-100' : 'bg-amber-100 text-amber-700'
                              }`}>
                                <span className="sm:hidden">⏳ {pendingMatches}</span>
                                <span className="hidden sm:inline">⏳ {pendingMatches} pendentes</span>
                              </span>
                              <span className={`text-base leading-none transition-transform ${isOpen ? 'rotate-0 text-white' : '-rotate-90 text-slate-500'}`}>
                                ▼
                              </span>
                            </span>
                          </button>

                          {isOpen && (
                            <div className="border-t border-slate-200 bg-gradient-to-b from-slate-50/70 to-white px-2 pb-2 pt-2.5 sm:px-3 sm:pb-3 sm:pt-3">
                              <div className="space-y-3">
                                {group.rounds.map(round => (
                                  <div key={round.roundName} className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 space-y-2">
                                    <div className={phaseSection.phase === 'grupos' ? 'grid gap-2 grid-cols-1 lg:grid-cols-2' : 'grid gap-2.5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}>
                                      {round.matches.map(m => {
                                        const now = new Date()
                                        const canViewPreds = new Date(m.cutoff_at) <= now
                                        const isClosed = m.status === 'encerrado'
                                        const myPrediction = myPredictionsByMatch[m.id]

                                        return (
                                          <button
                                            key={m.id}
                                            onClick={() => canViewPreds ? loadPreds(m.id) : undefined}
                                            className={canViewPreds ? 'cursor-pointer' : 'cursor-default opacity-90'}
                                          >
                                            <ResultMatchCard
                                              kickoffAt={m.kickoff_at}
                                              venue={m.venue}
                                              metaPrefix={round.roundName}
                                              metaPrefixMobile={compactRoundLabel(round.roundName)}
                                              homeTeam={m.home_team}
                                              awayTeam={m.away_team}
                                              homeScore={m.home_score}
                                              awayScore={m.away_score}
                                              canViewPreds={canViewPreds}
                                              isClosed={isClosed}
                                              myPrediction={myPrediction}
                                            />
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
        </>
      ) : (
        <>
          {loading ? (
            <p className="text-gray-400 text-center py-10">Carregando classificacao...</p>
          ) : groupStandings.length === 0 ? (
            <p className="text-gray-400 text-center py-10">Nenhum grupo encontrado para este bolao.</p>
          ) : (
            <>
            <p className="text-xs text-gray-500 mb-3 text-center">
              Visualização de palpites: a partir de {groupPredictionsRevealAt ? new Date(groupPredictionsRevealAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'a definir'}
              <br />
              Apuração da pontuação: após {groupResultsApurationAt ? new Date(groupResultsApurationAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'o último jogo da fase de grupos'}
            </p>

            <div className="modern-card px-4 py-2 sm:px-5 sm:py-2.5 mb-3">
              <button
                type="button"
                onClick={() => setIsClassificacaoFiltersOpen(prev => !prev)}
                className="w-full flex items-center justify-between gap-2 py-1 text-left"
                aria-expanded={isClassificacaoFiltersOpen}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-gray-600">Filtros</span>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-white text-[10px] text-slate-600">
                  {isClassificacaoFiltersOpen ? '▾' : '▸'}
                </span>
              </button>

              {isClassificacaoFiltersOpen && (
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  <label className="flex flex-col gap-0.5 text-xs text-gray-600">
                    Time
                    <input
                      type="text"
                      value={classificationTeamFilter}
                      onChange={e => setClassificationTeamFilter(e.target.value)}
                      list="classification-team-options"
                      placeholder="Digite para filtrar por time"
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <datalist id="classification-team-options">
                      {classificationTeamOptions.map(team => (
                        <option key={team} value={team} />
                      ))}
                    </datalist>
                  </label>

                  <label className="flex flex-col gap-0.5 text-xs text-gray-600">
                    Grupo
                    <select
                      value={classificationGroupFilter}
                      onChange={e => setClassificationGroupFilter(e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="all">Todos</option>
                      {classificationGroupOptions.map(code => (
                        <option key={code} value={code}>Grupo {code}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>

            {filteredGroupStandings.length === 0 ? (
              <p className="text-gray-400 text-center py-6">Nenhum grupo encontrado para os filtros selecionados.</p>
            ) : (
            <div className="space-y-4">
              {filteredGroupStandings.map(group => {
                const groupCode = group.group?.code ?? '-'
                const classification = groupClassifications.get(groupCode) ?? []
                const groupId = group.group_id || group.group?.id || `code-${groupCode}`
                const isExpanded = openGroups[groupId] ?? true
                
                return (
                  <div key={group.group?.code ?? group.group_id} className="modern-card border border-slate-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenGroups(prev => {
                          const isOpen = prev[groupId] ?? true
                          return { ...prev, [groupId]: !isOpen }
                        })
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3 transition ${
                        isExpanded
                          ? 'bg-gradient-to-r from-slate-900 to-slate-800 text-white'
                          : 'bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                      aria-expanded={isExpanded}
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                          isExpanded ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {groupCode}
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold tracking-wide uppercase truncate">Grupo {groupCode}</span>
                      </span>
                      <span className={`text-base leading-none transition-transform ${isExpanded ? 'rotate-0 text-white' : '-rotate-90 text-slate-500'}`}>
                        ▼
                      </span>
                    </button>

                    {isExpanded && (
                    <div className="p-4 space-y-3 sm:p-5">
                      <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-gray-600">
                            <th className="text-left py-2 px-2 font-semibold">Pos</th>
                            <th className="text-left py-2 px-2 font-semibold">Time</th>
                            <th className="text-center py-2 px-1 font-semibold">P</th>
                            <th className="text-center py-2 px-1 font-semibold">J</th>
                            <th className="hidden sm:table-cell text-center py-2 px-1 font-semibold">V</th>
                            <th className="hidden sm:table-cell text-center py-2 px-1 font-semibold">E</th>
                            <th className="hidden sm:table-cell text-center py-2 px-1 font-semibold">D</th>
                            <th className="text-center py-2 px-1 font-semibold">GP</th>
                            <th className="hidden sm:table-cell text-center py-2 px-1 font-semibold">GC</th>
                            <th className="text-center py-2 px-1 font-semibold">SG</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classification.map((team, idx) => (
                            <tr key={team.team_id} className={`border-b border-slate-100 ${idx < 2 ? 'bg-slate-50' : ''}`}>
                              <td className="text-center py-2 px-2 font-bold text-gray-700">{idx + 1}</td>
                              <td className="text-left py-2 px-2">
                                <div className="flex items-center gap-1.5">
                                  {team.flag_code && <FlagOnly flagCode={team.flag_code} size="xs" />}
                                  <span className="text-gray-800 font-medium truncate">{team.team_name}</span>
                                </div>
                              </td>
                              <td className="text-center py-2 px-1 font-extrabold text-slate-900">{team.points}</td>
                              <td className="text-center py-2 px-1 text-gray-600">{team.matches}</td>
                              <td className="hidden sm:table-cell text-center py-2 px-1 text-green-700 font-semibold">{team.wins}</td>
                              <td className="hidden sm:table-cell text-center py-2 px-1 text-yellow-700 font-semibold">{team.draws}</td>
                              <td className="hidden sm:table-cell text-center py-2 px-1 text-red-700 font-semibold">{team.losses}</td>
                              <td className="text-center py-2 px-1 text-gray-700 font-medium">{team.goals_for}</td>
                              <td className="hidden sm:table-cell text-center py-2 px-1 text-gray-700 font-medium">{team.goals_against}</td>
                              <td className="text-center py-2 px-1 font-semibold" style={{ color: team.goals_for - team.goals_against > 0 ? '#059669' : team.goals_for - team.goals_against < 0 ? '#dc2626' : '#666' }}>
                                {team.goals_for - team.goals_against > 0 ? '+' : ''}{team.goals_for - team.goals_against}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        onClick={() => loadGroupPreds(group)}
                        disabled={!canViewAllGroupPreds}
                        className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${canViewAllGroupPreds ? 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100' : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                      >
                        Ver palpites
                      </button>
                    </div>
                    </div>
                    )}
                  </div>
                )
              })}
            </div>
            )}
            </>
          )}
        </>
      )}

      <MatchPredictionsModal
        open={Boolean(selected)}
        match={selected ? matches.find(m => m.id === selected) ?? null : null}
        userPreds={userPreds}
        loadingPreds={loadingPreds}
        onClose={closeModal}
        currentUserId={user?.id ?? null}
      />

      {selectedGroupId && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[1px] flex items-end sm:items-start sm:p-4"
          onClick={() => closeModal()}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full sm:max-w-3xl sm:mx-auto sm:mt-8 bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border-t-2 border-x-2 border-slate-200 sm:border-2 sm:border-slate-300 sm:ring-4 sm:ring-slate-100/90 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const selectedGroup = selectedGroupStanding
              if (!selectedGroup) return null
              return (
                <>
                  <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-slate-300" />
                  </div>
                  <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 pt-2 pb-3 sm:px-5">
                    <div className="flex justify-end mb-1">
                      <button onClick={() => closeModal()} aria-label="Fechar">×</button>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-xs text-slate-500 font-semibold">Classificacao final do Grupo {selectedGroup.group?.code ?? '-'}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">1º</p>
                          {selectedGroup.first_team ? (
                            <TeamWithFlag name={selectedGroup.first_team.name} flagCode={selectedGroup.first_team.flag_code} size="sm" compact />
                          ) : (
                            <p className="text-xs text-gray-400 mt-1">Nao definido</p>
                          )}
                        </div>
                        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700">2º</p>
                          {selectedGroup.second_team ? (
                            <TeamWithFlag name={selectedGroup.second_team.name} flagCode={selectedGroup.second_team.flag_code} size="sm" compact />
                          ) : (
                            <p className="text-xs text-gray-400 mt-1">Nao definido</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}

            <div className="flex-1 overflow-auto p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 text-center mb-3">Palpites</p>
              {loadingGroupPreds ? (
                <p className="text-gray-400">Carregando palpites...</p>
              ) : groupPreds.length === 0 ? (
                <p className="text-gray-400">Nenhum palpite registrado para este grupo.</p>
              ) : (
                <div className="space-y-2">
                  {[...groupPreds].sort((a, b) => a.user_name.localeCompare(b.user_name, 'pt-BR')).map((row, i) => {
                    const firstTone = getGroupSlotTone(row.first_team?.id, 'first')
                    const secondTone = getGroupSlotTone(row.second_team?.id, 'second')
                    const pointsBadge = getPointsBadge(row.points)
                    const isCurrentUser = row.user_id === user?.id

                    return (
                      <div key={i} className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`truncate text-sm ${isCurrentUser ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>{row.user_name}</span>
                          {isCurrentUser && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-normal bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm whitespace-nowrap">você</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className={`rounded p-1 border ${firstTone}`}>
                            {row.first_team ? (
                              <FlagOnly flagCode={row.first_team.flag_code} size="md" />
                            ) : (
                              <span className="text-[10px] text-gray-400">-</span>
                            )}
                          </div>
                          <div className={`rounded p-1 border ${secondTone}`}>
                            {row.second_team ? (
                              <FlagOnly flagCode={row.second_team.flag_code} size="md" />
                            ) : (
                              <span className="text-[10px] text-gray-400">-</span>
                            )}
                          </div>
                          <span className={`inline-flex items-center rounded-full border text-xs font-bold px-2 py-0.5 ${pointsBadge.className}`}>
                            {pointsBadge.text}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
