import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import TeamWithFlag from '@/components/TeamWithFlag'
import BackButton from '@/components/BackButton'

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
  const [errorByGroup, setErrorByGroup] = useState<Record<string, string>>({})
  const [deadline, setDeadline] = useState<string | null>(null)
  const [deadlineSource, setDeadlineSource] = useState<'manual' | 'auto' | 'none'>('none')
  const [groupSections, setGroupSections] = useState<GroupSection[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({})
  const [savedByGroup, setSavedByGroup] = useState<Record<string, DraftRow>>({})
  const [hasPredictionByGroup, setHasPredictionByGroup] = useState<Record<string, boolean>>({})
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const autoSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const saveSequenceRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!openDropdown) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-dropdown-portal]') && !target.closest('[data-dropdown-trigger]')) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openDropdown])

  useEffect(() => {
    if (poolId && user) {
      setOpenDropdown(null)
      loadData()
    }
  }, [poolId, user])

  useEffect(() => {
    return () => {
      Object.values(autoSaveTimersRef.current).forEach(timer => clearTimeout(timer))
    }
  }, [])

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
    setErrorByGroup({})

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
    const nextSaved: Record<string, DraftRow> = {}
    const nextHasPrediction: Record<string, boolean> = {}
    for (const section of nextSections) {
      const row = existing.get(section.group.id)
      nextDrafts[section.group.id] = {
        first_id: row?.first_id ?? '',
        second_id: row?.second_id ?? '',
      }
      nextSaved[section.group.id] = {
        first_id: row?.first_id ?? '',
        second_id: row?.second_id ?? '',
      }
      nextHasPrediction[section.group.id] = Boolean(row)
    }
    setDrafts(nextDrafts)
    setSavedByGroup(nextSaved)
    setHasPredictionByGroup(nextHasPrediction)
    setLoading(false)
  }

  function setDraft(groupId: string, field: 'first_id' | 'second_id', value: string) {
    const currentDraft = drafts[groupId] ?? { first_id: '', second_id: '' }
    const nextDraft: DraftRow = {
      first_id: field === 'first_id' ? value : currentDraft.first_id,
      second_id: field === 'second_id' ? value : currentDraft.second_id,
    }

    setDrafts(prev => ({
      ...prev,
      [groupId]: nextDraft,
    }))

    setErrorByGroup(prev => ({ ...prev, [groupId]: '' }))
    scheduleAutoSave(groupId, nextDraft)
  }

  async function saveGroupPrediction(groupId: string, draft: DraftRow, sequence: number) {
    if (!poolId || !user) return

    setSavingByGroup(prev => ({ ...prev, [groupId]: true }))
    setErrorByGroup(prev => ({ ...prev, [groupId]: '' }))

    const shouldUpdate = Boolean(hasPredictionByGroup[groupId])

    let saveError: any = null
    if (shouldUpdate) {
      const { error } = await (supabase.from('group_predictions') as any)
        .update({
          first_id: draft.first_id,
          second_id: draft.second_id,
        })
        .eq('pool_id', poolId)
        .eq('user_id', user.id)
        .eq('group_id', groupId)
      saveError = error
    } else {
      const { error } = await (supabase.from('group_predictions') as any)
        .insert({
          pool_id: poolId,
          user_id: user.id,
          group_id: groupId,
          first_id: draft.first_id,
          second_id: draft.second_id,
        })
      saveError = error

      if (!saveError) {
        setHasPredictionByGroup(prev => ({ ...prev, [groupId]: true }))
      }
    }

    if (saveSequenceRef.current[groupId] !== sequence) {
      return
    }

    if (saveError) {
      setErrorByGroup(prev => ({ ...prev, [groupId]: 'Nao conseguimos salvar seu palpite. Tente novamente.' }))
    } else {
      setSavedByGroup(prev => ({ ...prev, [groupId]: draft }))
    }

    setSavingByGroup(prev => ({ ...prev, [groupId]: false }))
  }

  function scheduleAutoSave(groupId: string, draft: DraftRow) {
    const existingTimer = autoSaveTimersRef.current[groupId]
    if (existingTimer) clearTimeout(existingTimer)

    if (!isOpen || !deadline) return
    if (!draft.first_id || !draft.second_id) return
    if (draft.first_id === draft.second_id) return

    const saved = savedByGroup[groupId] ?? { first_id: '', second_id: '' }
    const hasChanged = saved.first_id !== draft.first_id || saved.second_id !== draft.second_id
    if (!hasChanged) return

    const nextSequence = (saveSequenceRef.current[groupId] ?? 0) + 1
    saveSequenceRef.current[groupId] = nextSequence

    autoSaveTimersRef.current[groupId] = setTimeout(() => {
      void saveGroupPrediction(groupId, draft, nextSequence)
    }, 700)
  }

  return (
    <div className="space-y-4">
      <div>
        <BackButton to={poolId ? `/bolao/${poolId}/palpites` : '/dashboard'} label="Meus Palpites" />
      </div>

      <section className="relative px-0.5 py-0.5">
        <div className="border-b border-slate-200 pb-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </span>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800 leading-tight">Classificação de Grupos</h1>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-base font-black text-slate-800 leading-none">{completedGroupsCount}<span className="text-xs font-semibold text-slate-400"> / {groupSections.length}</span></span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Grupos</span>
            </div>
          </div>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-600">Salvamento automático ao selecionar 1º e 2º colocados</p>
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
              ({deadlineSource === 'manual' ? 'prazo definido pela administracao do bolao' : 'prazo calculado automaticamente pela primeira partida da fase de grupos'})
            </span>
          </div>
        ) : (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            O prazo para esta etapa ainda nao esta disponivel. Tente novamente em instantes.
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
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {groupSections.map(section => {
            const draft = drafts[section.group.id] ?? { first_id: '', second_id: '' }
            const saved = savedByGroup[section.group.id] ?? { first_id: '', second_id: '' }
            const isSaving = Boolean(savingByGroup[section.group.id])
            const hasError = Boolean(errorByGroup[section.group.id])
            const hasValidDraft = Boolean(draft.first_id && draft.second_id && draft.first_id !== draft.second_id)
            const isDraftSynced =
              hasValidDraft &&
              saved.first_id === draft.first_id &&
              saved.second_id === draft.second_id

            const cardStateClass = !deadline || !isOpen
              ? 'border border-gray-200 bg-gray-50/80 opacity-75'
              : hasError
                ? 'border border-red-200 bg-red-50/40'
                : isDraftSynced
                  ? 'border border-emerald-300 bg-white shadow-[0_0_0_1px_rgba(16,185,129,0.10)]'
                  : 'border border-slate-200 bg-white'

            const firstTeam = section.teams.find(t => t.id === draft.first_id)
            const secondTeam = section.teams.find(t => t.id === draft.second_id)

            return (
              <div key={section.group.id} className={`modern-card no-theme-tint soft-hover p-4 sm:p-5 relative ${cardStateClass}`}>
                {isDraftSynced && !isSaving && (
                  <span
                    aria-label="Palpite salvo"
                    title="Palpite salvo"
                    className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200"
                  >
                    ✓
                  </span>
                )}

                <div className="mb-3 flex items-center justify-center">
                  <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5">
                    Grupo {section.group.code}
                  </span>
                </div>

                  <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">1º colocado</label>
                    <button
                      type="button"
                      disabled={!isOpen || !deadline || isSaving}
                      onClick={(e) => {
                        const key = `${section.group.id}-first`
                        if (openDropdown === key) { setOpenDropdown(null); return }
                        const rect = e.currentTarget.getBoundingClientRect()
                        setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width })
                        setOpenDropdown(key)
                      }}
                      data-dropdown-trigger
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 text-left flex items-center justify-between gap-2 disabled:pointer-events-none disabled:opacity-70"
                    >
                      {firstTeam ? (
                        <TeamWithFlag name={firstTeam.name} flagCode={firstTeam.flag_code} size="sm" compact />
                      ) : (
                        <span className="text-gray-500">Selecione...</span>
                      )}
                      <span className="text-gray-400 text-xs">▾</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">2º colocado</label>
                    <button
                      type="button"
                      disabled={!isOpen || !deadline || isSaving}
                      onClick={(e) => {
                        const key = `${section.group.id}-second`
                        if (openDropdown === key) { setOpenDropdown(null); return }
                        const rect = e.currentTarget.getBoundingClientRect()
                        setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width })
                        setOpenDropdown(key)
                      }}
                      data-dropdown-trigger
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 text-left flex items-center justify-between gap-2 disabled:pointer-events-none disabled:opacity-70"
                    >
                      {secondTeam ? (
                        <TeamWithFlag name={secondTeam.name} flagCode={secondTeam.flag_code} size="sm" compact />
                      ) : (
                        <span className="text-gray-500">Selecione...</span>
                      )}
                      <span className="text-gray-400 text-xs">▾</span>
                    </button>
                  </div>

                  {/* Portal dropdown para 1º colocado */}
                  {openDropdown === `${section.group.id}-first` && dropdownPos && createPortal(
                    <div
                      data-dropdown-portal
                      style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
                      className="max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-xl p-1 space-y-1"
                    >
                      {section.teams.map(team => {
                        const isSelected = team.id === draft.first_id
                        const isBlocked = team.id === draft.second_id
                        return (
                          <button
                            key={team.id}
                            type="button"
                            disabled={isBlocked}
                            onClick={() => { setDraft(section.group.id, 'first_id', team.id); setOpenDropdown(null) }}
                            className={`w-full text-left rounded-md px-2 py-1.5 text-sm transition ${isBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : isSelected ? 'bg-brand-50 border border-brand-200' : 'hover:bg-slate-50 border border-transparent'}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <TeamWithFlag name={team.name} flagCode={team.flag_code} size="sm" compact />
                              {isSelected && <span className="text-[10px] font-semibold text-brand-700">Selecionado</span>}
                            </div>
                          </button>
                        )
                      })}
                    </div>,
                    document.body
                  )}

                  {/* Portal dropdown para 2º colocado */}
                  {openDropdown === `${section.group.id}-second` && dropdownPos && createPortal(
                    <div
                      data-dropdown-portal
                      style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
                      className="max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-xl p-1 space-y-1"
                    >
                      {section.teams.map(team => {
                        const isSelected = team.id === draft.second_id
                        const isBlocked = team.id === draft.first_id
                        return (
                          <button
                            key={team.id}
                            type="button"
                            disabled={isBlocked}
                            onClick={() => { setDraft(section.group.id, 'second_id', team.id); setOpenDropdown(null) }}
                            className={`w-full text-left rounded-md px-2 py-1.5 text-sm transition ${isBlocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : isSelected ? 'bg-brand-50 border border-brand-200' : 'hover:bg-slate-50 border border-transparent'}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <TeamWithFlag name={team.name} flagCode={team.flag_code} size="sm" compact />
                              {isSelected && <span className="text-[10px] font-semibold text-brand-700">Selecionado</span>}
                            </div>
                          </button>
                        )
                      })}
                    </div>,
                    document.body
                  )}

                  <p className={`text-[11px] text-center font-semibold ${
                    hasError
                      ? 'text-red-600'
                      : !deadline
                        ? 'text-amber-600'
                        : !isOpen
                          ? 'text-gray-500'
                          : isSaving
                            ? 'text-indigo-600'
                            : isDraftSynced
                              ? 'text-emerald-600'
                              : draft.first_id && draft.second_id && draft.first_id === draft.second_id
                                ? 'text-red-600'
                                : 'text-slate-500'
                  }`}>
                    {hasError
                      ? errorByGroup[section.group.id]
                      : !deadline
                        ? 'Aguardando definicao de prazo para classificacao de grupos.'
                        : !isOpen
                          ? 'Prazo encerrado para este palpite.'
                          : isSaving
                            ? 'Salvando automaticamente...'
                            : isDraftSynced
                              ? null
                              : draft.first_id && draft.second_id && draft.first_id === draft.second_id
                                ? '1º e 2º colocados nao podem ser iguais.'
                                : 'Selecione 1º e 2º colocados para salvar automaticamente.'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <section className="modern-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            Dica: ao escolher os dois colocados, o sistema salva automaticamente em poucos segundos.
          </p>
          <Link
            to={poolId ? `/bolao/${poolId}` : '/dashboard'}
            className="inline-flex items-center px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition"
          >
            Voltar ao Bolao
          </Link>
        </div>
      </section>
    </div>
  )
}
