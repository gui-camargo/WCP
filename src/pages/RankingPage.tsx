import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BackButton from '@/components/BackButton'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { IconRanking } from '@/components/Icons'

interface LeaderboardRow {
  user_id: string
  user_name: string
  total_points: number
  rank: number
  c20?: number
  c15?: number
  c10?: number
  c5?: number
  c0?: number
}

export default function RankingPage() {
  const { poolId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [nameFilterOpen, setNameFilterOpen] = useState(false)
  const [nameFilter, setNameFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const nameFilterInputRef = useRef<HTMLInputElement | null>(null)

  const filteredRows = useMemo(() => {
    const query = nameFilter.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(row => row.user_name.toLowerCase().includes(query))
  }, [rows, nameFilter])

  useEffect(() => {
    if (nameFilterOpen) {
      nameFilterInputRef.current?.focus()
    }
  }, [nameFilterOpen])

  useEffect(() => {
    if (poolId) void loadData()
  }, [poolId])

  async function loadData() {
    setLoading(true)
    await supabase.from('pools').select('name').eq('id', poolId!).single()

    const { data: leaderboardData } = await supabase
      .from('leaderboard')
      .select('user_id, user_name, total_points, rank, c20, c15, c10, c5, c0')
      .eq('pool_id', poolId!)
      .order('rank', { ascending: true })
      .order('user_name', { ascending: true })

    setRows((leaderboardData ?? []) as LeaderboardRow[])
    setLoading(false)
  }

  function getPointsColor(points: number) {
    if (points === 20) return 'text-yellow-600 bg-yellow-50 border-yellow-300'
    if (points === 15) return 'text-emerald-700 bg-emerald-50 border-emerald-200'
    if (points === 10) return 'text-indigo-700 bg-indigo-50 border-indigo-200'
    if (points === 5) return 'text-orange-700 bg-orange-50 border-orange-200'
    return 'text-red-700 bg-red-50 border-red-200'
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-4">
      <div>
        <BackButton to={poolId ? `/bolao/${poolId}` : '/dashboard'} label="Voltar ao Bolão" />
      </div>

      <section className="relative px-0.5 py-0.5">
        <div className="border-b border-slate-200 pb-1.5">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-950 text-white flex-shrink-0">
              <IconRanking className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800 leading-tight">Ranking</h1>
          </div>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-600">Posição dos participantes no bolão</p>
        </div>
      </section>

      {loading ? (
        <p className="text-gray-400 text-center py-10">Carregando...</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📊</p>
          <p>Nenhuma pontuação ainda. Os palpites estão sendo aguardados!</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-600 text-white">
              <tr>
                <th className="px-2 sm:px-4 py-3 text-center w-8 sm:w-12 align-middle text-sm sm:text-base">#</th>
                <th className="px-4 py-3 text-left align-middle">
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setNameFilterOpen(prev => !prev)}
                      className="inline-flex items-center gap-2 text-left font-semibold hover:opacity-90"
                      aria-label={nameFilterOpen ? 'Fechar filtro de participante' : 'Abrir filtro de participante'}
                    >
                      <span>Participante</span>
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-white/30 bg-white/10" aria-hidden="true">
                        {nameFilterOpen ? (
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18" />
                            <path d="M6 6l12 12" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-3.5-3.5" />
                          </svg>
                        )}
                      </span>
                    </button>
                    {nameFilterOpen && (
                      <input
                        ref={nameFilterInputRef}
                        type="text"
                        value={nameFilter}
                        onChange={e => setNameFilter(e.target.value)}
                        placeholder="Filtrar por nome"
                        className="w-full rounded-md border border-white/40 bg-white px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/70"
                      />
                    )}
                  </div>
                </th>
                <th className="hidden sm:table-cell px-2 py-3 text-center align-middle min-w-[44px] sm:min-w-[96px]">
                  <span className="inline-flex items-center gap-1 px-1 py-1 rounded border border-white border-opacity-25 bg-white bg-opacity-10">
                    <span className="text-base sm:text-xl leading-none">🤩</span>
                    <span className="ml-1 text-xs sm:text-lg font-semibold align-middle">20</span>
                  </span>
                </th>
                <th className="hidden sm:table-cell px-2 py-3 text-center align-middle min-w-[44px] sm:min-w-[96px]">
                  <span className="inline-flex items-center gap-1 px-1 py-1 rounded border border-white border-opacity-25 bg-white bg-opacity-10">
                    <span className="text-base sm:text-xl leading-none">😄</span>
                    <span className="ml-1 text-xs sm:text-lg font-semibold align-middle">15</span>
                  </span>
                </th>
                <th className="hidden sm:table-cell px-2 py-3 text-center align-middle min-w-[44px] sm:min-w-[96px]">
                  <span className="inline-flex items-center gap-1 px-1 py-1 rounded border border-white border-opacity-25 bg-white bg-opacity-10">
                    <span className="text-base sm:text-xl leading-none">😐</span>
                    <span className="ml-1 text-xs sm:text-lg font-semibold align-middle">10</span>
                  </span>
                </th>
                <th className="hidden sm:table-cell px-2 py-3 text-center align-middle min-w-[44px] sm:min-w-[96px]">
                  <span className="inline-flex items-center gap-1 px-1 py-1 rounded border border-white border-opacity-25 bg-white bg-opacity-10">
                    <span className="text-base sm:text-xl leading-none">😬</span>
                    <span className="ml-1 text-xs sm:text-lg font-semibold align-middle">5</span>
                  </span>
                </th>
                <th className="hidden sm:table-cell px-2 py-3 text-center align-middle min-w-[44px] sm:min-w-[96px]">
                  <span className="inline-flex items-center gap-1 px-1 py-1 rounded border border-white border-opacity-25 bg-white bg-opacity-10">
                    <span className="text-base sm:text-xl leading-none">😵</span>
                    <span className="ml-1 text-xs sm:text-lg font-semibold align-middle">0</span>
                  </span>
                </th>
                <th className="px-4 py-3 text-right align-middle">Pontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map(r => {
                const rowBg = r.rank === 1
                  ? 'bg-gradient-to-r from-yellow-300 via-yellow-200 to-yellow-50 hover:brightness-95'
                  : r.rank === 2
                    ? 'bg-gradient-to-r from-slate-200 via-slate-100 to-white hover:brightness-95'
                    : r.rank === 3
                      ? 'bg-gradient-to-r from-amber-200 via-amber-100 to-amber-50 hover:brightness-95'
                      : r.user_id === user?.id
                        ? 'bg-brand-50 font-semibold hover:bg-brand-100'
                        : 'hover:bg-brand-50';
                const nameColor = r.rank === 1
                  ? 'text-yellow-900 font-extrabold'
                  : r.rank === 2
                    ? 'text-slate-700 font-extrabold'
                    : r.rank === 3
                      ? 'text-amber-950 font-extrabold'
                      : '';
                return (
                <tr
                  key={r.user_id}
                  onClick={() => navigate(`/bolao/${poolId}/participante/${r.user_id}`)}
                  className={`cursor-pointer transition-colors ${rowBg}`}
                >
                  <td className="px-2 sm:px-4 py-3 text-center align-middle">
                    {r.rank <= 3
                      ? <span className="text-xl sm:text-2xl leading-none">{medals[r.rank - 1]}</span>
                      : <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-bold mx-auto">{r.rank}</span>
                    }
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className={`text-xs sm:text-sm leading-snug ${nameColor}`}>{r.user_name}</span>
                    {r.user_id === user?.id && <span title="Você" aria-label="Você (esta é a sua conta)" className="mx-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-normal bg-brand-100 text-brand-700 border border-brand-200 shadow-sm">você</span>}
                    <svg className="inline-block w-3 h-3 ml-1 align-middle text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </td>
                  <td className="hidden sm:table-cell px-2 py-3 text-center align-middle min-w-[44px] sm:min-w-[96px]"><span className={'inline-flex items-center font-bold px-1 py-1 rounded border text-xs sm:text-base ' + getPointsColor(20)}>{r.c20 ?? 0}</span></td>
                  <td className="hidden sm:table-cell px-2 py-3 text-center align-middle min-w-[44px] sm:min-w-[96px]"><span className={'inline-flex items-center font-bold px-1 py-1 rounded border text-xs sm:text-base ' + getPointsColor(15)}>{r.c15 ?? 0}</span></td>
                  <td className="hidden sm:table-cell px-2 py-3 text-center align-middle min-w-[44px] sm:min-w-[96px]"><span className={'inline-flex items-center font-bold px-1 py-1 rounded border text-xs sm:text-base ' + getPointsColor(10)}>{r.c10 ?? 0}</span></td>
                  <td className="hidden sm:table-cell px-2 py-3 text-center align-middle min-w-[44px] sm:min-w-[96px]"><span className={'inline-flex items-center font-bold px-1 py-1 rounded border text-xs sm:text-base ' + getPointsColor(5)}>{r.c5 ?? 0}</span></td>
                  <td className="hidden sm:table-cell px-2 py-3 text-center align-middle min-w-[44px] sm:min-w-[96px]"><span className={'inline-flex items-center font-bold px-1 py-1 rounded border text-xs sm:text-base ' + getPointsColor(0)}>{r.c0 ?? 0}</span></td>
                  <td className="px-4 py-3 text-right font-bold text-brand-700 align-middle">
                    <span className={'inline-flex items-center px-3 py-1 rounded-full font-bold text-lg sm:text-xl ' + (r.total_points >= 100 ? 'bg-accent-50 text-accent-700 border border-accent-200' : 'bg-white text-brand-700 border border-gray-100')}>{r.total_points}</span>
                  </td>
                </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                    Nenhum participante encontrado para "{nameFilter}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
