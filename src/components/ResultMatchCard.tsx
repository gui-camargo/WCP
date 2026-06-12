import TeamWithFlag from '@/components/TeamWithFlag'
import FlagOnly from '@/components/FlagOnly'

interface TeamRef {
  name: string | undefined
  flag_code: string | null | undefined
}

interface PredictionRef {
  home_guess: number | null | undefined
  away_guess: number | null | undefined
  points: number | null | undefined
}

interface ResultMatchCardProps {
  kickoffAt: string
  venue?: string | null
  homeTeam: TeamRef | null
  awayTeam: TeamRef | null
  homeScore: number | null
  awayScore: number | null
  canViewPreds: boolean
  isClosed: boolean
  myPrediction?: PredictionRef | null
  className?: string
  showPredictionLine?: boolean
  metaPrefix?: string
  metaPrefixMobile?: string
}

export default function ResultMatchCard({
  kickoffAt,
  venue,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  canViewPreds,
  isClosed,
  myPrediction,
  className = '',
  showPredictionLine = true,
  metaPrefix,
  metaPrefixMobile,
}: ResultMatchCardProps) {
  const now = new Date()
  const hasResult = isClosed && homeScore !== null && awayScore !== null
  const hasPrediction =
    myPrediction?.home_guess !== null &&
    myPrediction?.home_guess !== undefined &&
    myPrediction?.away_guess !== null &&
    myPrediction?.away_guess !== undefined

  const cardStateClass = !canViewPreds
    ? 'border-slate-200/90 bg-slate-50/80'
    : hasResult
      ? 'border-emerald-200 bg-emerald-50/60'
      : new Date(kickoffAt) > now
        ? 'border-amber-200 bg-amber-50/70'
        : 'border-emerald-200 bg-emerald-50/60'

  const meta = new Date(kickoffAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  function getPointsTone(points: number | null | undefined) {
    if (points === 20) return 'text-yellow-700 bg-yellow-100 border-yellow-300'
    if (points === 15) return 'text-emerald-700 bg-emerald-100 border-emerald-300'
    if (points === 10) return 'text-indigo-700 bg-indigo-100 border-indigo-300'
    if (points === 5) return 'text-orange-700 bg-orange-100 border-orange-300'
    if (points === 0) return 'text-red-700 bg-red-100 border-red-300'
    return 'text-slate-600 bg-slate-100 border-slate-200'
  }

  function getPointsEmoji(points: number | null | undefined) {
    if (points === 20) return '🤩'
    if (points === 15) return '😄'
    if (points === 10) return '😐'
    if (points === 5) return '😬'
    if (points === 0) return '😵'
    return '🎯'
  }

  return (
    <div className={`modern-card no-theme-tint p-2.5 sm:p-3 text-left transition border cursor-pointer ${cardStateClass} ${className}`}>
      <p className="text-[10px] text-center text-slate-600 font-semibold mb-1">
        {metaPrefix ? (
          <>
            <span className="sm:hidden">{metaPrefixMobile ?? metaPrefix} · </span>
            <span className="hidden sm:inline">{metaPrefix} · </span>
          </>
        ) : ''}
        {meta}
        {venue ? ` · ${venue}` : ''}
      </p>

      <div className="flex items-center justify-center gap-2">
        <TeamWithFlag
          name={homeTeam?.name}
          flagCode={homeTeam?.flag_code}
          size="sm"
          compact
          reverse
          align="right"
          className="flex-1 font-medium text-gray-800 justify-end"
        />

        <div
          className={`min-w-[46px] text-center rounded border px-1 py-0.5 text-xs font-extrabold ${
            hasResult
              ? 'border-emerald-300 text-emerald-700 bg-emerald-100/70'
              : canViewPreds
                ? 'border-amber-300 text-amber-700 bg-amber-100/70'
                : 'border-slate-200 text-slate-400 bg-white'
          }`}
        >
          {hasResult ? `${homeScore} x ${awayScore}` : '- x -'}
        </div>

        <TeamWithFlag
          name={awayTeam?.name}
          flagCode={awayTeam?.flag_code}
          size="sm"
          compact
          align="left"
          className="flex-1 font-medium text-gray-800"
        />
      </div>

      {showPredictionLine && (
        <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1 text-[11px] sm:gap-2">
          <span aria-hidden="true" className="min-w-0" />

          <div className="min-w-0 justify-self-center">
            {hasPrediction ? (
              <div className="inline-flex max-w-full items-center justify-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 sm:px-2">
                <span className="inline-flex items-center whitespace-nowrap text-slate-700 font-semibold">
                  <span className="sm:hidden">palpite:</span>
                  <span className="hidden sm:inline">seu palpite:</span>
                </span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-700 font-semibold">
                  <span className="opacity-80 saturate-75"><FlagOnly flagCode={homeTeam?.flag_code} size="xs" /></span>
                  {myPrediction?.home_guess} x {myPrediction?.away_guess}
                  <span className="opacity-80 saturate-75"><FlagOnly flagCode={awayTeam?.flag_code} size="xs" /></span>
                </span>
                {myPrediction?.points !== null && myPrediction?.points !== undefined ? (
                  <span className={`inline-flex items-center whitespace-nowrap rounded-full border text-[10px] font-bold px-1.5 py-0.5 ${getPointsTone(myPrediction.points)}`}>
                    <span className="sm:hidden">{getPointsEmoji(myPrediction.points)} {myPrediction.points}</span>
                    <span className="hidden sm:inline">{getPointsEmoji(myPrediction.points)} {myPrediction.points} pts</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 text-[10px] text-slate-600 font-semibold px-1.5 py-0.5">
                    <span className="sm:hidden">0</span>
                    <span className="hidden sm:inline">sem pontos</span>
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 font-semibold px-2 py-0.5">
                  Palpite nao enviado
                </span>
              </div>
            )}
          </div>

          <span
            className={`justify-self-end inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${
              canViewPreds
                ? 'border-brand-200 bg-white text-brand-700'
                : 'border-slate-200 bg-slate-100 text-slate-500'
            }`}
            aria-hidden="true"
          >
            {canViewPreds ? (
              <>
                <span className="sm:hidden">👥 Ver</span>
                <span className="hidden sm:inline">👥 Ver palpites</span>
              </>
            ) : 'bloqueado'}
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
              <path fillRule="evenodd" d="M7.22 4.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </span>
        </div>
      )}
    </div>
  )
}
