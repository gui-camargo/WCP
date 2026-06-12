import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import TeamWithFlag from '@/components/TeamWithFlag'
import BackButton from '@/components/BackButton'

interface TeamRow {
  id: string
  name: string
  flag_code: string | null
}

interface MatchRow {
  cutoff_at: string
  home_team: TeamRow | null
  away_team: TeamRow | null
}

interface DraftRow {
  champion_id: string
  vice_id: string
  third_id: string
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function PodiumPredictionsPage() {
  const { poolId } = useParams()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deadline, setDeadline] = useState<string | null>(null)
  const [deadlineSource, setDeadlineSource] = useState<'manual' | 'auto' | 'none'>('none')
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [draft, setDraft] = useState<DraftRow>({ champion_id: '', vice_id: '', third_id: '' })
  const [savedDraft, setSavedDraft] = useState<DraftRow>({ champion_id: '', vice_id: '', third_id: '' })
  const [hasPrediction, setHasPrediction] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveSequenceRef = useRef(0)

  useEffect(() => {
    if (poolId && user) {
      loadData()
    }
  }, [poolId, user])

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

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

  const isOpen = useMemo(() => {
    if (!deadline) return false
    return new Date(deadline).getTime() > Date.now()
  }, [deadline])

  const isValidDraft = useMemo(() => {
    if (!draft.champion_id || !draft.vice_id || !draft.third_id) return false
    return new Set([draft.champion_id, draft.vice_id, draft.third_id]).size === 3
  }, [draft])

  const isDraftSynced = useMemo(() => {
    return (
      isValidDraft &&
      draft.champion_id === savedDraft.champion_id &&
      draft.vice_id === savedDraft.vice_id &&
      draft.third_id === savedDraft.third_id
    )
  }, [draft, savedDraft, isValidDraft])

  async function loadData() {
    if (!poolId || !user) return

    setLoading(true)
    setErrorMsg(null)

    const { data: poolData } = await supabase
      .from('pools')
      .select('group_predictions_cutoff_at, podium_predictions_cutoff_at')
      .eq('id', poolId)
      .single()

    const manualDeadline =
      (poolData as any)?.group_predictions_cutoff_at ??
      (poolData as any)?.podium_predictions_cutoff_at ??
      null

    const { data: roundData } = await supabase
      .from('rounds')
      .select('id')
      .eq('pool_id', poolId)

    const roundIds = ((roundData ?? []) as Array<{ id: string }>).map(r => r.id)

    let matchesData: MatchRow[] = []
    if (roundIds.length > 0) {
      const { data } = await supabase
        .from('matches')
        .select(`
          cutoff_at,
          home_team:teams!matches_home_team_id_fkey(id, name, flag_code),
          away_team:teams!matches_away_team_id_fkey(id, name, flag_code)
        `)
        .in('round_id', roundIds)

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

    const teamsMap = new Map<string, TeamRow>()
    for (const match of matchesData) {
      if (match.home_team) teamsMap.set(match.home_team.id, match.home_team)
      if (match.away_team) teamsMap.set(match.away_team.id, match.away_team)
    }
    const nextTeams = Array.from(teamsMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    setTeams(nextTeams)

    const { data: predictionData } = await supabase
      .from('podium_predictions')
      .select('champion_id, vice_id, third_id')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .maybeSingle()

    const nextDraft: DraftRow = {
      champion_id: (predictionData as any)?.champion_id ?? '',
      vice_id: (predictionData as any)?.vice_id ?? '',
      third_id: (predictionData as any)?.third_id ?? '',
    }

    setDraft(nextDraft)
    setSavedDraft(nextDraft)
    setHasPrediction(Boolean(predictionData))
    setLoading(false)
  }

  function setDraftField(field: keyof DraftRow, value: string) {
    const nextDraft: DraftRow = {
      champion_id: field === 'champion_id' ? value : draft.champion_id,
      vice_id: field === 'vice_id' ? value : draft.vice_id,
      third_id: field === 'third_id' ? value : draft.third_id,
    }

    setDraft(nextDraft)
    setErrorMsg(null)
    scheduleAutoSave(nextDraft)
  }

  function openSlotDropdown(field: keyof DraftRow, e: ReactMouseEvent<HTMLButtonElement>) {
    const key = `podium-${field}`
    if (openDropdown === key) {
      setOpenDropdown(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width })
    setOpenDropdown(key)
  }

  function isTeamBlocked(field: keyof DraftRow, teamId: string) {
    if (field === 'champion_id') return teamId === draft.vice_id || teamId === draft.third_id
    if (field === 'vice_id') return teamId === draft.champion_id || teamId === draft.third_id
    return teamId === draft.champion_id || teamId === draft.vice_id
  }

  function scheduleAutoSave(nextDraft: DraftRow) {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    if (!isOpen || !deadline) return
    if (!nextDraft.champion_id || !nextDraft.vice_id || !nextDraft.third_id) return
    if (new Set([nextDraft.champion_id, nextDraft.vice_id, nextDraft.third_id]).size !== 3) return

    const hasChanged =
      savedDraft.champion_id !== nextDraft.champion_id ||
      savedDraft.vice_id !== nextDraft.vice_id ||
      savedDraft.third_id !== nextDraft.third_id

    if (!hasChanged) return

    const nextSequence = saveSequenceRef.current + 1
    saveSequenceRef.current = nextSequence

    autoSaveTimerRef.current = setTimeout(() => {
      void savePrediction(nextDraft, nextSequence)
    }, 700)
  }

  async function savePrediction(nextDraft: DraftRow, sequence: number) {
    if (!poolId || !user) return

    setSaving(true)
    setErrorMsg(null)

    const shouldUpdate = hasPrediction
    let saveError: any = null

    if (shouldUpdate) {
      const { error } = await (supabase.from('podium_predictions') as any)
        .update({
          champion_id: nextDraft.champion_id,
          vice_id: nextDraft.vice_id,
          third_id: nextDraft.third_id,
        })
        .eq('pool_id', poolId)
        .eq('user_id', user.id)

      saveError = error
    } else {
      const { error } = await (supabase.from('podium_predictions') as any)
        .insert({
          pool_id: poolId,
          user_id: user.id,
          champion_id: nextDraft.champion_id,
          vice_id: nextDraft.vice_id,
          third_id: nextDraft.third_id,
        })

      saveError = error
      if (!saveError) {
        setHasPrediction(true)
      }
    }

    if (saveSequenceRef.current !== sequence) {
      return
    }

    if (saveError) {
      setErrorMsg('Nao conseguimos salvar seu palpite. Tente novamente.')
    } else {
      setSavedDraft(nextDraft)
    }

    setSaving(false)
  }

  const championTeam = teams.find(team => team.id === draft.champion_id)
  const viceTeam = teams.find(team => team.id === draft.vice_id)
  const thirdTeam = teams.find(team => team.id === draft.third_id)

  const cardStateClass = !deadline || !isOpen
    ? 'border border-gray-200 bg-gray-50/80 opacity-75'
    : errorMsg
      ? 'border border-red-200 bg-red-50/40'
      : isDraftSynced
        ? 'border border-emerald-300 bg-white shadow-[0_0_0_1px_rgba(16,185,129,0.10)]'
        : 'border border-slate-200 bg-white'

  return (
    <div className="space-y-4">
      <div>
        <BackButton to={poolId ? `/bolao/${poolId}/palpites` : '/dashboard'} label="Meus Palpites" />
      </div>

      <section className="relative px-0.5 py-0.5">
        <div className="border-b border-slate-200 pb-1.5">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-sm">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 21h8" />
                <path d="M12 17v4" />
                <path d="M7 4h10v3a5 5 0 0 1-10 0z" />
                <path d="M7 6H4a2 2 0 0 0 2 4h1" />
                <path d="M17 6h3a2 2 0 0 1-2 4h-1" />
              </svg>
            </span>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800 leading-tight">Colocados Finais</h1>
          </div>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-600">Defina seus colocados finais com destaque para Campeão, Vice-campeão e 3º lugar.</p>
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
        <p className="text-gray-400 text-center py-10">Carregando opcoes...</p>
      ) : teams.length === 0 ? (
        <div className="modern-card text-center py-10 text-gray-500">
          Nenhum time disponivel para palpitar nesta etapa.
        </div>
      ) : (
        <section className={`modern-card no-theme-tint soft-hover p-4 sm:p-5 relative ${cardStateClass}`}>
          {isDraftSynced && !saving && (
            <span
              aria-label="Palpite salvo"
              title="Palpite salvo"
              className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200"
            >
              ✓
            </span>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-100 p-3 shadow-sm">
              <label className="block text-xs font-black text-amber-800 uppercase tracking-wide mb-1">🏆 Campeão</label>
              <button
                type="button"
                disabled={!isOpen || !deadline || saving}
                onClick={(e) => openSlotDropdown('champion_id', e)}
                data-dropdown-trigger
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 text-left flex items-center justify-between gap-2 disabled:pointer-events-none disabled:opacity-70"
              >
                {championTeam ? (
                  <TeamWithFlag name={championTeam.name} flagCode={championTeam.flag_code} size="sm" compact />
                ) : (
                  <span className="text-gray-500">Selecione...</span>
                )}
                <span className="text-gray-400 text-xs">▾</span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 p-3 shadow-sm">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wide mb-1">🥈 Vice-campeão</label>
              <button
                type="button"
                disabled={!isOpen || !deadline || saving}
                onClick={(e) => openSlotDropdown('vice_id', e)}
                data-dropdown-trigger
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 text-left flex items-center justify-between gap-2 disabled:pointer-events-none disabled:opacity-70"
              >
                {viceTeam ? (
                  <TeamWithFlag name={viceTeam.name} flagCode={viceTeam.flag_code} size="sm" compact />
                ) : (
                  <span className="text-gray-500">Selecione...</span>
                )}
                <span className="text-gray-400 text-xs">▾</span>
              </button>
            </div>

            <div className="rounded-xl border border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-3 shadow-sm">
              <label className="block text-xs font-extrabold text-orange-700 uppercase tracking-wide mb-1">🥉 3º lugar</label>
              <button
                type="button"
                disabled={!isOpen || !deadline || saving}
                onClick={(e) => openSlotDropdown('third_id', e)}
                data-dropdown-trigger
                className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 text-left flex items-center justify-between gap-2 disabled:pointer-events-none disabled:opacity-70"
              >
                {thirdTeam ? (
                  <TeamWithFlag name={thirdTeam.name} flagCode={thirdTeam.flag_code} size="sm" compact />
                ) : (
                  <span className="text-gray-500">Selecione...</span>
                )}
                <span className="text-gray-400 text-xs">▾</span>
              </button>
            </div>
          </div>

          {openDropdown === 'podium-champion_id' && dropdownPos && createPortal(
            <div
              data-dropdown-portal
              style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
              className="max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-xl p-1 space-y-1"
            >
              {teams.map(team => {
                const isSelected = team.id === draft.champion_id
                const isBlocked = isTeamBlocked('champion_id', team.id)
                return (
                  <button
                    key={team.id}
                    type="button"
                    disabled={isBlocked}
                    onClick={() => { setDraftField('champion_id', team.id); setOpenDropdown(null) }}
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

          {openDropdown === 'podium-vice_id' && dropdownPos && createPortal(
            <div
              data-dropdown-portal
              style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
              className="max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-xl p-1 space-y-1"
            >
              {teams.map(team => {
                const isSelected = team.id === draft.vice_id
                const isBlocked = isTeamBlocked('vice_id', team.id)
                return (
                  <button
                    key={team.id}
                    type="button"
                    disabled={isBlocked}
                    onClick={() => { setDraftField('vice_id', team.id); setOpenDropdown(null) }}
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

          {openDropdown === 'podium-third_id' && dropdownPos && createPortal(
            <div
              data-dropdown-portal
              style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
              className="max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-xl p-1 space-y-1"
            >
              {teams.map(team => {
                const isSelected = team.id === draft.third_id
                const isBlocked = isTeamBlocked('third_id', team.id)
                return (
                  <button
                    key={team.id}
                    type="button"
                    disabled={isBlocked}
                    onClick={() => { setDraftField('third_id', team.id); setOpenDropdown(null) }}
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

          <p className={`text-[11px] text-center font-semibold mt-3 ${
            errorMsg
              ? 'text-red-600'
              : !deadline
                ? 'text-amber-600'
                : !isOpen
                  ? 'text-gray-500'
                  : saving
                    ? 'text-indigo-600'
                    : isDraftSynced
                      ? 'text-emerald-600'
                      : !isValidDraft
                        ? 'text-red-600'
                        : 'text-slate-500'
          }`}>
            {errorMsg
              ? errorMsg
              : !deadline
                ? 'Aguardando definicao de prazo para colocados finais.'
                : !isOpen
                  ? 'Prazo encerrado para este palpite.'
                  : saving
                    ? 'Salvando automaticamente...'
                    : isDraftSynced
                      ? 'Palpite salvo com sucesso.'
                      : !isValidDraft
                        ? 'Campeão, vice-campeão e 3º lugar devem ser times diferentes.'
                        : 'Selecione os tres colocados para salvar automaticamente.'}
          </p>
        </section>
      )}
    </div>
  )
}
