import TeamWithFlag from './TeamWithFlag'
import FlagOnly from './FlagOnly'

interface Prediction {
  user_id: string
  user_name: string
  home_guess: number
  away_guess: number
  points: number | null
}

interface SnapshotPredictionsProps {
  matchId: string
  homeTeamName: string | null
  homeTeamFlagCode: string | null
  awayTeamName: string | null
  awayTeamFlagCode: string | null
  homeScore: number | null
  awayScore: number | null
  kickoffAt: string
  venue: string
  predictions: Prediction[]
  isFinished: boolean
  generatedAt: string
}

export default function SnapshotPredictions({
  matchId,
  homeTeamName,
  homeTeamFlagCode,
  awayTeamName,
  awayTeamFlagCode,
  homeScore,
  awayScore,
  kickoffAt,
  venue,
  predictions,
  isFinished,
  generatedAt,
}: SnapshotPredictionsProps) {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  // Ordena pelos pontos (maior primeiro) para jogos encerrados
  const sortedPredictions = isFinished
    ? [...predictions].sort((a, b) => {
        const aPoints = a.points ?? 0
        const bPoints = b.points ?? 0
        if (bPoints !== aPoints) return bPoints - aPoints
        return a.user_name.localeCompare(b.user_name, 'pt-BR')
      })
    : [...predictions].sort((a, b) => a.user_name.localeCompare(b.user_name, 'pt-BR'))

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


  const homeWins = predictions.filter(p => p.home_guess > p.away_guess).length
  const draws = predictions.filter(p => p.home_guess === p.away_guess).length
  const awayWins = predictions.filter(p => p.home_guess < p.away_guess).length
  const total = predictions.length
  const homeWinPct = total > 0 ? Math.round((homeWins / total) * 100) : 0
  const drawPct = total > 0 ? Math.round((draws / total) * 100) : 0
  const awayWinPct = total > 0 ? Math.round((awayWins / total) * 100) : 0

  const pointsCounts: Record<number, number> = { 20: 0, 15: 0, 10: 0, 5: 0, 0: 0 }
  for (const p of predictions) {
    if (p.points !== null && p.points in pointsCounts) pointsCounts[p.points]++
  }
  const pointsEntries: [number, string, string, string][] = [
    [20, '🤩', 'text-yellow-600', 'bg-yellow-50 border-yellow-300'],
    [15, '😄', 'text-emerald-700', 'bg-emerald-50 border-emerald-200'],
    [10, '😐', 'text-indigo-700', 'bg-indigo-50 border-indigo-200'],
    [5, '😬', 'text-orange-700', 'bg-orange-50 border-orange-200'],
    [0, '😵', 'text-red-700', 'bg-red-50 border-red-200'],
  ]

  const realHomeWins = (homeScore ?? 0) > (awayScore ?? 0)
  const realAwayWins = (homeScore ?? 0) < (awayScore ?? 0)
  const realDraw = (homeScore ?? 0) === (awayScore ?? 0)

  const getComponentColor = (isCorrect: boolean) => {
    if (!isFinished) return 'border-gray-300 bg-white text-gray-700'
    return isCorrect ? 'border-emerald-400 bg-emerald-100 text-emerald-700' : 'border-red-400 bg-red-100 text-red-700'
  }

  const getBannerColor = (isCorrect: boolean) => {
    if (!isFinished) return 'border border-gray-200 bg-white'
    return isCorrect ? 'border-2 border-emerald-400 bg-emerald-100' : 'border-2 border-red-400 bg-red-100'
  }

  return (
    <div
      id={`snapshot-${matchId}`}
      className="w-full max-w-lg mx-auto bg-white rounded-xl border border-gray-200 overflow-hidden"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-center text-gray-600 font-semibold">
            {formatTime(kickoffAt)} • {venue || '-'}
          </p>
          <div className="flex items-center justify-center gap-2">
            <span style={{ paddingBottom: '6px' }}>
              <TeamWithFlag
                name={homeTeamName}
                flagCode={homeTeamFlagCode}
                size="sm"
                compact
                reverse
                align="right"
                className="font-medium text-gray-800"
              />
            </span>
            <div style={{ paddingBottom: '6px' }} className={`whitespace-nowrap text-center px-2 py-0 text-lg font-extrabold rounded ${isFinished ? 'text-black bg-gray-100' : 'text-gray-400'}`}>
              {isFinished ? `${homeScore ?? '-'} × ${awayScore ?? '-'}` : '- × -'}
            </div>
            <span style={{ paddingBottom: '6px' }}>
              <TeamWithFlag
                name={awayTeamName}
                flagCode={awayTeamFlagCode}
                size="sm"
                compact
                align="left"
                className="font-medium text-gray-800"
              />
            </span>
          </div>
        </div>
      </div>

      {/* Predictions List */}
      <div className="px-4 py-2">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
          Palpites ({predictions.length})
        </h3>

        {/* Stats Section */}
        <div className="mb-2">
          {!isFinished ? (
            <div>
              <div className="flex rounded overflow-hidden h-2 mb-1.5">
                <div className="bg-blue-500" style={{ width: `${homeWinPct}%` }} />
                <div className="bg-yellow-400" style={{ width: `${drawPct}%` }} />
                <div className="bg-pink-400" style={{ width: `${awayWinPct}%` }} />
              </div>
              <div className="flex gap-1">
                <div className="flex-1 flex flex-col rounded bg-blue-50 border-2 border-blue-400 overflow-hidden">
                  <div style={{ paddingBottom: '3px' }} className="text-center text-[9px] text-blue-600 font-semibold bg-blue-100/50 px-1 leading-tight">
                    {homeTeamName}
                  </div>
                  <div className="flex items-center justify-center gap-1 px-1 leading-tight">
                    <span style={{ paddingBottom: '4px' }} className="text-[10px] text-blue-600 font-semibold">{homeWins}</span>
                    {homeTeamFlagCode && <FlagOnly flagCode={homeTeamFlagCode} size="xs" />}
                    <span style={{ paddingBottom: '4px' }} className="text-xs font-bold text-blue-800">{homeWinPct}%</span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col rounded bg-yellow-50 border-2 border-yellow-400 overflow-hidden">
                  <div style={{ paddingBottom: '3px' }} className="text-center text-[10px] text-yellow-600 font-semibold bg-yellow-100/50 px-1 uppercase leading-tight">
                    Empate
                  </div>
                  <div className="flex items-center justify-center gap-1 px-1 leading-tight">
                    <span style={{ paddingBottom: '4px' }} className="text-[10px] text-yellow-600 font-semibold">{draws}</span>
                    <span className="text-sm" style={{ paddingBottom: '4px' }}>🟰</span>
                    <span style={{ paddingBottom: '4px' }} className="text-xs font-bold text-yellow-800">{drawPct}%</span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col rounded bg-pink-50 border-2 border-pink-400 overflow-hidden">
                  <div style={{ paddingBottom: '3px' }} className="text-center text-[9px] text-pink-600 font-semibold bg-pink-100/50 px-1 leading-tight">
                    {awayTeamName}
                  </div>
                  <div className="flex items-center justify-center gap-1 px-1 leading-tight">
                    <span style={{ paddingBottom: '4px' }} className="text-[10px] text-pink-600 font-semibold">{awayWins}</span>
                    {awayTeamFlagCode && <FlagOnly flagCode={awayTeamFlagCode} size="xs" />}
                    <span style={{ paddingBottom: '4px' }} className="text-xs font-bold text-pink-800">{awayWinPct}%</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-5 rounded border border-gray-200 overflow-hidden text-center">
              {pointsEntries.map(([pts, emoji, textColor, bgBorder]) => (
                <div key={pts} className={`border-r last:border-r-0 border-gray-200 ${bgBorder}`}>
                  <div style={{ paddingBottom: '4px' }} className={`py-0.5 text-[10px] font-extrabold border-b border-gray-200 ${textColor}`}>{emoji} {pts}</div>
                  <div style={{ paddingBottom: '4px' }} className={`py-0.5 text-xs font-extrabold ${textColor}`}>{pointsCounts[pts]}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          {sortedPredictions.map((pred) => {
            const predictedHomeWins = pred.home_guess > pred.away_guess
            const predictedAwayWins = pred.home_guess < pred.away_guess
            const predictedDraw = pred.home_guess === pred.away_guess

            const winnerCorrect = (predictedHomeWins && realHomeWins) || (predictedAwayWins && realAwayWins) || (predictedDraw && realDraw)
            const homeGoalCorrect = pred.home_guess === homeScore
            const awayGoalCorrect = pred.away_guess === awayScore

            return (
              <div key={pred.user_id} style={{ display: 'flex', alignItems: 'stretch', gap: '4px', background: 'white', border: '2px solid #e5e7eb', borderRadius: '8px', padding: '4px 8px', boxSizing: 'border-box', minHeight: '28px', overflow: 'visible' }}>
                <span style={{ fontSize: '10px', lineHeight: '20px', fontWeight: 500, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'visible', flex: 1, minWidth: 0, alignSelf: 'center', display: 'block' }}>
                  {pred.user_name}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, alignSelf: 'center' }}>
                  {homeTeamFlagCode && (
                    <div className={`rounded p-0.5 flex items-center justify-center overflow-hidden ${getBannerColor(winnerCorrect)}`}>
                      <FlagOnly flagCode={homeTeamFlagCode} size="sm" />
                    </div>
                  )}
                  <span className={getComponentColor(homeGoalCorrect)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', fontSize: '10px', fontWeight: 700, borderRadius: '3px', border: '1px solid', boxSizing: 'border-box', verticalAlign: 'middle', paddingBottom: '8px' }}>
                    {pred.home_guess}
                  </span>
                  <span style={{ color: '#9ca3af', fontWeight: 700, fontSize: '10px', verticalAlign: 'middle' }}>×</span>
                  <span className={getComponentColor(awayGoalCorrect)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', fontSize: '10px', fontWeight: 700, borderRadius: '3px', border: '1px solid', boxSizing: 'border-box', verticalAlign: 'middle', paddingBottom: '8px' }}>
                    {pred.away_guess}
                  </span>
                  {awayTeamFlagCode && (
                    <div className={`rounded p-0.5 flex items-center justify-center overflow-hidden ${getBannerColor(winnerCorrect)}`}>
                      <FlagOnly flagCode={awayTeamFlagCode} size="sm" />
                    </div>
                  )}
                </div>

                {isFinished && pred.points !== null ? (
                  <span className={getPointsColor(pred.points)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, borderRadius: '999px', border: '1px solid currentColor', fontSize: '10px', height: '20px', padding: '0 6px', paddingBottom: '8px', alignSelf: 'center', boxSizing: 'border-box' }}>
                    {getPointsEmoji(pred.points)} {pred.points}
                  </span>
                ) : (
                  <span style={{ width: '22px', textAlign: 'center', color: '#9ca3af', fontSize: '10px', lineHeight: '20px', flexShrink: 0, alignSelf: 'center' }}>—</span>
                )}
              </div>
            )
          })}
        </div>

      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-1 text-center">
        <p className="text-[10px] text-gray-500">
          Gerado em {new Date(generatedAt).toLocaleString('pt-BR')}
        </p>
      </div>
    </div>
  )
}
