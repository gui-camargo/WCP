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

  const getScoreStats = () => {
    const scores: Record<string, number> = {}
    for (const p of predictions) {
      const key = `${p.home_guess}x${p.away_guess}`
      scores[key] = (scores[key] ?? 0) + 1
    }
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1])
    return {
      most: entries.length > 0 ? entries[0][0] : 'N/A',
      mostCount: entries.length > 0 ? entries[0][1] : 0,
      least: entries.length > 1 ? entries[entries.length - 1][0] : (entries.length > 0 ? entries[0][0] : 'N/A'),
      leastCount: entries.length > 1 ? entries[entries.length - 1][1] : (entries.length > 0 ? entries[0][1] : 0),
    }
  }

  const scoreStats = getScoreStats()

  const averagePoints = predictions.length > 0
    ? (predictions.reduce((sum, p) => sum + (p.points ?? 0), 0) / predictions.length).toFixed(1)
    : '0'

  const cravedCount = predictions.filter(p => p.points === 20).length

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

        {/* Stats Grid */}
        <div className="mb-2">
          <div className={`grid gap-1 ${isFinished ? 'grid-cols-2' : 'grid-cols-2'}`}>
            <div className="text-center rounded bg-green-50 px-2 py-0.5 border border-green-200">
              <p className="text-[10px] text-green-700 font-semibold">📊 Mais Comum</p>
              <p style={{ paddingBottom: '6px' }} className="text-xs font-bold text-green-800">
                {scoreStats.most} <span className="text-[9px] text-green-600">({scoreStats.mostCount}x)</span>
              </p>
            </div>
            <div className="text-center rounded bg-orange-50 px-2 py-0.5 border border-orange-200">
              <p className="text-[10px] text-orange-700 font-semibold">📉 Menos Comum</p>
              <p style={{ paddingBottom: '6px' }} className="text-xs font-bold text-orange-800">
                {scoreStats.least} <span className="text-[9px] text-orange-600">({scoreStats.leastCount}x)</span>
              </p>
            </div>
            {isFinished && (
              <div className="text-center rounded bg-blue-50 px-2 py-0.5 border border-blue-200">
                <p className="text-[10px] text-blue-700 font-semibold">📈 Média</p>
                <p style={{ paddingBottom: '6px' }} className="text-xs font-bold text-blue-800">
                  {averagePoints} <span className="text-[9px] text-blue-600">pts</span>
                </p>
              </div>
            )}
            {isFinished && (
              <div className="text-center rounded bg-yellow-50 px-2 py-0.5 border border-yellow-200">
                <p className="text-[10px] text-yellow-700 font-semibold">🤩 Cravadas</p>
                <p style={{ paddingBottom: '6px' }} className="text-xs font-bold text-yellow-800">
                  {cravedCount}
                </p>
              </div>
            )}
          </div>
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
