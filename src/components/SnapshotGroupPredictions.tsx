import FlagOnly from './FlagOnly'

export interface GroupPredRow {
  user_id: string
  user_name: string
  first_team: { id: string; name: string; flag_code: string | null } | null
  second_team: { id: string; name: string; flag_code: string | null } | null
  points: number | null
}

interface SnapshotGroupPredictionsProps {
  groupId: string
  groupCode: string
  realFirstTeam: { id: string; name: string; flag_code: string | null } | null
  realSecondTeam: { id: string; name: string; flag_code: string | null } | null
  predictions: GroupPredRow[]
  generatedAt: string
}

export default function SnapshotGroupPredictions({
  groupId,
  groupCode,
  realFirstTeam,
  realSecondTeam,
  predictions,
  generatedAt,
}: SnapshotGroupPredictionsProps) {
  const isResultSet = Boolean(realFirstTeam?.id || realSecondTeam?.id)

  const sorted = [...predictions].sort((a, b) => {
    if (isResultSet) {
      const bPts = b.points ?? -1
      const aPts = a.points ?? -1
      if (bPts !== aPts) return bPts - aPts
    }
    return a.user_name.localeCompare(b.user_name, 'pt-BR')
  })

  function getSlotColor(teamId: string | undefined, slot: 'first' | 'second') {
    if (!isResultSet || !teamId) return 'border-gray-300 bg-white'
    const exactMatch = slot === 'first' ? teamId === realFirstTeam?.id : teamId === realSecondTeam?.id
    if (exactMatch) return 'border-emerald-400 bg-emerald-100'
    const inTopTwo = teamId === realFirstTeam?.id || teamId === realSecondTeam?.id
    if (inTopTwo) return 'border-amber-400 bg-amber-100'
    return 'border-red-400 bg-red-100'
  }

  const getPointsColor = (points: number | null) => {
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

  return (
    <div
      id={`snapshot-group-${groupId}`}
      className="w-full max-w-lg mx-auto bg-white rounded-xl border border-gray-200 overflow-hidden"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <p style={{ paddingBottom: '4px' }} className="text-xs font-bold text-center text-gray-700 uppercase tracking-wider">
          Grupo {groupCode} — Classificados
        </p>
        <div className="flex items-center justify-center gap-6 mt-1">
          <div className="flex items-center gap-1.5">
            <span style={{ paddingBottom: '3px' }} className="text-[10px] font-bold text-amber-600 uppercase">1º</span>
            {realFirstTeam ? (
              <div className="flex items-center gap-1">
                <FlagOnly flagCode={realFirstTeam.flag_code} size="xs" />
                <span style={{ paddingBottom: '3px' }} className="text-[10px] font-semibold text-gray-700">{realFirstTeam.name}</span>
              </div>
            ) : (
              <span style={{ paddingBottom: '3px' }} className="text-[10px] text-gray-400 italic">Pendente</span>
            )}
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1.5">
            <span style={{ paddingBottom: '3px' }} className="text-[10px] font-bold text-sky-600 uppercase">2º</span>
            {realSecondTeam ? (
              <div className="flex items-center gap-1">
                <FlagOnly flagCode={realSecondTeam.flag_code} size="xs" />
                <span style={{ paddingBottom: '3px' }} className="text-[10px] font-semibold text-gray-700">{realSecondTeam.name}</span>
              </div>
            ) : (
              <span style={{ paddingBottom: '3px' }} className="text-[10px] text-gray-400 italic">Pendente</span>
            )}
          </div>
        </div>
      </div>

      {/* Predictions List */}
      <div className="px-4 py-2">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
          Palpites ({predictions.length})
        </h3>

        {isResultSet && (
          <div className="mb-2 grid grid-cols-5 rounded border border-gray-200 overflow-hidden text-center">
            {pointsEntries.map(([pts, emoji, textColor, bgBorder]) => (
              <div key={pts} className={`border-r last:border-r-0 border-gray-200 ${bgBorder}`}>
                <div style={{ paddingBottom: '4px' }} className={`py-0.5 text-[10px] font-extrabold border-b border-gray-200 ${textColor}`}>{emoji} {pts}</div>
                <div style={{ paddingBottom: '4px' }} className={`py-0.5 text-xs font-extrabold ${textColor}`}>{pointsCounts[pts]}</div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1">
          {sorted.map((pred) => {
            const firstId = pred.first_team?.id
            const secondId = pred.second_team?.id

            return (
              <div key={pred.user_id} style={{ display: 'flex', alignItems: 'stretch', gap: '4px', background: 'white', border: '2px solid #e5e7eb', borderRadius: '8px', padding: '4px 8px', boxSizing: 'border-box', minHeight: '28px', overflow: 'visible' }}>
                <span style={{ fontSize: '10px', lineHeight: '20px', fontWeight: 500, color: '#1f2937', flex: 1, minWidth: 0, alignSelf: 'center', display: 'block' }}>
                  {pred.user_name}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, alignSelf: 'center' }}>
                  <div className={`rounded border-2 p-0.5 flex items-center justify-center ${getSlotColor(firstId, 'first')}`}>
                    {pred.first_team ? (
                      <FlagOnly flagCode={pred.first_team.flag_code} size="sm" />
                    ) : (
                      <span style={{ width: '24px', height: '16px', display: 'block', background: '#f3f4f6', borderRadius: '2px' }} />
                    )}
                  </div>
                  <div className={`rounded border-2 p-0.5 flex items-center justify-center ${getSlotColor(secondId, 'second')}`}>
                    {pred.second_team ? (
                      <FlagOnly flagCode={pred.second_team.flag_code} size="sm" />
                    ) : (
                      <span style={{ width: '24px', height: '16px', display: 'block', background: '#f3f4f6', borderRadius: '2px' }} />
                    )}
                  </div>
                </div>

                {isResultSet && pred.points !== null ? (
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
