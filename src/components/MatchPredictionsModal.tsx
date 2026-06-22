import { useEffect, useState } from 'react'
import TeamWithFlag from '@/components/TeamWithFlag'
import FlagOnly from '@/components/FlagOnly'
import { IconParticipants } from '@/components/Icons'
import { supabase } from '@/lib/supabase'

interface MatchRef {
  id: string
  kickoff_at: string
  venue: string
  cutoff_at: string
  group_code: string | null
  status: 'pendente' | 'ao_vivo' | 'encerrado'
  home_score: number | null
  away_score: number | null
  home_team: { name: string; flag_code: string | null } | null
  away_team: { name: string; flag_code: string | null } | null
  home_win_pct: number | null
  draw_pct: number | null
  away_win_pct: number | null
}

interface UserPredRef {
  user_id: string
  user_name: string
  home_guess: number
  away_guess: number
  points: number | null
  predicted?: boolean
}

interface MatchPredictionsModalProps {
  open: boolean
  match: MatchRef | null
  userPreds: UserPredRef[]
  loadingPreds: boolean
  onClose: () => void
  currentUserId?: string | null
}

export default function MatchPredictionsModal({
  open,
  match,
  userPreds,
  loadingPreds,
  onClose,
  currentUserId,
}: MatchPredictionsModalProps) {
  const [liveMatch, setLiveMatch] = useState<Pick<MatchRef, 'status' | 'home_score' | 'away_score'> | null>(null)

  useEffect(() => {
    if (!open || !match) return
    setLiveMatch(null)

    const channel = supabase
      .channel(`match-live-${match.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
        (payload) => {
          const r = payload.new as { status: MatchRef['status']; home_score: number | null; away_score: number | null }
          setLiveMatch({ status: r.status, home_score: r.home_score, away_score: r.away_score })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [open, match?.id])

  if (!open || !match) return null

  const currentStatus = liveMatch?.status ?? match.status
  const currentHomeScore = liveMatch?.home_score ?? match.home_score
  const currentAwayScore = liveMatch?.away_score ?? match.away_score

  const getPointsColor = (points: number | null) => {
    if (points === null) return 'text-gray-400'
    if (points === 20) return 'text-yellow-600 bg-yellow-100 border-yellow-400'
    if (points === 15) return 'text-emerald-700 bg-emerald-100 border-emerald-300'
    if (points === 10) return 'text-indigo-700 bg-indigo-100 border-indigo-300'
    if (points === 5) return 'text-orange-700 bg-orange-100 border-orange-300'
    if (points === 0) return 'text-red-700 bg-red-100 border-red-300'
    return 'text-gray-700 bg-gray-100 border-gray-300'
  }

  const getPointsEmoji = (points: number | null) => {
    if (points === 20) return '🤩'
    if (points === 15) return '😄'
    if (points === 10) return '😐'
    if (points === 5) return '😬'
    if (points === 0) return '😵'
    return ''
  }

  const getPointsBorder = (points: number | null) => {
    if (points === 20) return 'border-yellow-400'
    if (points === 15) return 'border-emerald-300'
    if (points === 10) return 'border-indigo-300'
    if (points === 5) return 'border-orange-300'
    if (points === 0) return 'border-red-300'
    return 'border-gray-200'
  }

  const sortedPreds = [...userPreds].sort((a, b) => a.user_name.localeCompare(b.user_name, 'pt-BR'))

  const isGameEnded = currentStatus === 'encerrado'
  const isGameLive = currentStatus === 'ao_vivo'
  const realHomeWins = (currentHomeScore ?? 0) > (currentAwayScore ?? 0)
  const realAwayWins = (currentHomeScore ?? 0) < (currentAwayScore ?? 0)
  const realDraw = (currentHomeScore ?? 0) === (currentAwayScore ?? 0)

  const getComponentColor = (isCorrect: boolean) => {
    if (!isGameEnded) return 'border-gray-300 bg-white text-gray-700'
    return isCorrect
      ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
      : 'border-red-400 bg-red-100 text-red-700'
  }

  const getBannerColor = (isCorrect: boolean) => {
    if (!isGameEnded) return 'border border-gray-200 bg-white'
    return isCorrect
      ? 'border-2 border-emerald-400 bg-emerald-100'
      : 'border-2 border-red-400 bg-red-100'
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[1px] flex items-end sm:items-start sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-3xl sm:mx-auto sm:mt-8 bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border-t-2 border-x-2 border-slate-200 sm:border-2 sm:border-slate-300 sm:ring-4 sm:ring-slate-100/90 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 pt-2 pb-3 sm:px-5">
          <div className="flex justify-end mb-1">
            <button
              onClick={onClose}
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-center text-slate-600 font-semibold">
              {new Date(match.kickoff_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} | {match.venue || '-'}
            </p>
            <div className="flex items-center justify-center gap-2 sm:gap-4">
              <div className="flex-1 sm:flex-none flex justify-end">
                <TeamWithFlag
                  name={match.home_team?.name}
                  flagCode={match.home_team?.flag_code}
                  size="md"
                  compact
                  reverse
                  align="right"
                  className="font-semibold text-gray-800 text-xs sm:text-sm"
                />
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className={`whitespace-nowrap text-center rounded px-2 py-1 text-2xl sm:text-4xl font-extrabold ${isGameEnded || isGameLive ? 'text-black' : 'text-slate-400'}`}>
                  {isGameEnded || isGameLive
                    ? `${currentHomeScore ?? '-'} × ${currentAwayScore ?? '-'}`
                    : '- × -'}
                </div>
                {isGameLive && (
                  <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-red-600 uppercase tracking-widest">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Ao vivo
                  </span>
                )}
              </div>
              <div className="flex-1 sm:flex-none flex justify-start">
                <TeamWithFlag
                  name={match.away_team?.name}
                  flagCode={match.away_team?.flag_code}
                  size="md"
                  compact
                  align="left"
                  className="font-semibold text-gray-800 text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-5">
          {loadingPreds ? (
            <p className="text-gray-400">Carregando palpites...</p>
          ) : userPreds.length > 0 ? (
            <div className="space-y-4">
              {userPreds.length > 0 && (() => {
                if (isGameEnded) return null;

                const realPreds = userPreds.filter((p) => p.predicted);
                const homeWins = userPreds.filter(
                  (p) => p.home_guess > p.away_guess,
                ).length;
                const draws = userPreds.filter(
                  (p) => p.home_guess === p.away_guess,
                ).length;
                const awayWins = userPreds.filter(
                  (p) => p.home_guess < p.away_guess,
                ).length;
                const total = userPreds.length;

                const homeWinPct =
                  total > 0 ? Math.round((homeWins / total) * 100) : 0;
                const drawPct =
                  total > 0 ? Math.round((draws / total) * 100) : 0;
                const awayWinPct =
                  total > 0 ? Math.round((awayWins / total) * 100) : 0;

                return (
                  <div>
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-600 mb-2">
                        <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-bold">
                          {realPreds.length}{' '}
                          <span className="mx-1 text-gray-500">/</span>
                          {total} Palpites
                        </span>
                      </p>
                      <div className="flex rounded-lg overflow-hidden h-3 mb-3">
                        <div
                          className="bg-blue-500"
                          style={{ width: `${homeWinPct}%` }}
                        />
                        <div
                          className="bg-yellow-400"
                          style={{ width: `${drawPct}%` }}
                        />
                        <div
                          className="bg-pink-400"
                          style={{ width: `${awayWinPct}%` }}
                        />
                      </div>
                      {/* Mobile Layout */}
                      <div className="flex gap-2 sm:hidden">
                        {/* Home */}
                        <div className="flex-1 flex flex-col gap-0 rounded-lg bg-blue-50 border-2 border-blue-400 overflow-hidden">
                          <div className="text-center text-xs text-blue-600 font-semibold bg-blue-100/50 pt-0.5 pb-0 px-1 leading-tight">
                            {match?.home_team?.flag_code?.toUpperCase()}
                          </div>
                          <div className="flex items-center justify-center gap-1 px-2 py-0 leading-tight">
                            <div className="flex items-center gap-0.5 text-blue-600 font-semibold text-xs">
                              <IconParticipants className="w-3 h-3" />
                              <span>{homeWins}</span>
                            </div>
                            {match?.home_team?.flag_code && (
                              <FlagOnly
                                flagCode={match.home_team.flag_code}
                                size="xs"
                              />
                            )}
                            <div className="text-sm font-bold text-blue-800">
                              {homeWinPct}%
                            </div>
                          </div>
                        </div>

                        {/* Draw */}
                        <div className="flex-1 flex flex-col gap-0 rounded-lg bg-yellow-50 border-2 border-yellow-400 overflow-hidden">
                          <div className="text-center text-xs text-yellow-600 font-semibold bg-yellow-100/50 py-0 px-1 uppercase">
                            Empate
                          </div>
                          <div className="flex items-center justify-center gap-1 px-2 py-0 leading-tight">
                            <div className="flex items-center gap-0.5 text-yellow-600 font-semibold text-xs">
                              <IconParticipants className="w-3 h-3" />
                              <span>{draws}</span>
                            </div>
                            <div className="text-base">🟰</div>
                            <div className="text-sm font-bold text-yellow-800">
                              {drawPct}%
                            </div>
                          </div>
                        </div>

                        {/* Away */}
                        <div className="flex-1 flex flex-col gap-0 rounded-lg bg-pink-50 border-2 border-pink-400 overflow-hidden">
                          <div className="text-center text-xs text-pink-600 font-semibold bg-pink-100/50 py-0 px-1">
                            {match?.away_team?.flag_code?.toUpperCase()}
                          </div>
                          <div className="flex items-center justify-center gap-1 px-2 py-0 leading-tight">
                            <div className="flex items-center gap-0.5 text-pink-600 font-semibold text-xs">
                              <IconParticipants className="w-3 h-3" />
                              <span>{awayWins}</span>
                            </div>
                            {match?.away_team?.flag_code && (
                              <FlagOnly
                                flagCode={match.away_team.flag_code}
                                size="xs"
                              />
                            )}
                            <div className="text-sm font-bold text-pink-800">
                              {awayWinPct}%
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Desktop Layout */}
                      <div className="hidden sm:grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-0 rounded-lg bg-blue-50 border-2 border-blue-400 overflow-hidden">
                          <div className="text-center text-sm text-blue-600 font-semibold bg-blue-100/50 py-0 px-1 leading-tight">
                            {match?.home_team?.flag_code?.toUpperCase()}
                          </div>
                          <div className="flex items-center justify-center gap-2 px-3 py-0 leading-tight">
                            <div className="flex items-center gap-1 text-blue-600 font-semibold">
                              <IconParticipants className="w-5 h-5" />
                              <span className="text-base">{homeWins}</span>
                            </div>
                            {match?.home_team?.flag_code && (
                              <FlagOnly
                                flagCode={match.home_team.flag_code}
                                size="md"
                              />
                            )}
                            <div className="text-lg font-bold text-blue-800">
                              {homeWinPct}%
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-0 rounded-lg bg-yellow-50 border-2 border-yellow-400 overflow-hidden">
                          <div className="text-center text-sm text-yellow-600 font-semibold bg-yellow-100/50 py-0 px-1 uppercase">
                            Empate
                          </div>
                          <div className="flex items-center justify-center gap-2 px-3 py-0 leading-tight">
                            <div className="flex items-center gap-1 text-yellow-600 font-semibold">
                              <IconParticipants className="w-5 h-5" />
                              <span className="text-base">{draws}</span>
                            </div>
                            <div className="text-2xl">🟰</div>
                            <div className="text-lg font-bold text-yellow-800">
                              {drawPct}%
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-0 rounded-lg bg-pink-50 border-2 border-pink-400 overflow-hidden">
                          <div className="text-center text-sm text-pink-600 font-semibold bg-pink-100/50 py-0 px-1">
                            {match?.away_team?.flag_code?.toUpperCase()}
                          </div>
                          <div className="flex items-center justify-center gap-2 px-3 py-0 leading-tight">
                            <div className="flex items-center gap-1 text-pink-600 font-semibold">
                              <IconParticipants className="w-5 h-5" />
                              <span className="text-base">{awayWins}</span>
                            </div>
                            {match?.away_team?.flag_code && (
                              <FlagOnly
                                flagCode={match.away_team.flag_code}
                                size="md"
                              />
                            )}
                            <div className="text-lg font-bold text-pink-800">
                              {awayWinPct}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {userPreds.length === 0 ? (
                <p className="text-gray-400">Nenhum palpite registrado.</p>
              ) : (
                <>
                  {isGameEnded && (() => {
                const counts: Record<number, number> = { 20: 0, 15: 0, 10: 0, 5: 0, 0: 0 }
                for (const p of userPreds) {
                  if (p.points !== null && p.points in counts) counts[p.points]++
                }
                const entries: [number, string, string, string][] = [
                  [20, '🤩', 'text-yellow-600', 'bg-yellow-50 border-yellow-300'],
                  [15, '😄', 'text-emerald-700', 'bg-emerald-50 border-emerald-200'],
                  [10, '😐', 'text-indigo-700', 'bg-indigo-50 border-indigo-200'],
                  [5, '😬', 'text-orange-700', 'bg-orange-50 border-orange-200'],
                  [0, '😵', 'text-red-700', 'bg-red-50 border-red-200'],
                ]
                return (
                  <div className="grid grid-cols-5 rounded-xl border border-gray-200 overflow-hidden text-center">
                    {entries.map(([pts, emoji, textColor, bgBorder]) => (
                      <div key={pts} className={`border-r last:border-r-0 border-gray-200 ${bgBorder} border-b-0`}>
                        <div className={`py-1 text-base font-extrabold border-b border-gray-200 ${textColor}`}>{emoji} {pts}</div>
                        <div className={`py-1.5 text-sm font-extrabold ${textColor}`}>{counts[pts]}</div>
                      </div>
                    ))}
                  </div>
                )
              })()}

              <div className="sm:hidden space-y-2">
                {sortedPreds.map((p, i) => {
                  const predictedHomeWins = p.home_guess > p.away_guess
                  const predictedAwayWins = p.home_guess < p.away_guess
                  const predictedDraw = p.home_guess === p.away_guess

                  const winnerCorrect = (predictedHomeWins && realHomeWins) || (predictedAwayWins && realAwayWins) || (predictedDraw && realDraw)
                  const homeGoalCorrect = p.home_guess === currentHomeScore
                  const awayGoalCorrect = p.away_guess === currentAwayScore

                  return (
                    <div key={i} className={`rounded-xl border-2 bg-white px-3 py-2 flex items-center gap-2 ${getPointsBorder(p.points)}`}>
                      <span className={`text-[11px] text-gray-800 truncate flex-1 min-w-0 ${p.user_id === currentUserId ? 'font-bold' : 'font-medium'}`}>
                        {p.user_name}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        {match.home_team?.flag_code && (
                          <div className={`rounded p-0.5 flex items-center justify-center overflow-hidden ${getBannerColor(winnerCorrect)}`}>
                            <FlagOnly flagCode={match.home_team.flag_code} size="sm" />
                          </div>
                        )}
                        <span className={`inline-flex justify-center font-bold w-7 py-0.5 rounded border text-xs ${getComponentColor(homeGoalCorrect)}`}>{p.home_guess}</span>
                        <span className="text-gray-400 font-bold text-xs">×</span>
                        <span className={`inline-flex justify-center font-bold w-7 py-0.5 rounded border text-xs ${getComponentColor(awayGoalCorrect)}`}>{p.away_guess}</span>
                        {match.away_team?.flag_code && (
                          <div className={`rounded p-0.5 flex items-center justify-center overflow-hidden ${getBannerColor(winnerCorrect)}`}>
                            <FlagOnly flagCode={match.away_team.flag_code} size="sm" />
                          </div>
                        )}
                      </div>

                      {p.points !== null ? (
                        <span className={`inline-flex justify-center shrink-0 font-bold w-16 py-0.5 rounded-full border text-xs ${getPointsColor(p.points)}`}>
                          {getPointsEmoji(p.points)} {p.points}
                        </span>
                      ) : (
                        <span className="inline-flex justify-center shrink-0 w-16 text-gray-400 font-medium text-xs">—</span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="hidden sm:block rounded-xl overflow-hidden border border-gray-100 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left">Participante</th>
                      <th className="px-4 py-2 text-center">Palpite</th>
                      <th className="px-4 py-2 text-right">Pontos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedPreds.map((p, i) => {
                      const predictedHomeWins = p.home_guess > p.away_guess
                      const predictedAwayWins = p.home_guess < p.away_guess
                      const predictedDraw = p.home_guess === p.away_guess

                      const winnerCorrect = (predictedHomeWins && realHomeWins) || (predictedAwayWins && realAwayWins) || (predictedDraw && realDraw)
                      const homeGoalCorrect = p.home_guess === match.home_score
                      const awayGoalCorrect = p.away_guess === match.away_score

                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className={`px-4 py-2 border-l-4 ${getPointsBorder(p.points)}`}>
                            <span className={`text-[13px] text-gray-800 ${p.user_id === currentUserId ? 'font-bold' : 'font-medium'}`}>
                              {p.user_name}
                              {p.user_id === currentUserId && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-normal bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">você</span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {match.home_team?.flag_code && (
                                <div className={`rounded-lg p-1 overflow-hidden ${getBannerColor(winnerCorrect)}`}>
                                  <FlagOnly flagCode={match.home_team.flag_code} size="md" />
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <span className={`inline-flex font-bold px-2 py-1 rounded border text-sm ${getComponentColor(homeGoalCorrect)}`}>
                                  {p.home_guess}
                                </span>
                                <span className="text-gray-400 font-bold">×</span>
                                <span className={`inline-flex font-bold px-2 py-1 rounded border text-sm ${getComponentColor(awayGoalCorrect)}`}>
                                  {p.away_guess}
                                </span>
                              </div>
                              {match.away_team?.flag_code && (
                                <div className={`rounded-lg p-1 overflow-hidden ${getBannerColor(winnerCorrect)}`}>
                                  <FlagOnly flagCode={match.away_team.flag_code} size="md" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {p.points !== null ? (
                              <span className={`inline-flex font-bold px-2.5 py-1 rounded-full border text-sm ${getPointsColor(p.points)}`}>
                                {getPointsEmoji(p.points)} {p.points} pts
                              </span>
                            ) : (
                              <span className="text-gray-400 font-medium">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-gray-400">Nenhum palpite registrado.</p>
          )}
        </div>
      </div>
    </div>
  )
}
