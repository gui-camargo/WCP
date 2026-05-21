import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import TeamWithFlag from '@/components/TeamWithFlag'

interface GroupRow {
  id: string
  code: string
}

interface TeamRow {
  id: string
  name: string
  flag_code: string | null
}

interface MatchRow {
  group_id: string | null
  cutoff_at: string
  group: GroupRow | null
  home_team: TeamRow | null
  away_team: TeamRow | null
}

interface GroupSection {
  group: GroupRow
  teams: TeamRow[]
}

interface DraftRow {
  first_id: string
  second_id: string
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function GroupPredictionsPage() {
  const { poolId } = useParams()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [savingByGroup, setSavingByGroup] = useState<Record<string, boolean>>({})
  const [messageByGroup, setMessageByGroup] = useState<Record<string, string>>({})
  const [deadline, setDeadline] = useState<string | null>(null)
  const [deadlineSource, setDeadlineSource] = useState<'manual' | 'auto' | 'none'>('none')
  const [groupSections, setGroupSections] = useState<GroupSection[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({})

  useEffect(() => {
    if (poolId && user) {
      loadData()
    }
  }, [poolId, user])

  const isOpen = useMemo(() => {
    if (!deadline) return false
    return new Date(deadline).getTime() > Date.now()
  }, [deadline])

  const completedGroupsCount = useMemo(() => {
    return groupSections.filter(section => {
      const draft = drafts[section.group.id]
      return Boolean(draft?.first_id && draft?.second_id)
    }).length
  }, [drafts, groupSections])

  async function loadData() {
    if (!poolId || !user) return

    setLoading(true)
    setMessageByGroup({})

    const { data: poolData } = await supabase
      .from('pools')
      .select('group_predictions_cutoff_at')
      .eq('id', poolId)
      .single()

    const manualDeadline = (poolData as any)?.group_predictions_cutoff_at ?? null

    const { data: roundData } = await supabase
      .from('rounds')
      .select('id')
      .eq('pool_id', poolId)
      .eq('phase', 'grupos')

    const roundIds = ((roundData ?? []) as Array<{ id: string }>).map(r => r.id)

    let matchesData: MatchRow[] = []
    if (roundIds.length > 0) {
      const { data } = await supabase
        .from('matches')
        .select(`
          group_id,
          cutoff_at,
          group:groups(id, code),
          home_team:teams!matches_home_team_id_fkey(id, name, flag_code),
          away_team:teams!matches_away_team_id_fkey(id, name, flag_code)
        `)
        .in('round_id', roundIds)
        .not('group_id', 'is', null)

      matchesData = (data ?? []) as unknown as MatchRow[]
    }

    const autoDeadline = matchesData
      .map(m => m.cutoff_at)
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null

    if (manualDeadline) {
      setDeadline(manualDeadline)
      setDeadlineSource('manual')
    } else if (autoDeadline) {
      setDeadline(autoDeadline)
      setDeadlineSource('auto')
    } else {
      setDeadline(null)
      setDeadlineSource('none')
    }

    const groupsMap = new Map<string, GroupSection>()
    for (const match of matchesData) {
      if (!match.group_id || !match.group) continue

      const current = groupsMap.get(match.group_id) ?? {
        group: { id: match.group.id, code: match.group.code },
        teams: [],
      }

      if (match.home_team && !current.teams.some(t => t.id === match.home_team!.id)) {
        current.teams.push(match.home_team)
      }
      if (match.away_team && !current.teams.some(t => t.id === match.away_team!.id)) {
        current.teams.push(match.away_team)
      }

      groupsMap.set(match.group_id, current)
    }

    const nextSections = Array.from(groupsMap.values()).sort((a, b) => a.group.code.localeCompare(b.group.code))
    setGroupSections(nextSections)

    const { data: gpData } = await supabase
      .from('group_predictions')
      .select('group_id, first_id, second_id')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)

    const existing = new Map((gpData ?? []).map((row: any) => [row.group_id, row]))

    const nextDrafts: Record<string, DraftRow> = {}
    for (const section of nextSections) {
      const row = existing.get(section.group.id)
      nextDrafts[section.group.id] = {
        first_id: row?.first_id ?? '',
        second_id: row?.second_id ?? '',
      }
    }
    setDrafts(nextDrafts)
    setLoading(false)
  }

  function setDraft(groupId: string, field: 'first_id' | 'second_id', value: string) {
    setDrafts(prev => ({
      ...prev,
      [groupId]: {
        first_id: field === 'first_id' ? value : (prev[groupId]?.first_id ?? ''),
        second_id: field === 'second_id' ? value : (prev[groupId]?.second_id ?? ''),
      },
    }))
  }

  async function saveGroupPrediction(groupId: string) {
    if (!poolId || !user) return

    const draft = drafts[groupId]
    if (!draft?.first_id || !draft?.second_id) {
      setMessageByGroup(prev => ({ ...prev, [groupId]: 'Selecione 1o e 2o colocados.' }))
      return
    }

    if (draft.first_id === draft.second_id) {
      setMessageByGroup(prev => ({ ...prev, [groupId]: '1o e 2o colocados nao podem ser iguais.' }))
      return
    }

    if (!isOpen) {
      setMessageByGroup(prev => ({ ...prev, [groupId]: 'Prazo encerrado para este palpite.' }))
      return
    }

    setSavingByGroup(prev => ({ ...prev, [groupId]: true }))
    setMessageByGroup(prev => ({ ...prev, [groupId]: '' }))

    const { error } = await (supabase.from('group_predictions') as any)
      .upsert(
        {
          pool_id: poolId,
          user_id: user.id,
          group_id: groupId,
          first_id: draft.first_id,
          second_id: draft.second_id,
        },
        { onConflict: 'pool_id,user_id,group_id' }
      )

    if (error) {
      setMessageByGroup(prev => ({ ...prev, [groupId]: 'Erro ao salvar palpite do grupo.' }))
    } else {
      setMessageByGroup(prev => ({ ...prev, [groupId]: 'Palpite salvo com sucesso.' }))
    }

    setSavingByGroup(prev => ({ ...prev, [groupId]: false }))
  }

  return (
    <div className="space-y-6">
      <section className="modern-card soft-hover fade-rise relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-sky-200/40 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-emerald-200/40 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-800">Classificação de Grupos</h1>
            <div className="mt-4 inline-flex items-center rounded-xl border border-white/20 bg-white/70 p-1 gap-1">
              <Link
                to={poolId ? `/bolao/${poolId}/palpites` : '/dashboard'}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-700 hover:bg-white transition"
              >
                Navegação de Palpites
              </Link>
              <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-brand-600 text-white">Classificação de Grupos</span>
            </div>
            <p className="text-sm text-gray-600 mt-3">Escolha o 1o e 2o colocados de cada grupo para pontuacao extra.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="modern-chip">{groupSections.length} grupos</span>
              <span className="modern-chip">{completedGroupsCount} grupos preenchidos</span>
              <span className="modern-chip">{Math.max(groupSections.length - completedGroupsCount, 0)} grupos pendentes</span>
            </div>
          </div>

          <Link
            to={poolId ? `/bolao/${poolId}` : '/dashboard'}
            className="inline-flex items-center px-3 py-2 rounded-xl bg-white/90 border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-white transition"
          >
            Voltar ao Bolao
          </Link>
        </div>
      </section>

      <section className="modern-card p-4 sm:p-5">
        {deadline ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`px-2 py-1 rounded-full font-semibold ${isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
              {isOpen ? 'Prazo aberto' : 'Prazo encerrado'}
            </span>
            <span className="text-gray-600">Fecha em: {formatDateTime(deadline)}</span>
            <span className="text-gray-500 text-xs">
              ({deadlineSource === 'manual' ? 'prazo proprio configurado pelo admin' : 'prazo automatico pela 1a partida da fase de grupos'})
            </span>
          </div>
        ) : (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Prazo ainda nao configurado. O admin deve definir um prazo proprio ou cadastrar jogos da fase de grupos com cutoff.
          </p>
        )}
      </section>

      {loading ? (
        <p className="text-gray-400 text-center py-10">Carregando grupos...</p>
      ) : groupSections.length === 0 ? (
        <div className="modern-card text-center py-10 text-gray-500">
          Nenhum grupo com times encontrado para este bolao.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupSections.map(section => {
            const draft = drafts[section.group.id] ?? { first_id: '', second_id: '' }
            return (
              <div key={section.group.id} className="modern-card soft-hover p-4">
                <h2 className="text-lg font-bold text-gray-800 mb-3">Grupo {section.group.code}</h2>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">1o colocado</label>
                    <select
                      value={draft.first_id}
                      onChange={e => setDraft(section.group.id, 'first_id', e.target.value)}
                      disabled={!isOpen || !deadline}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100"
                    >
                      <option value="">Selecione...</option>
                      {section.teams.map(team => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">2o colocado</label>
                    <select
                      value={draft.second_id}
                      onChange={e => setDraft(section.group.id, 'second_id', e.target.value)}
                      disabled={!isOpen || !deadline}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100"
                    >
                      <option value="">Selecione...</option>
                      {section.teams.map(team => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => saveGroupPrediction(section.group.id)}
                    disabled={!isOpen || !deadline || Boolean(savingByGroup[section.group.id])}
                    className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    {savingByGroup[section.group.id] ? 'Salvando...' : 'Salvar Palpite'}
                  </button>

                  {messageByGroup[section.group.id] && (
                    <p className="text-xs text-gray-500">{messageByGroup[section.group.id]}</p>
                  )}

                  {(draft.first_id || draft.second_id) && (
                    <div className="pt-2 border-t border-gray-100 space-y-1">
                      {draft.first_id && (
                        <div className="text-xs text-gray-600 flex items-center gap-2">
                          <span className="font-semibold">1o:</span>
                          <TeamWithFlag
                            name={section.teams.find(t => t.id === draft.first_id)?.name ?? 'Time'}
                            flagCode={section.teams.find(t => t.id === draft.first_id)?.flag_code ?? null}
                            size="sm"
                            compact
                          />
                        </div>
                      )}
                      {draft.second_id && (
                        <div className="text-xs text-gray-600 flex items-center gap-2">
                          <span className="font-semibold">2o:</span>
                          <TeamWithFlag
                            name={section.teams.find(t => t.id === draft.second_id)?.name ?? 'Time'}
                            flagCode={section.teams.find(t => t.id === draft.second_id)?.flag_code ?? null}
                            size="sm"
                            compact
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
