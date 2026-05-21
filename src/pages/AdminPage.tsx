import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import TeamWithFlag from '@/components/TeamWithFlag'

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

  const availableGroups = Array.from(
    new Set(matches.map(m => m.group?.code).filter((code): code is string => Boolean(code)))
  ).sort((a, b) => a.localeCompare(b))

  const filteredMatches = matches.filter(m => {
    const groupOk = groupFilter === 'all' || m.group?.code === groupFilter
    const statusOk = statusFilter === 'all' || m.status === statusFilter
    return groupOk && statusOk
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
        .select('id, name, email')
        .in('id', userIds)

      const byId = new Map((profilesData ?? []).map((p: any) => [p.id, p]))
      const merged: Member[] = userIds.map((id: string) => {
        const p = byId.get(id)
        return {
          user_id: id,
          name: p?.name ?? '(sem nome)',
          email: p?.email ?? '(sem email)',
        }
      })
      setMembers(merged)
    } else {
      setMembers([])
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
  }

  async function setAsGlobalDefault() {
    if (!poolId || updatingDefault) return

    setUpdatingDefault(true)
    setDefaultMessage('')

    const { error } = await (supabase as any).rpc('set_global_default_pool', { p_pool_id: poolId })
    if (error) {
      setDefaultMessage('Erro ao definir bolão padrão global.')
      setUpdatingDefault(false)
      return
    }

    setIsGlobalDefault(true)
    setDefaultMessage('Bolão definido como padrão global.')
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
      setGroupPredictionsCutoffMessage('Erro ao salvar prazo da classificacao.')
    } else {
      setGroupPredictionsCutoffMessage(
        nextValue
          ? 'Prazo proprio da classificacao salvo com sucesso.'
          : 'Prazo proprio removido. O sistema vai usar o prazo automatico.'
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
      setAddMemberMsg(error.code === '23505' ? 'Participante já adicionado.' : 'Erro ao adicionar.')
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
      setMatchMessage(prev => ({ ...prev, [matchId]: 'Erro ao encerrar partida.' }))
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
      setMatchMessage(prev => ({ ...prev, [matchId]: 'Erro ao reabrir partida.' }))
    } else {
      setMatchMessage(prev => ({ ...prev, [matchId]: 'Partida reaberta. Pontos do jogo zerados.' }))
      if (selectedRoundId) loadMatches(selectedRoundId)
    }

    setSavingMatch(prev => ({ ...prev, [matchId]: false }))
  }

  if (!profile?.is_admin) {
    return <div className="text-center py-20 text-gray-400">Acesso restrito a administradores.</div>
  }

  return (
    <div className="space-y-8">
      <div className="modern-card soft-hover fade-rise relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -top-10 -right-12 h-28 w-28 rounded-full bg-sky-200/40 blur-2xl" />
        <div className="absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-emerald-200/40 blur-2xl" />

        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-800">Administração do Bolão</h1>
          <p className="text-sm mt-2 text-gray-600">{members.length} participantes • {rounds.length} rodadas</p>
          <p className="text-sm mt-1 text-gray-600">Gestão de participantes, rodadas, resultados e cutoff por partida.</p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">Configuração Global</h2>
        <div className="modern-card p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Bolão padrão para novos usuários</p>
              <p className="text-sm text-gray-500">
                {isGlobalDefault
                  ? 'Este bolão já está marcado como padrão global.'
                  : 'Defina este bolão como padrão geral de entrada.'}
              </p>
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
            <p className="text-sm text-gray-500 mt-0.5">
              Define o fechamento de 1º/2º colocados por grupo. Se vazio, usa automaticamente o cutoff da primeira partida da fase de grupos.
            </p>

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

      {/* Membros */}
      <section>
        <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">Participantes</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email do participante"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={addMember}
            disabled={addingMember}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            Adicionar
          </button>
        </div>
        {addMemberMsg && <p className="text-sm mb-3 text-gray-600">{addMemberMsg}</p>}
        <div className="modern-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map(m => (
                <tr key={m.user_id}>
                  <td className="px-4 py-2">{m.name}</td>
                  <td className="px-4 py-2 text-gray-400">{m.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Rodadas */}
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

      {/* Resultados */}
      <section>
        <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">Resultados e Encerramento</h2>

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
    </div>
  )
}
