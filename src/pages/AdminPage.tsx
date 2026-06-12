import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { IconSettings } from '@/components/Icons'
import TeamWithFlag from '@/components/TeamWithFlag'
import SnapshotPredictions from '@/components/SnapshotPredictions'
import { exportSnapshotAsImage } from '@/lib/export-snapshot'

const PHASE_LABELS: Record<string, string> = {
  grupos: 'Fase de Grupos',
  oitavas: 'Oitavas de Final',
  quartas: 'Quartas de Final',
  semi: 'Semifinal',
  terceiro_lugar: 'Disputa de 3º',
  final: 'Final',
}

interface Member {
  user_id: string
  name: string
  email: string
  is_admin: boolean
}

interface PaymentRow {
  user_id: string
  name: string
  email: string
  is_admin: boolean
  amount_cents: number
  status: 'pendente' | 'confirmado' | 'rejeitado'
  paid_at: string | null
  confirmed_at: string | null
  notes: string | null
}

interface PaymentDraft {
  status: 'pendente' | 'confirmado' | 'rejeitado'
  notes: string
}

interface Round {
  id: string
  name: string
  phase: string
}

interface Match {
  id: string
  group: { code: string } | null
  kickoff_at: string
  venue: string
  cutoff_at: string
  status: string
  home_score: number | null
  away_score: number | null
  home_team: { name: string; flag_code: string | null } | null
  away_team: { name: string; flag_code: string | null } | null
}

interface ResultDraft {
  home: string
  away: string
  cutoffAt: string
}

interface GroupStandingDraft {
  first_id: string
  second_id: string
}

interface GroupSection {
  id: string
  code: string
  teams: { id: string; name: string; flag_code: string | null }[]
}

interface Prediction {
  user_id: string
  user_name: string
  home_guess: number
  away_guess: number
  points: number | null
}

function toDateTimeLocalValue(dbValue: string | null | undefined) {
  if (!dbValue) return ''
  return dbValue.replace(' ', 'T').slice(0, 16)
}

export default function AdminPage() {
  const { poolId } = useParams()
  const { profile } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [email, setEmail] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [addMemberMsg, setAddMemberMsg] = useState('')
  const [newRound, setNewRound] = useState({ name: '', phase: 'grupos' })
  const [addingRound, setAddingRound] = useState(false)
  const [selectedRoundId, setSelectedRoundId] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>({})
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [savingMatch, setSavingMatch] = useState<Record<string, boolean>>({})
  const [matchMessage, setMatchMessage] = useState<Record<string, string>>({})
  const [groupFilter, setGroupFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'encerrado'>('all')
  const [isGlobalDefault, setIsGlobalDefault] = useState(false)
  const [updatingDefault, setUpdatingDefault] = useState(false)
  const [defaultMessage, setDefaultMessage] = useState('')
  const [groupPredictionsCutoffDraft, setGroupPredictionsCutoffDraft] = useState('')
  const [savingGroupPredictionsCutoff, setSavingGroupPredictionsCutoff] = useState(false)
  const [groupPredictionsCutoffMessage, setGroupPredictionsCutoffMessage] = useState('')
  const [groupSections, setGroupSections] = useState<GroupSection[]>([])
  const [groupStandingsDrafts, setGroupStandingsDrafts] = useState<Record<string, GroupStandingDraft>>({})
  const [savingGroupStandingByGroup, setSavingGroupStandingByGroup] = useState<Record<string, boolean>>({})
  const [groupStandingMsgByGroup, setGroupStandingMsgByGroup] = useState<Record<string, string>>({})
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([])
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, PaymentDraft>>({})
  const [savingPaymentByUser, setSavingPaymentByUser] = useState<Record<string, boolean>>({})
  const [savingAdminByUser, setSavingAdminByUser] = useState<Record<string, boolean>>({})
  const [nameDraftByUser, setNameDraftByUser] = useState<Record<string, string>>({})
  const [savingNameByUser, setSavingNameByUser] = useState<Record<string, boolean>>({})
  const [editingNameByUser, setEditingNameByUser] = useState<Record<string, boolean>>({})
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [activeTab, setActiveTab] = useState<'geral' | 'classificacao' | 'pessoas' | 'jogos'>('jogos')

  const [predictionsByMatch, setPredictionsByMatch] = useState<Record<string, Prediction[]>>({})
  const [loadingPredictions, setLoadingPredictions] = useState<Record<string, boolean>>({})
  const [openSnapshotMatch, setOpenSnapshotMatch] = useState<string | null>(null)
  const [exportingImage, setExportingImage] = useState(false)

  const paidMembersCount = paymentRows.filter(p => p.status === 'confirmado').length
  const pendingMembersCount = paymentRows.filter(p => p.status !== 'confirmado').length

  const availableGroups = Array.from(
    new Set(matches.map(m => m.group?.code).filter((code): code is string => Boolean(code)))
  ).sort((a, b) => a.localeCompare(b))

  const filteredMatches = matches.filter(m => {
    const groupOk = groupFilter === 'all' || m.group?.code === groupFilter
    const statusOk = statusFilter === 'all' || m.status === statusFilter
    return groupOk && statusOk
  })

  const sortedPaymentRows = [...paymentRows].sort((a, b) => {
    const statusOrder: Record<string, number> = { pendente: 0, confirmado: 1, rejeitado: 2 }
    return (statusOrder[a.status] ?? 999) - (statusOrder[b.status] ?? 999)
  })

  useEffect(() => {
    if (poolId) loadData()
  }, [poolId])

  useEffect(() => {
    if (selectedRoundId) loadMatches(selectedRoundId)
    else {
      setMatches([])
      setResultDrafts({})
      setMatchMessage({})
      setGroupFilter('all')
      setStatusFilter('all')
    }
  }, [selectedRoundId])

  async function loadData() {
    const { data: poolData } = await supabase
      .from('pools')
      .select('is_default_global, group_predictions_cutoff_at')
      .eq('id', poolId!)
      .single()

    setIsGlobalDefault(Boolean((poolData as any)?.is_default_global))
    setGroupPredictionsCutoffDraft(toDateTimeLocalValue((poolData as any)?.group_predictions_cutoff_at ?? null))

    const { data: memberData } = await supabase
      .from('pool_members')
      .select('user_id')
      .eq('pool_id', poolId!)

    const userIds = (memberData ?? []).map((m: any) => m.user_id)
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, email, is_admin')
        .in('id', userIds)

      const byId = new Map((profilesData ?? []).map((p: any) => [p.id, p]))
      const merged: Member[] = userIds.map((id: string) => {
        const p = byId.get(id)
        return {
          user_id: id,
          name: p?.name ?? '(sem nome)',
          email: p?.email ?? '(sem email)',
          is_admin: Boolean(p?.is_admin),
        }
      })
      setMembers(merged)
      await loadPayments(merged)
    } else {
      setMembers([])
      setPaymentRows([])
      setPaymentDrafts({})
    }

    const { data: roundData } = await supabase
      .from('rounds')
      .select('*')
      .eq('pool_id', poolId!)
      .order('created_at')
    const nextRounds = (roundData ?? []) as Round[]
    setRounds(nextRounds)

    if (nextRounds.length === 0) {
      setSelectedRoundId('')
    } else if (!selectedRoundId || !nextRounds.some(r => r.id === selectedRoundId)) {
      setSelectedRoundId(nextRounds[nextRounds.length - 1].id)
    }

    await loadGroupStandings(nextRounds)
  }

  async function loadPayments(membersList: Member[]) {
    if (!poolId) return

    const userIds = membersList.map(m => m.user_id)
    if (userIds.length === 0) {
      setPaymentRows([])
      setPaymentDrafts({})
      return
    }

    setLoadingPayments(true)

    const { data, error } = await (supabase
      .from('payments') as any)
      .select('user_id, amount_cents, status, paid_at, confirmed_at, notes')
      .eq('pool_id', poolId)
      .in('user_id', userIds)

    const paymentsByUser = new Map<string, any>((data ?? []).map((row: any) => [row.user_id, row]))

    const rows: PaymentRow[] = membersList.map(member => {
      const payment = paymentsByUser.get(member.user_id)
      return {
        user_id: member.user_id,
        name: member.name,
        email: member.email,
        is_admin: member.is_admin,
        amount_cents: payment?.amount_cents ?? 10000,
        status: (payment?.status ?? 'pendente') as 'pendente' | 'confirmado' | 'rejeitado',
        paid_at: payment?.paid_at ?? null,
        confirmed_at: payment?.confirmed_at ?? null,
        notes: payment?.notes ?? null,
      }
    })

    if (error) {
      console.error('[Admin] loadPayments:error', { message: error.message })
    }

    setPaymentRows(rows)
    setEditingNameByUser({})
    setNameDraftByUser(rows.reduce((acc, row) => {
      acc[row.user_id] = row.name
      return acc
    }, {} as Record<string, string>))
    setPaymentDrafts(
      rows.reduce((acc, row) => {
        acc[row.user_id] = {
          status: row.status,
          notes: row.notes ?? '',
        }
        return acc
      }, {} as Record<string, PaymentDraft>)
    )
    setLoadingPayments(false)
  }

  function updatePaymentDraft(userId: string, patch: Partial<PaymentDraft>) {
    setPaymentDrafts(prev => ({
      ...prev,
      [userId]: {
        status: patch.status ?? prev[userId]?.status ?? 'pendente',
        notes: patch.notes ?? prev[userId]?.notes ?? '',
      },
    }))
  }

  async function saveMemberPayment(userId: string, forcedStatus?: 'pendente' | 'confirmado' | 'rejeitado') {
    if (!poolId || !profile) return

    const draft = paymentDrafts[userId]
    const nextStatus = forcedStatus ?? draft?.status
    if (!nextStatus) return

    setSavingPaymentByUser(prev => ({ ...prev, [userId]: true }))

    const nowIso = new Date().toISOString()
    const paidAt = nextStatus === 'confirmado' ? nowIso : null
    const confirmedAt = nextStatus === 'pendente' ? null : nowIso
    const confirmedBy = nextStatus === 'pendente' ? null : profile.id

    const { error } = await (supabase.from('payments') as any)
      .upsert(
        {
          pool_id: poolId,
          user_id: userId,
          amount_cents: 10000,
          status: nextStatus,
          paid_at: paidAt,
          confirmed_at: confirmedAt,
          confirmed_by: confirmedBy,
          notes: draft?.notes?.trim() ? draft.notes.trim() : null,
        },
        { onConflict: 'pool_id,user_id' }
      )

    if (error) {
      setSavingPaymentByUser(prev => ({ ...prev, [userId]: false }))
      return
    }

    await loadPayments(members)
    setSavingPaymentByUser(prev => ({ ...prev, [userId]: false }))
  }

  async function setMemberAdmin(userId: string, nextIsAdmin: boolean) {
    if (profile?.id === userId && !nextIsAdmin) return

    setSavingAdminByUser(prev => ({ ...prev, [userId]: true }))

    const { error } = await (supabase.from('profiles') as any)
      .update({ is_admin: nextIsAdmin })
      .eq('id', userId)

    if (!error) {
      setMembers(prev => prev.map(member => (
        member.user_id === userId ? { ...member, is_admin: nextIsAdmin } : member
      )))

      setPaymentRows(prev => prev.map(row => (
        row.user_id === userId ? { ...row, is_admin: nextIsAdmin } : row
      )))
    }

    setSavingAdminByUser(prev => ({ ...prev, [userId]: false }))
  }

  function updateNameDraft(userId: string, value: string) {
    setNameDraftByUser(prev => ({ ...prev, [userId]: value }))
  }

  async function saveMemberName(userId: string) {
    const nextName = (nameDraftByUser[userId] ?? '').trim()
    if (!nextName) {
      return false
    }

    setSavingNameByUser(prev => ({ ...prev, [userId]: true }))

    const { error } = await (supabase.from('profiles') as any)
      .update({ name: nextName })
      .eq('id', userId)

    let saved = false
    if (!error) {
      setMembers(prev => prev.map(member => (
        member.user_id === userId ? { ...member, name: nextName } : member
      )))

      setPaymentRows(prev => prev.map(row => (
        row.user_id === userId ? { ...row, name: nextName } : row
      )))

      setNameDraftByUser(prev => ({ ...prev, [userId]: nextName }))
      saved = true
    }

    setSavingNameByUser(prev => ({ ...prev, [userId]: false }))
    return saved
  }

  async function handleMemberNameAction(userId: string, currentName: string) {
    const isEditing = Boolean(editingNameByUser[userId])
    if (!isEditing) {
      setEditingNameByUser(prev => ({ ...prev, [userId]: true }))
      return
    }

    const nextName = (nameDraftByUser[userId] ?? currentName).trim()
    if (!nextName) return

    if (nextName === currentName) {
      setEditingNameByUser(prev => ({ ...prev, [userId]: false }))
      return
    }

    const saved = await saveMemberName(userId)
    if (saved) {
      setEditingNameByUser(prev => ({ ...prev, [userId]: false }))
    }
  }

  async function loadGroupStandings(poolRounds?: Round[]) {
    const roundsForPool = poolRounds ?? rounds
    const groupRoundIds = roundsForPool.filter(r => r.phase === 'grupos').map(r => r.id)

    if (groupRoundIds.length === 0) {
      setGroupSections([])
      setGroupStandingsDrafts({})
      return
    }

    const { data: matchesData } = await supabase
      .from('matches')
      .select(`
        group_id,
        group:groups(id, code),
        home_team:teams!matches_home_team_id_fkey(id, name, flag_code),
        away_team:teams!matches_away_team_id_fkey(id, name, flag_code)
      `)
      .in('round_id', groupRoundIds)
      .not('group_id', 'is', null)

    const groupMap = new Map<string, GroupSection>()
    for (const row of matchesData ?? []) {
      const group = (row as any).group
      const groupId = (row as any).group_id
      if (!groupId || !group) continue
      const current = groupMap.get(groupId) ?? { id: group.id, code: group.code, teams: [] }

      const homeTeam = (row as any).home_team
      const awayTeam = (row as any).away_team
      if (homeTeam && !current.teams.some(t => t.id === homeTeam.id)) current.teams.push(homeTeam)
      if (awayTeam && !current.teams.some(t => t.id === awayTeam.id)) current.teams.push(awayTeam)

      groupMap.set(groupId, current)
    }

    const sections = Array.from(groupMap.values()).sort((a, b) => a.code.localeCompare(b.code))
    setGroupSections(sections)

    const groupIds = sections.map(s => s.id)
    if (groupIds.length === 0) {
      setGroupStandingsDrafts({})
      return
    }

    const { data: standingsData } = await supabase
      .from('group_standings')
      .select('group_id, first_id, second_id')
      .in('group_id', groupIds)

    const standingsByGroup = new Map((standingsData ?? []).map((row: any) => [row.group_id, row]))
    const nextDrafts: Record<string, GroupStandingDraft> = {}
    for (const section of sections) {
      const standing = standingsByGroup.get(section.id)
      nextDrafts[section.id] = {
        first_id: standing?.first_id ?? '',
        second_id: standing?.second_id ?? '',
      }
    }

    setGroupStandingsDrafts(nextDrafts)
  }

  function updateGroupStandingDraft(groupId: string, field: 'first_id' | 'second_id', value: string) {
    setGroupStandingsDrafts(prev => ({
      ...prev,
      [groupId]: {
        first_id: field === 'first_id' ? value : prev[groupId]?.first_id ?? '',
        second_id: field === 'second_id' ? value : prev[groupId]?.second_id ?? '',
      },
    }))
    setGroupStandingMsgByGroup(prev => ({ ...prev, [groupId]: '' }))
  }

  async function saveGroupStanding(groupId: string) {
    const draft = groupStandingsDrafts[groupId]
    if (!draft) return

    if (!draft.first_id || !draft.second_id || draft.first_id === draft.second_id) {
      setGroupStandingMsgByGroup(prev => ({ ...prev, [groupId]: 'Selecione 1º e 2º diferentes.' }))
      return
    }

    setSavingGroupStandingByGroup(prev => ({ ...prev, [groupId]: true }))
    setGroupStandingMsgByGroup(prev => ({ ...prev, [groupId]: '' }))

    const { error } = await (supabase.from('group_standings') as any)
      .upsert({ group_id: groupId, first_id: draft.first_id, second_id: draft.second_id }, { onConflict: 'group_id' })

    if (error) {
      setGroupStandingMsgByGroup(prev => ({ ...prev, [groupId]: 'Nao conseguimos salvar a classificacao. Tente novamente.' }))
      setSavingGroupStandingByGroup(prev => ({ ...prev, [groupId]: false }))
      return
    }

    const { error: recalcError } = await (supabase as any).rpc('recalculate_group_predictions_for_group', { p_group_id: groupId })
    if (recalcError) {
      setGroupStandingMsgByGroup(prev => ({ ...prev, [groupId]: 'Classificacao salva com sucesso!' }))
    } else {
      setGroupStandingMsgByGroup(prev => ({ ...prev, [groupId]: 'Classificacao salva e pontuacao recalculada.' }))
    }

    setSavingGroupStandingByGroup(prev => ({ ...prev, [groupId]: false }))
  }

  async function setAsGlobalDefault() {
    if (!poolId || updatingDefault) return

    setUpdatingDefault(true)
    setDefaultMessage('')

    const { error } = await (supabase as any).rpc('set_global_default_pool', { p_pool_id: poolId })
    if (error) {
      setDefaultMessage('Nao conseguimos atualizar as configuracoes. Tente novamente.')
      setUpdatingDefault(false)
      return
    }

    setIsGlobalDefault(true)
    setDefaultMessage('Configuracoes atualizadas com sucesso!')
    setUpdatingDefault(false)
  }

  async function saveGroupPredictionsCutoff() {
    if (!poolId || savingGroupPredictionsCutoff) return

    setSavingGroupPredictionsCutoff(true)
    setGroupPredictionsCutoffMessage('')

    let nextValue: string | null = null
    if (groupPredictionsCutoffDraft) {
      const parsed = new Date(groupPredictionsCutoffDraft)
      if (Number.isNaN(parsed.getTime())) {
        setGroupPredictionsCutoffMessage('Data invalida para prazo da classificacao.')
        setSavingGroupPredictionsCutoff(false)
        return
      }
      nextValue = parsed.toISOString()
    }

    const { error } = await (supabase.from('pools') as any)
      .update({ group_predictions_cutoff_at: nextValue })
      .eq('id', poolId)

    if (error) {
      setGroupPredictionsCutoffMessage('Nao conseguimos atualizar o prazo. Tente novamente.')
    } else {
      setGroupPredictionsCutoffMessage(
        nextValue
          ? 'Prazo atualizado com sucesso!'
          : 'Prazo removido. Usando configuracao automatica.'
      )
    }

    setSavingGroupPredictionsCutoff(false)
  }

  async function loadMatches(roundId: string) {
    setLoadingMatches(true)

    const { data, error } = await supabase
      .from('matches')
      .select(`
        id, kickoff_at, venue, cutoff_at, status, home_score, away_score,
        group:groups(code),
        home_team:teams!matches_home_team_id_fkey(name, flag_code),
        away_team:teams!matches_away_team_id_fkey(name, flag_code)
      `)
      .eq('round_id', roundId)
      .order('kickoff_at')

    if (error) {
      setMatches([])
      setResultDrafts({})
      setLoadingMatches(false)
      return
    }

    const loaded = ((data ?? []) as unknown as Match[]).sort((a, b) => {
      const ga = a.group?.code ?? 'ZZ'
      const gb = b.group?.code ?? 'ZZ'
      if (ga !== gb) return ga.localeCompare(gb)
      return new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    })
    setMatches(loaded)

    const drafts: Record<string, ResultDraft> = {}
    for (const m of loaded) {
      drafts[m.id] = {
        home: m.home_score !== null ? String(m.home_score) : '',
        away: m.away_score !== null ? String(m.away_score) : '',
        cutoffAt: toDateTimeLocalValue(m.cutoff_at),
      }
    }
    setResultDrafts(drafts)
    setMatchMessage({})
    setGroupFilter('all')
    setStatusFilter('all')
    setLoadingMatches(false)
  }

  async function addMember() {
    if (!email.trim()) return
    setAddingMember(true)
    setAddMemberMsg('')
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.trim())
      .single()

    if (!profileData) {
      setAddMemberMsg('Usuário não encontrado com esse email.')
      setAddingMember(false)
      return
    }

    const { error } = await (supabase.from('pool_members') as any).insert({ pool_id: poolId!, user_id: (profileData as any).id })
    if (error) {
      setAddMemberMsg(error.code === '23505' ? 'Este participante ja esta no bolao.' : 'Nao conseguimos adicionar. Tente novamente.')
    } else {
      setAddMemberMsg('Participante adicionado com sucesso!')
      setEmail('')
      loadData()
    }
    setAddingMember(false)
  }

  async function addRound() {
    if (!newRound.name) return
    setAddingRound(true)
    await (supabase.from('rounds') as any).insert({ ...newRound, pool_id: poolId! })
    setNewRound({ name: '', phase: 'grupos' })
    setAddingRound(false)
    loadData()
  }

  function updateDraft(matchId: string, side: 'home' | 'away', value: string) {
    setResultDrafts(prev => ({
      ...prev,
      [matchId]: {
        home: side === 'home' ? value : (prev[matchId]?.home ?? ''),
        away: side === 'away' ? value : (prev[matchId]?.away ?? ''),
        cutoffAt: prev[matchId]?.cutoffAt ?? '',
      },
    }))
  }

  function updateCutoffDraft(matchId: string, value: string) {
    setResultDrafts(prev => ({
      ...prev,
      [matchId]: {
        home: prev[matchId]?.home ?? '',
        away: prev[matchId]?.away ?? '',
        cutoffAt: value,
      },
    }))
  }

  function parseDraft(matchId: string) {
    const draft = resultDrafts[matchId]
    if (!draft) return null
    const home = Number.parseInt(draft.home, 10)
    const away = Number.parseInt(draft.away, 10)
    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) return null
    return { home, away }
  }

  async function closeMatch(matchId: string) {
    const parsed = parseDraft(matchId)
    if (!parsed) {
      setMatchMessage(prev => ({ ...prev, [matchId]: 'Preencha placares válidos antes de encerrar.' }))
      return
    }

    const cutoffDraft = resultDrafts[matchId]?.cutoffAt ?? ''
    const currentMatch = matches.find(m => m.id === matchId)
    const originalCutoff = currentMatch?.cutoff_at ?? null
    const originalDraftValue = toDateTimeLocalValue(originalCutoff)

    let cutoffAt: string | null = null
    if (!cutoffDraft) {
      cutoffAt = null
    } else if (originalCutoff && cutoffDraft === originalDraftValue) {
      cutoffAt = originalCutoff
    } else {
      const parsedDate = new Date(cutoffDraft)
      cutoffAt = Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString()
    }

    setSavingMatch(prev => ({ ...prev, [matchId]: true }))
    setMatchMessage(prev => ({ ...prev, [matchId]: '' }))

    const { error } = await (supabase.from('matches') as any)
      .update({ home_score: parsed.home, away_score: parsed.away, cutoff_at: cutoffAt, status: 'encerrado' })
      .eq('id', matchId)

    if (error) {
      setMatchMessage(prev => ({ ...prev, [matchId]: 'Nao conseguimos atualizar o resultado. Tente novamente.' }))
    } else {
      setMatchMessage(prev => ({ ...prev, [matchId]: 'Partida encerrada e pontos recalculados.' }))
      if (selectedRoundId) loadMatches(selectedRoundId)
    }

    setSavingMatch(prev => ({ ...prev, [matchId]: false }))
  }

  async function reopenMatch(matchId: string) {
    setSavingMatch(prev => ({ ...prev, [matchId]: true }))
    setMatchMessage(prev => ({ ...prev, [matchId]: '' }))

    const { error } = await (supabase.from('matches') as any)
      .update({ home_score: null, away_score: null, status: 'pendente' })
      .eq('id', matchId)

    if (error) {
      setMatchMessage(prev => ({ ...prev, [matchId]: 'Nao conseguimos reabrir a partida. Tente novamente.' }))
    } else {
      setMatchMessage(prev => ({ ...prev, [matchId]: 'Partida reaberta. Pontos do jogo zerados.' }))
      if (selectedRoundId) loadMatches(selectedRoundId)
    }

    setSavingMatch(prev => ({ ...prev, [matchId]: false }))
  }

  async function loadPredictions(matchId: string) {
    if (predictionsByMatch[matchId]) {
      setOpenSnapshotMatch(matchId)
      return
    }

    setLoadingPredictions(prev => ({ ...prev, [matchId]: true }))

    // Tenta primeiro sem join com profiles
    const { data: predictionsData, error: predictionsError } = await (supabase
      .from('predictions') as any)
      .select(`
        user_id,
        home_guess,
        away_guess,
        points
      `)
      .eq('match_id', matchId)
      .eq('pool_id', poolId)

    console.log('[Admin] loadPredictions:first query', { predictionsError, count: predictionsData?.length })

    if (predictionsError) {
      console.error('[Admin] loadPredictions:error', { message: predictionsError.message })
      setLoadingPredictions(prev => ({ ...prev, [matchId]: false }))
      return
    }

    // Se temos dados, agora busca os nomes dos usuários
    let userNames: Record<string, string> = {}
    if (predictionsData && predictionsData.length > 0) {
      const userIds = predictionsData.map((p: any) => p.user_id)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds)

      userNames = Object.fromEntries(
        (profilesData ?? []).map((p: any) => [p.id, p.name])
      )
      console.log('[Admin] loadPredictions:profiles', { userNames })
    }

    const predictions: Prediction[] = (predictionsData ?? []).map((row: any) => ({
      user_id: row.user_id,
      user_name: userNames[row.user_id] ?? 'Sem nome',
      home_guess: row.home_guess,
      away_guess: row.away_guess,
      points: row.points,
    }))

    setPredictionsByMatch(prev => ({
      ...prev,
      [matchId]: predictions,
    }))

    setLoadingPredictions(prev => ({ ...prev, [matchId]: false }))
    setOpenSnapshotMatch(matchId)
  }

  async function handleExportImage(matchId: string) {
    const match = matches.find(m => m.id === matchId)
    if (!match) return

    setExportingImage(true)

    try {
      await exportSnapshotAsImage(
        matchId,
        match.home_team?.name ?? 'Time A',
        match.away_team?.name ?? 'Time B',
        match.kickoff_at
      )
    } catch (error) {
      console.error('[Admin] Error exporting image:', error)
      alert('Erro ao gerar imagem. Tente novamente.')
    } finally {
      setExportingImage(false)
    }
  }

  if (!profile?.is_admin) {
    return <div className="text-center py-20 text-gray-400">Acesso restrito a administradores.</div>
  }

  return (
    <div className="space-y-8">
      <section className="relative px-0.5 py-0.5">
        <div className="border-b border-slate-200 pb-1.5">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-950 text-white flex-shrink-0">
              <IconSettings className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800 leading-tight">Administração do Bolão</h1>
          </div>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-600">{members.length} participantes · {rounds.length} rodadas</p>
        </div>
      </section>

      <section className="modern-card p-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => setActiveTab('geral')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold border transition ${activeTab === 'geral' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            Geral
          </button>
          <button
            onClick={() => setActiveTab('classificacao')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold border transition ${activeTab === 'classificacao' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            Classificação
          </button>
          <button
            onClick={() => setActiveTab('pessoas')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold border transition ${activeTab === 'pessoas' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            Pessoas
          </button>
          <button
            onClick={() => setActiveTab('jogos')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold border transition ${activeTab === 'jogos' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            Jogos
          </button>
        </div>
      </section>

      {activeTab === 'geral' && (
      <section>
        <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">Configuração Global</h2>
        <div className="modern-card p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Bolão padrão para novos usuários</p>
            </div>
            <button
              onClick={setAsGlobalDefault}
              disabled={isGlobalDefault || updatingDefault}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {updatingDefault ? 'Salvando...' : isGlobalDefault ? 'Padrão global ativo' : 'Definir como padrão global'}
            </button>
          </div>
          {defaultMessage && <p className="text-sm mt-3 text-gray-600">{defaultMessage}</p>}

          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-800">Prazo próprio para palpite de classificação</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={groupPredictionsCutoffDraft}
                onChange={e => setGroupPredictionsCutoffDraft(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              <button
                onClick={saveGroupPredictionsCutoff}
                disabled={savingGroupPredictionsCutoff}
                className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {savingGroupPredictionsCutoff ? 'Salvando...' : 'Salvar prazo'}
              </button>
            </div>

            {groupPredictionsCutoffMessage && (
              <p className="text-sm mt-2 text-gray-600">{groupPredictionsCutoffMessage}</p>
            )}
          </div>
        </div>
      </section>
      )}

      {/* Classificacao real por grupo */}
      {activeTab === 'classificacao' && (
      <section>
        <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">Classificacao Real dos Grupos</h2>
        {groupSections.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum grupo encontrado na fase de grupos deste bolao.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {groupSections.map(section => {
              const draft = groupStandingsDrafts[section.id] ?? { first_id: '', second_id: '' }
              const isSaving = Boolean(savingGroupStandingByGroup[section.id])

              return (
                <div key={section.id} className="modern-card p-4 space-y-3 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold tracking-wide text-gray-800 uppercase">Grupo {section.code}</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-gray-600">
                      1º colocado
                      <select
                        value={draft.first_id}
                        onChange={e => updateGroupStandingDraft(section.id, 'first_id', e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">Selecione</option>
                        {section.teams.map(team => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-xs text-gray-600">
                      2º colocado
                      <select
                        value={draft.second_id}
                        onChange={e => updateGroupStandingDraft(section.id, 'second_id', e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">Selecione</option>
                        {section.teams.map(team => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 min-h-[52px]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">1º real</p>
                      {draft.first_id ? (
                        <div className="mt-1">
                          {(() => {
                            const team = section.teams.find(t => t.id === draft.first_id)
                            return team ? <TeamWithFlag name={team.name} flagCode={team.flag_code} size="sm" compact /> : <p className="text-xs text-gray-400">Nao definido</p>
                          })()}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mt-1">Nao definido</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 min-h-[52px]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700">2º real</p>
                      {draft.second_id ? (
                        <div className="mt-1">
                          {(() => {
                            const team = section.teams.find(t => t.id === draft.second_id)
                            return team ? <TeamWithFlag name={team.name} flagCode={team.flag_code} size="sm" compact /> : <p className="text-xs text-gray-400">Nao definido</p>
                          })()}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mt-1">Nao definido</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => saveGroupStanding(section.id)}
                      disabled={isSaving}
                      className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                    >
                      {isSaving ? 'Salvando...' : 'Salvar classificacao'}
                    </button>
                  </div>

                  {groupStandingMsgByGroup[section.id] && (
                    <p className="text-xs text-gray-600">{groupStandingMsgByGroup[section.id]}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
      )}

      {activeTab === 'pessoas' && (
      <section>
        <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">Pessoas</h2>

        <div className="modern-card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-emerald-700 font-bold">Confirmados</p>
            <p className="text-2xl font-black text-emerald-800">{paidMembersCount}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-amber-700 font-bold">Pendentes</p>
            <p className="text-2xl font-black text-amber-800">{pendingMembersCount}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={addMember}
            disabled={addingMember}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 sm:w-auto"
          >
            Adicionar
          </button>
        </div>
        {addMemberMsg && <p className="text-sm mb-3 text-gray-600">{addMemberMsg}</p>}

        {loadingPayments ? (
          <p className="text-sm text-gray-400">Carregando...</p>
        ) : (
          <>
            <div className="md:hidden space-y-2">
              {sortedPaymentRows.map(row => (
                <div
                  key={row.user_id}
                  className={`modern-card p-3 ${row.status === 'pendente' ? 'border-2 border-amber-500 bg-amber-200 shadow-[0_0_0_1px_rgba(245,158,11,0.45)]' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    {editingNameByUser[row.user_id] ? (
                      <input
                        type="text"
                        value={nameDraftByUser[row.user_id] ?? row.name}
                        onChange={e => updateNameDraft(row.user_id, e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    ) : (
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{row.name}</p>
                    )}
                    <button
                      onClick={() => handleMemberNameAction(row.user_id, row.name)}
                      disabled={Boolean(savingNameByUser[row.user_id]) || (Boolean(editingNameByUser[row.user_id]) && !(nameDraftByUser[row.user_id] ?? row.name).trim())}
                      className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {savingNameByUser[row.user_id] ? '...' : editingNameByUser[row.user_id] ? 'Salvar' : (
                        <span aria-label="Editar nome" title="Editar nome" className="inline-flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </span>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{row.email}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${row.status === 'confirmado' ? 'bg-emerald-100 text-emerald-700' : row.status === 'rejeitado' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                      {row.status === 'confirmado' ? 'Confirmado' : row.status === 'rejeitado' ? 'Rejeitado' : 'Pendente'}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${row.is_admin ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                      {row.is_admin ? 'Admin' : 'Participante'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block modern-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left">Nome</th>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedPaymentRows.map(row => {
                    const draft = paymentDrafts[row.user_id] ?? { status: row.status, notes: row.notes ?? '' }
                    const isSavingPayment = Boolean(savingPaymentByUser[row.user_id])
                    const isSavingAdmin = Boolean(savingAdminByUser[row.user_id])
                    const isSavingName = Boolean(savingNameByUser[row.user_id])
                    const isEditingName = Boolean(editingNameByUser[row.user_id])
                    const nextName = (nameDraftByUser[row.user_id] ?? row.name).trim()
                    const canClickNameAction = !isSavingName && (!isEditingName || nextName.length > 0)

                    return (
                      <tr key={row.user_id} className={row.status === 'pendente' ? 'bg-amber-200/80 ring-1 ring-inset ring-amber-500' : ''}>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          <div className="flex items-center gap-2">
                            {row.status === 'pendente' && <span className="h-2.5 w-2.5 rounded-full bg-amber-700" aria-hidden="true" />}
                            {isEditingName ? (
                              <input
                                type="text"
                                value={nameDraftByUser[row.user_id] ?? row.name}
                                onChange={e => updateNameDraft(row.user_id, e.target.value)}
                                className="min-w-[170px] rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                              />
                            ) : (
                              <span>{row.name}</span>
                            )}
                            <button
                              onClick={() => handleMemberNameAction(row.user_id, row.name)}
                              disabled={!canClickNameAction}
                              className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {isSavingName ? '...' : isEditingName ? 'Salvar' : (
                                <span aria-label="Editar nome" title="Editar nome" className="inline-flex items-center justify-center">
                                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                                  </svg>
                                </span>
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{row.email}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <select
                              value={draft.status}
                              onChange={async e => {
                                const nextStatus = e.target.value as 'pendente' | 'confirmado' | 'rejeitado'
                                updatePaymentDraft(row.user_id, { status: nextStatus })
                                await saveMemberPayment(row.user_id, nextStatus)
                              }}
                              disabled={isSavingPayment}
                              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
                            >
                              <option value="pendente">Pendente</option>
                              <option value="confirmado">Confirmado</option>
                              <option value="rejeitado">Rejeitado</option>
                            </select>
                            {isSavingPayment && <span className="text-[11px] text-gray-400">...</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setMemberAdmin(row.user_id, !row.is_admin)}
                              disabled={isSavingAdmin || (profile?.id === row.user_id && row.is_admin)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${row.is_admin ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} disabled:opacity-50`}
                            >
                              {row.is_admin ? 'Admin' : 'Tornar admin'}
                            </button>
                            {isSavingAdmin && <span className="text-[11px] text-gray-400">...</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      )}

      {/* Rodadas */}
      {activeTab === 'jogos' && (
      <section>
        <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">Rodadas</h2>
        <div className="modern-card p-4 mb-4 grid sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={newRound.name}
            onChange={e => setNewRound(r => ({ ...r, name: e.target.value }))}
            placeholder="Nome (ex: Grupo A – Rodada 1)"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={newRound.phase}
            onChange={e => setNewRound(r => ({ ...r, phase: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {Object.entries(PHASE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button
            onClick={addRound}
            disabled={addingRound}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {addingRound ? '...' : 'Adicionar Rodada'}
          </button>
        </div>
        <div className="modern-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Rodada</th>
                <th className="px-4 py-2 text-left">Fase</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rounds.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-gray-500">{PHASE_LABELS[r.phase] ?? r.phase}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {/* Resultados */}
      {activeTab === 'jogos' && (
      <section>
        <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">Resultados</h2>

        <div className="modern-card p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Rodada</label>
          <select
            value={selectedRoundId}
            onChange={e => setSelectedRoundId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {rounds.length === 0 && <option value="">Sem rodadas</option>}
            {rounds.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} ({PHASE_LABELS[r.phase] ?? r.phase})
              </option>
            ))}
          </select>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por grupo</label>
              <select
                value={groupFilter}
                onChange={e => setGroupFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">Todos os grupos</option>
                {availableGroups.map(code => (
                  <option key={code} value={code}>Grupo {code}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as 'all' | 'pendente' | 'encerrado')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">Todos os status</option>
                <option value="pendente">Pendente</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </div>
          </div>
        </div>

        {loadingMatches ? (
          <p className="text-gray-400 text-center py-8">Carregando jogos...</p>
        ) : matches.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Nenhum jogo encontrado para esta rodada.</p>
        ) : filteredMatches.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Nenhum jogo encontrado para os filtros selecionados.</p>
        ) : (
          <div className="space-y-3">
            {filteredMatches.map(m => (
              <div key={m.id} className="modern-card soft-hover p-4">
                {/** Partida encerrada fica bloqueada ate ser reaberta. */}
                {(() => {
                  const isMatchLocked = m.status === 'encerrado' || Boolean(savingMatch[m.id])
                  return (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                            Grupo {m.group?.code ?? '-'}
                          </span>
                          <p className="text-xs text-gray-400">
                            {new Date(m.kickoff_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                          {m.venue && (
                            <p className="text-xs text-gray-400">
                              {m.venue}
                            </p>
                          )}
                          <p className="text-xs text-gray-400">
                            Fecha: {new Date(m.cutoff_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${m.status === 'encerrado' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-700'}`}>
                          {m.status === 'encerrado' ? 'Encerrado' : 'Pendente'}
                        </span>
                      </div>

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
                          value={resultDrafts[m.id]?.home ?? ''}
                          onChange={e => updateDraft(m.id, 'home', e.target.value)}
                          disabled={isMatchLocked}
                          className="w-12 text-center border border-gray-300 rounded px-1 py-1.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100"
                        />
                        <span className="text-gray-400 font-bold">×</span>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={resultDrafts[m.id]?.away ?? ''}
                          onChange={e => updateDraft(m.id, 'away', e.target.value)}
                          disabled={isMatchLocked}
                          className="w-12 text-center border border-gray-300 rounded px-1 py-1.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100"
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

                      <div className="mt-3 flex items-center justify-center gap-2">
                        <label className="text-xs text-gray-500">Cutoff:</label>
                        <input
                          type="datetime-local"
                          value={resultDrafts[m.id]?.cutoffAt ?? ''}
                          onChange={e => updateCutoffDraft(m.id, e.target.value)}
                          disabled={isMatchLocked}
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100"
                        />
                      </div>

                      <div className="mt-3 flex items-center justify-center gap-2">
                        {m.status === 'encerrado' ? (
                          <button
                            onClick={() => reopenMatch(m.id)}
                            disabled={Boolean(savingMatch[m.id])}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
                          >
                            {savingMatch[m.id] ? 'Reabrindo...' : 'Reabrir Partida'}
                          </button>
                        ) : (
                          <button
                            onClick={() => closeMatch(m.id)}
                            disabled={Boolean(savingMatch[m.id])}
                            className="bg-gray-700 hover:bg-gray-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
                          >
                            {savingMatch[m.id] ? 'Encerrando...' : 'Encerrar Partida (salva e calcula)'}
                          </button>
                        )}

                        <button
                          onClick={() => loadPredictions(m.id)}
                          disabled={Boolean(loadingPredictions[m.id])}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
                        >
                          {loadingPredictions[m.id] ? 'Carregando...' : '🖼️ Ver Snapshot'}
                        </button>
                      </div>

                      {matchMessage[m.id] && (
                        <p className="text-xs text-center mt-2 text-gray-500">{matchMessage[m.id]}</p>
                      )}
                    </>
                  )
                })()}
              </div>
            ))}
          </div>
        )}
      </section>
      )}

    {/* Snapshot Modal */}
    {openSnapshotMatch && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto w-full max-w-lg">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">Snapshot de Palpites</h2>
            <button
              onClick={() => setOpenSnapshotMatch(null)}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="p-6">
            {(() => {
              const match = matches.find(m => m.id === openSnapshotMatch)
              const preds = predictionsByMatch[openSnapshotMatch] ?? []

              if (!match) return <p className="text-gray-500">Jogo não encontrado</p>

              return (
                <>
                  <SnapshotPredictions
                    matchId={match.id}
                    homeTeamName={match.home_team?.name}
                    homeTeamFlagCode={match.home_team?.flag_code}
                    awayTeamName={match.away_team?.name}
                    awayTeamFlagCode={match.away_team?.flag_code}
                    homeScore={match.home_score}
                    awayScore={match.away_score}
                    kickoffAt={match.kickoff_at}
                    venue={match.venue}
                    predictions={preds}
                    isFinished={match.status === 'encerrado'}
                    generatedAt={new Date().toISOString()}
                  />

                  <div className="mt-6 flex flex-col gap-2">
                    <button
                      onClick={() => handleExportImage(openSnapshotMatch)}
                      disabled={exportingImage}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 transition"
                    >
                      {exportingImage ? 'Gerando imagem...' : '📥 Baixar como Imagem PNG'}
                    </button>

                    <button
                      onClick={() => setOpenSnapshotMatch(null)}
                      className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2.5 rounded-lg transition"
                    >
                      Fechar
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      </div>
    )}
  </div>
  )
}
