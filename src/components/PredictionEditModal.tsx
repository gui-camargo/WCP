import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import TeamWithFlag from '@/components/TeamWithFlag';

interface MatchRef {
  id: string;
  kickoff_at: string;
  venue: string;
  cutoff_at: string;
  group_code: string | null;
  group_id: string | null;
  status: 'pendente' | 'ao_vivo' | 'encerrado';
  home_score: number | null;
  away_score: number | null;
  home_team: { name: string; flag_code: string | null } | null;
  away_team: { name: string; flag_code: string | null } | null;
  home_win_pct: number | null;
  draw_pct: number | null;
  away_win_pct: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
}

interface GroupStandingTeam {
  team_name: string;
  flag_code: string | null;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  points: number;
}

interface RecentMatch {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  home_team: { name: string; flag_code: string | null };
  away_team: { name: string; flag_code: string | null };
}

function getResult(m: RecentMatch, trackedTeamId: string): 'W' | 'D' | 'L' {
  const isHome = m.home_team_id === trackedTeamId
  const scored = isHome ? m.home_score : m.away_score
  const conceded = isHome ? m.away_score : m.home_score
  if (scored > conceded) return 'W'
  if (scored === conceded) return 'D'
  return 'L'
}

const RESULT_TAG = {
  W: { label: '✓', className: 'bg-emerald-100 text-emerald-700 border-emerald-200', rowClassName: 'bg-emerald-50 border-emerald-200' },
  D: { label: '—', className: 'bg-amber-100 text-amber-700 border-amber-200', rowClassName: 'bg-amber-50 border-amber-200' },
  L: { label: '✗', className: 'bg-red-100 text-red-700 border-red-200', rowClassName: 'bg-red-50 border-red-200' },
}

interface PredictionEditModalProps {
  open: boolean;
  match: MatchRef | null;
  onClose: () => void;
  myPrediction?: {
    home_guess: number | null;
    away_guess: number | null;
  } | null;
  onPredictionChange?: (home: number | null, away: number | null) => void;
  isSaving?: boolean;
  onSaveSuccess?: () => void;
}

export default function PredictionEditModal({
  open,
  match,
  onClose,
  myPrediction,
  onPredictionChange,
  isSaving = false,
  onSaveSuccess,
}: PredictionEditModalProps) {
  const [homeGuess, setHomeGuess] = useState<string>(
    myPrediction?.home_guess?.toString() ?? '',
  );
  const [awayGuess, setAwayGuess] = useState<string>(
    myPrediction?.away_guess?.toString() ?? '',
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSavedText, setShowSavedText] = useState(false);
  const [homeTeamMatches, setHomeTeamMatches] = useState<RecentMatch[]>([]);
  const [awayTeamMatches, setAwayTeamMatches] = useState<RecentMatch[]>([]);
  const [groupStandings, setGroupStandings] = useState<GroupStandingTeam[]>([]);
  const wasSavingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setHomeGuess(myPrediction?.home_guess?.toString() ?? '');
      setAwayGuess(myPrediction?.away_guess?.toString() ?? '');
    }
  }, [open, myPrediction, match?.id]);

  useEffect(() => {
    if (wasSavingRef.current && !isSaving) {
      setSaveSuccess(true);
      setShowSavedText(true);
      onSaveSuccess?.();
    }
    wasSavingRef.current = !!isSaving;
  }, [isSaving, onSaveSuccess]);

  useEffect(() => {
    if (showSavedText) {
      const timeout = setTimeout(() => setShowSavedText(false), 1500);
      return () => clearTimeout(timeout);
    }
  }, [showSavedText]);

  useEffect(() => {
    if (!open || !match) return;

    const fetchRecentMatches = async () => {
      const matchSelect = `
        id, home_team_id, away_team_id, home_score, away_score,
        home_team:teams!matches_home_team_id_fkey(name, flag_code),
        away_team:teams!matches_away_team_id_fkey(name, flag_code)
      `;

      const groupQuery = match.group_id
        ? supabase
            .from('matches')
            .select(`id, home_score, away_score, status, home_team:teams!matches_home_team_id_fkey(name, flag_code), away_team:teams!matches_away_team_id_fkey(name, flag_code)`)
            .eq('group_id', match.group_id)
        : Promise.resolve({ data: null });

      const [{ data: homeData }, { data: awayData }, { data: groupData }] = await Promise.all([
        supabase
          .from('matches')
          .select(matchSelect)
          .or(
            `home_team_id.eq.${match.home_team_id},away_team_id.eq.${match.home_team_id}`,
          )
          .eq('status', 'encerrado')
          .order('kickoff_at', { ascending: false })
          .limit(3),
        supabase
          .from('matches')
          .select(matchSelect)
          .or(
            `home_team_id.eq.${match.away_team_id},away_team_id.eq.${match.away_team_id}`,
          )
          .eq('status', 'encerrado')
          .order('kickoff_at', { ascending: false })
          .limit(3),
        groupQuery,
      ]);

      setHomeTeamMatches((homeData ?? []) as RecentMatch[]);
      setAwayTeamMatches((awayData ?? []) as RecentMatch[]);

      if (groupData) {
        const teamMap = new Map<string, GroupStandingTeam>();
        for (const m of groupData as any[]) {
          const homeName: string = m.home_team?.name ?? ''
          const awayName: string = m.away_team?.name ?? ''
          if (!teamMap.has(homeName)) {
            teamMap.set(homeName, { team_name: homeName, flag_code: m.home_team?.flag_code ?? null, matches: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, points: 0 })
          }
          if (!teamMap.has(awayName)) {
            teamMap.set(awayName, { team_name: awayName, flag_code: m.away_team?.flag_code ?? null, matches: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, points: 0 })
          }
          if (m.status === 'encerrado' && m.home_score !== null && m.away_score !== null) {
            const home = teamMap.get(homeName)!
            const away = teamMap.get(awayName)!
            home.matches++; away.matches++
            home.goals_for += m.home_score; home.goals_against += m.away_score
            away.goals_for += m.away_score; away.goals_against += m.home_score
            if (m.home_score > m.away_score) { home.wins++; home.points += 3; away.losses++ }
            else if (m.home_score === m.away_score) { home.draws++; home.points++; away.draws++; away.points++ }
            else { home.losses++; away.wins++; away.points += 3 }
          }
        }
        const standings = Array.from(teamMap.values()).sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points
          const sgA = a.goals_for - a.goals_against
          const sgB = b.goals_for - b.goals_against
          if (sgB !== sgA) return sgB - sgA
          return b.goals_for - a.goals_for
        })
        setGroupStandings(standings)
      }
    };

    fetchRecentMatches();
  }, [open, match?.id, match?.home_team_id, match?.away_team_id]);

  if (!open || !match) return null;

  const hasSavedPrediction = homeGuess !== '' && awayGuess !== '' && !isSaving;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-slate-100 shrink-0 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2">
            <span className="inline-block w-1 h-4 rounded-full bg-brand-500 shrink-0" />
            <h2 className="text-sm font-extrabold tracking-tight text-slate-800">Dar Palpite</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 sm:p-6">
          <div className="space-y-4">
            <div
              className={`modern-card no-theme-tint p-4 sm:p-5 relative ${hasSavedPrediction ? 'border border-emerald-200 bg-white' : 'border border-slate-200 bg-white'}`}
            >
              {(saveSuccess || hasSavedPrediction) && (
                <div className="absolute right-3 top-3 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                  <span className="text-[10px] font-bold leading-none">✓</span>
                  {showSavedText && (
                    <span className="text-[9px] font-semibold leading-none">
                      Salvo
                    </span>
                  )}
                </div>
              )}

              <div className="mb-2 flex items-center justify-center gap-2">
                <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold px-2 py-0.5">
                  {match.group_code ? `Grupo ${match.group_code}` : 'Sem grupo'}
                </span>
                <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 border border-indigo-200">
                  {new Date(match.kickoff_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {match.venue && (
                <p className="text-[11px] text-center mb-1 text-gray-500">
                  {match.venue}
                </p>
              )}

              <div className="flex items-center justify-center gap-2">
                <div className="min-w-0 flex-1 flex justify-end">
                  <TeamWithFlag
                    name={match.home_team?.name}
                    flagCode={match.home_team?.flag_code}
                    size="sm"
                    compact
                    reverse
                    align="right"
                    className="font-semibold text-gray-800 justify-end truncate"
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={homeGuess}
                    onChange={(e) => {
                      setHomeGuess(e.target.value);
                      const home =
                        e.target.value === ''
                          ? null
                          : parseInt(e.target.value, 10);
                      onPredictionChange?.(
                        home,
                        awayGuess === '' ? null : parseInt(awayGuess, 10),
                      );
                    }}
                    disabled={isSaving}
                    className="w-10 text-center border border-gray-300 rounded px-1 py-1.5 text-base font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                  <span className="text-gray-400 font-bold text-sm">×</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={awayGuess}
                    onChange={(e) => {
                      setAwayGuess(e.target.value);
                      onPredictionChange?.(
                        homeGuess === '' ? null : parseInt(homeGuess, 10),
                        e.target.value === ''
                          ? null
                          : parseInt(e.target.value, 10),
                      );
                    }}
                    disabled={isSaving}
                    className="w-10 text-center border border-gray-300 rounded px-1 py-1.5 text-base font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <TeamWithFlag
                    name={match.away_team?.name}
                    flagCode={match.away_team?.flag_code}
                    size="sm"
                    compact
                    align="left"
                    className="font-semibold text-gray-800 truncate"
                  />
                </div>
              </div>

              <p className="text-[11px] text-center mt-3 text-slate-600 font-semibold">
                Fecha em{' '}
                {new Date(match.cutoff_at).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </p>

              {match.status === 'encerrado' && match.home_score !== null && (
                <div className="mt-3 text-center">
                  <span className="text-xs text-gray-400">Resultado: </span>
                  <span className="text-xs font-extrabold text-gray-700">
                    {match.home_score} × {match.away_score}
                  </span>
                </div>
              )}
            </div>

            {match.home_win_pct !== null &&
              match.draw_pct !== null &&
              match.away_win_pct !== null && (
                <div className="modern-card no-theme-tint p-4 sm:p-5 border border-slate-200 bg-white">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center mb-3">
                    Probabilidade de Vitória
                  </p>
                  <div className="flex justify-between text-center mb-2">
                    <div>
                      <p className="text-[10px] text-gray-400 leading-none mb-0.5">
                        {match.home_team?.name}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-600">
                        {match.home_win_pct}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 leading-none mb-0.5">
                        Empate
                      </p>
                      <p className="text-[11px] font-semibold text-gray-600">
                        {match.draw_pct}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 leading-none mb-0.5">
                        {match.away_team?.name}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-600">
                        {match.away_win_pct}%
                      </p>
                    </div>
                  </div>
                  <div className="flex rounded-full overflow-hidden h-1.5">
                    <div
                      className="bg-blue-400"
                      style={{ width: `${match.home_win_pct}%` }}
                    />
                    <div
                      className="bg-gray-300"
                      style={{ width: `${match.draw_pct}%` }}
                    />
                    <div
                      className="bg-red-400"
                      style={{ width: `${match.away_win_pct}%` }}
                    />
                  </div>
                </div>
              )}

            {(homeTeamMatches.length > 0 || awayTeamMatches.length > 0) && (
              <div className="modern-card no-theme-tint p-4 sm:p-5 border border-slate-200 bg-white">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center mb-3">
                  Últimos jogos
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { teamId: match.home_team_id, team: match.home_team, matches: homeTeamMatches },
                    { teamId: match.away_team_id, team: match.away_team, matches: awayTeamMatches },
                  ].map(({ teamId, team, matches }) => (
                    <div key={teamId} className="space-y-2">
                      <div className="flex items-center justify-center gap-1">
                        <TeamWithFlag
                          name={team?.name}
                          flagCode={team?.flag_code}
                          size="xs"
                          compact
                          className="text-xs font-semibold text-gray-500"
                        />
                      </div>
                      {matches.length > 0 ? (
                        matches.map((m) => {
                          const result = getResult(m, teamId!)
                          const tag = RESULT_TAG[result]
                          const flagImg = (code: string | null | undefined) =>
                            code ? (
                              <img
                                src={`https://flagcdn.com/40x30/${code.trim().toLowerCase()}.png`}
                                className="h-3.5 w-5 shrink-0 rounded object-cover border border-gray-200"
                              />
                            ) : (
                              <span className="h-3.5 w-5 shrink-0 rounded bg-gray-100 border border-gray-200" />
                            )
                          return (
                            <div
                              key={m.id}
                              className={`flex items-center gap-1 min-h-8 px-2 py-1 rounded-full border ${tag.rowClassName}`}
                            >
                              <div className="min-w-0 flex-1 flex items-center justify-end gap-1 flex-wrap">
                                <span className={`text-[10px] leading-tight text-right ${m.home_team_id === teamId ? 'font-semibold' : 'font-medium'}`}>{m.home_team?.name}</span>
                                {flagImg(m.home_team?.flag_code)}
                              </div>
                              <span className="font-bold text-gray-700 shrink-0 text-[11px]">{m.home_score}</span>
                              <span className="text-gray-400 shrink-0">×</span>
                              <span className="font-bold text-gray-700 shrink-0 text-[11px]">{m.away_score}</span>
                              <div className="min-w-0 flex-1 flex items-center gap-1">
                                {flagImg(m.away_team?.flag_code)}
                                <span className={`text-[10px] leading-tight ${m.away_team_id === teamId ? 'font-semibold' : 'font-medium'}`}>{m.away_team?.name}</span>
                              </div>
                              <span className={`shrink-0 inline-flex items-center px-1 py-px rounded-full text-[8px] font-bold border ${tag.className}`}>
                                {tag.label}
                              </span>
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-xs text-gray-400 py-2 px-2">Nenhum jogo anterior</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {match.group_id && groupStandings.length > 0 && (
              <div className="modern-card no-theme-tint p-4 sm:p-5 border border-slate-200 bg-white">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center mb-3">
                  Classificação {match.group_code ? `Grupo ${match.group_code}` : 'do Grupo'}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-gray-600">
                        <th className="text-left py-2 px-2 font-semibold">Pos</th>
                        <th className="text-left py-2 px-2 font-semibold">Time</th>
                        <th className="text-center py-2 px-1 font-semibold">P</th>
                        <th className="text-center py-2 px-1 font-semibold">J</th>
                        <th className="text-center py-2 px-1 font-semibold hidden sm:table-cell">V</th>
                        <th className="text-center py-2 px-1 font-semibold hidden sm:table-cell">E</th>
                        <th className="text-center py-2 px-1 font-semibold hidden sm:table-cell">D</th>
                        <th className="text-center py-2 px-1 font-semibold">GP</th>
                        <th className="text-center py-2 px-1 font-semibold hidden sm:table-cell">GC</th>
                        <th className="text-center py-2 px-1 font-semibold">SG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupStandings.map((team, idx) => {
                        const sg = team.goals_for - team.goals_against
                        const isPlaying = team.team_name === match.home_team?.name || team.team_name === match.away_team?.name
                        const rowClass = isPlaying
                          ? 'border-b border-slate-100 bg-indigo-50/60'
                          : idx < 2
                          ? 'border-b border-slate-100 bg-slate-50'
                          : 'border-b border-slate-100'
                        return (
                          <tr key={team.team_name} className={rowClass}>
                            <td className="text-center py-2 px-2 font-bold text-gray-700">{idx + 1}</td>
                            <td className="text-left py-2 px-2">
                              <div className="flex items-center gap-1.5">
                                {team.flag_code && (
                                  <img
                                    src={`https://flagcdn.com/40x30/${team.flag_code.trim().toLowerCase()}.png`}
                                    className="h-3.5 w-5 shrink-0 rounded object-cover border border-gray-200"
                                  />
                                )}
                                <span className={`truncate text-[10px] ${isPlaying ? 'font-semibold text-gray-800' : 'font-medium text-gray-800'}`}>{team.team_name}</span>
                              </div>
                            </td>
                            <td className="text-center py-2 px-1 font-extrabold text-slate-900">{team.points}</td>
                            <td className="text-center py-2 px-1 text-gray-600">{team.matches}</td>
                            <td className="text-center py-2 px-1 text-green-700 font-semibold hidden sm:table-cell">{team.wins}</td>
                            <td className="text-center py-2 px-1 text-yellow-700 font-semibold hidden sm:table-cell">{team.draws}</td>
                            <td className="text-center py-2 px-1 text-red-700 font-semibold hidden sm:table-cell">{team.losses}</td>
                            <td className="text-center py-2 px-1 text-gray-700 font-medium">{team.goals_for}</td>
                            <td className="text-center py-2 px-1 text-gray-700 font-medium hidden sm:table-cell">{team.goals_against}</td>
                            <td
                              className="text-center py-2 px-1 font-semibold"
                              style={{ color: sg > 0 ? '#059669' : sg < 0 ? '#dc2626' : '#666' }}
                            >
                              {sg > 0 ? '+' : ''}{sg}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
