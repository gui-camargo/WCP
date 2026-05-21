import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface LeaderboardRow {
  user_id: string
  user_name: string
  total_points: number
  rank: number
}

export default function RankingPage() {
  const { poolId } = useParams()
  const { user } = useAuth()
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [poolName, setPoolName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (poolId) loadData()
  }, [poolId])

  async function loadData() {
    setLoading(true)
    const { data: pool } = await supabase.from('pools').select('name').eq('id', poolId!).single()
    setPoolName((pool as any)?.name ?? '')

    const { data } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('pool_id', poolId!)
      .order('rank')

    setRows(data ?? [])
    setLoading(false)
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div>
      <div className="modern-card soft-hover fade-rise relative overflow-hidden p-5 sm:p-6 mb-6">
        <div className="absolute -top-10 -right-12 h-28 w-28 rounded-full bg-sky-200/40 blur-2xl" />
        <div className="absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-emerald-200/40 blur-2xl" />
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-800">Ranking — {poolName}</h1>
          <p className="text-sm text-gray-600 mt-2">Pontuação geral do bolão</p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-10">Carregando...</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📊</p>
          <p>Nenhuma pontuação ainda. Os palpites estão sendo aguardados!</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brand-700 text-white">
              <tr>
                <th className="px-4 py-3 text-left w-12">#</th>
                <th className="px-4 py-3 text-left">Participante</th>
                <th className="px-4 py-3 text-right">Pontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => {
                const isMe = row.user_id === user?.id
                return (
                  <tr key={row.user_id} className={isMe ? 'bg-brand-50 font-semibold' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 text-center text-lg">
                      {row.rank <= 3 ? medals[row.rank - 1] : row.rank}
                    </td>
                    <td className="px-4 py-3">
                      {row.user_name}
                      {isMe && <span className="ml-2 text-xs text-brand-600">(você)</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-brand-700">
                      {row.total_points}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
