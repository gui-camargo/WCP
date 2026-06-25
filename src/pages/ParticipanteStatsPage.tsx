import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import BackButton from '@/components/BackButton';
import FlagOnly from '@/components/FlagOnly';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface LeaderboardStats {
  user_id: string;
  user_name: string;
  total_points: number;
  rank: number;
  bonus_points: number;
  c20: number;
  c15: number;
  c10: number;
  c5: number;
  c0: number;
}

interface Snapshot {
  rank: number;
  total_points: number;
  match_id: string;
  created_at: string;
}

interface TeamInfo {
  name: string;
  flag_code: string | null;
}

interface ClosedMatch {
  id: string;
  home_score: number | null;
  away_score: number | null;
  kickoff_at: string;
  home_team: TeamInfo | null;
  away_team: TeamInfo | null;
}

interface PredictionRow {
  match_id: string;
  home_guess: number;
  away_guess: number;
  points: number | null;
  created_at: string;
}

interface GroupPredResult {
  group_id: string;
  group_code: string;
  first_id: string;
  second_id: string;
  points: number | null;
  pred_first: TeamInfo;
  pred_second: TeamInfo;
  real_first: TeamInfo | null;
  real_second: TeamInfo | null;
}

interface ChartPoint {
  index: number;
  rank: number;
  totalPoints: number;
  label: string;
  xLabel: string;
}

// ---- Helper sub-components ----

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`modern-card p-4 flex flex-col gap-1 ${highlight ? 'border-brand-200 bg-brand-50' : ''}`}
    >
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`text-2xl font-black leading-tight ${highlight ? 'text-brand-700' : 'text-slate-800'}`}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

function CuriosityCard({
  label,
  value,
  sub,
  icon,
  color = 'slate',
}: {
  label: ReactNode;
  value: string;
  sub?: string;
  icon: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div
      className={`rounded-xl border p-3.5 flex flex-col gap-1 ${colorMap[color] ?? colorMap.slate}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-lg leading-none">{icon}</span>
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
          {label}
        </p>
      </div>
      <p className="text-xl font-black leading-tight">{value}</p>
      {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

function PointsBadge({ points }: { points: number | null }) {
  if (points === null) return <span className="text-slate-400 text-xs">–</span>;
  const cfg =
    points === 20
      ? { e: '🤩', c: 'bg-yellow-50 text-yellow-700 border-yellow-300' }
      : points === 15
        ? { e: '😄', c: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
        : points === 10
          ? { e: '😐', c: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
          : points === 5
            ? { e: '😬', c: 'bg-orange-50 text-orange-700 border-orange-200' }
            : { e: '😵', c: 'bg-red-50 text-red-700 border-red-200' };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${cfg.c}`}
    >
      <span className="hidden sm:inline">{cfg.e}</span>
      {points}
    </span>
  );
}

function RankBadge({ rank }: { rank: number | null }) {
  if (rank == null) return <span className="text-slate-400 text-xs">–</span>;
  const cls =
    rank === 1
      ? 'border-yellow-400 bg-yellow-50 text-yellow-800'
      : rank === 2
        ? 'border-slate-400 bg-slate-100 text-slate-700'
        : rank === 3
          ? 'border-orange-400 bg-orange-100 text-orange-800'
          : 'border-slate-300 bg-slate-50 text-slate-600';
  return (
    <span
      className={`inline-flex items-center justify-center text-xs font-bold rounded border px-2 py-0.5 ${cls}`}
    >
      #{rank}
    </span>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-slate-400 text-xs">–</span>;
  if (delta === 0)
    return <span className="text-slate-400 text-xs font-semibold">—</span>;
  if (delta > 0)
    return <span className="text-emerald-600 text-xs font-bold">▲{delta}</span>;
  return (
    <span className="text-red-500 text-xs font-bold">▼{Math.abs(delta)}</span>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ChartPoint;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-800 mb-1 max-w-[160px] truncate">
        {d.label}
      </p>
      <p className="text-brand-600 font-bold">#{d.rank} no ranking</p>
      <p className="text-slate-500">{d.totalPoints} pts acumulados</p>
    </div>
  );
}

function TeamRow({
  label,
  first,
  second,
  isResult,
}: {
  label: string;
  first: TeamInfo;
  second: TeamInfo;
  isResult?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-slate-400 w-16 shrink-0 font-medium">{label}</span>
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-slate-400 text-[10px]">1°</span>
        <FlagOnly flagCode={first.flag_code} size="xs" />
        <span
          className={`font-semibold ${isResult ? 'text-slate-800' : 'text-slate-600'}`}
        >
          {first.name}
        </span>
        <span className="text-slate-200 mx-0.5">·</span>
        <span className="text-slate-400 text-[10px]">2°</span>
        <FlagOnly flagCode={second.flag_code} size="xs" />
        <span
          className={`font-semibold ${isResult ? 'text-slate-800' : 'text-slate-600'}`}
        >
          {second.name}
        </span>
      </div>
    </div>
  );
}

function GroupPredCard({ gp }: { gp: GroupPredResult }) {
  const hasResult = gp.real_first !== null;
  const scored = gp.points !== null;

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
          Grupo {gp.group_code}
        </span>
        {scored ? (
          <PointsBadge points={gp.points} />
        ) : (
          <span className="text-[10px] text-slate-400">
            {hasResult ? 'calculando...' : 'aguardando resultado'}
          </span>
        )}
      </div>
      <div className="space-y-1.5 pt-2 border-t border-slate-100">
        <TeamRow
          label="Palpite"
          first={gp.pred_first}
          second={gp.pred_second}
        />
        {hasResult ? (
          <TeamRow
            label="Resultado"
            first={gp.real_first!}
            second={gp.real_second!}
            isResult
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 w-16 shrink-0 font-medium">
              Resultado
            </span>
            <span className="text-[11px] text-slate-300">–</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main page ----

export default function ParticipanteStatsPage() {
  const { poolId, userId } = useParams<{ poolId: string; userId: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'history'>('stats');
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [closedMatches, setClosedMatches] = useState<ClosedMatch[]>([]);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [groupPredResults, setGroupPredResults] = useState<GroupPredResult[]>(
    [],
  );
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [matchesOpen, setMatchesOpen] = useState(true);
  const [groupsOpen, setGroupsOpen] = useState(true);

  useEffect(() => {
    if (poolId && userId) void loadData();
  }, [poolId, userId]);

  async function loadData() {
    setLoading(true);

    const [leaderboardRes, snapshotsRes, roundsRes, countRes] =
      await Promise.all([
        supabase
          .from('leaderboard')
          .select(
            'user_id, user_name, total_points, rank, bonus_points, c20, c15, c10, c5, c0',
          )
          .eq('pool_id', poolId!)
          .eq('user_id', userId!)
          .maybeSingle(),

        supabase
          .from('leaderboard_snapshots')
          .select('rank, total_points, match_id, created_at')
          .eq('pool_id', poolId!)
          .eq('user_id', userId!)
          .order('created_at', { ascending: true }),

        supabase.from('rounds').select('id').eq('pool_id', poolId!),

        supabase
          .from('leaderboard')
          .select('*', { count: 'exact', head: true })
          .eq('pool_id', poolId!),
      ]);

    setStats(leaderboardRes.data as LeaderboardStats | null);
    setSnapshots((snapshotsRes.data ?? []) as Snapshot[]);
    setTotalParticipants(countRes.count ?? 0);

    const roundIds = roundsRes.data?.map((r: { id: string }) => r.id) ?? [];

    const [
      matchesRes,
      predsRes,
      profileRes,
      groupPredsRes,
      groupStandingsRes,
      teamsRes,
    ] = await Promise.all([
      roundIds.length > 0
        ? supabase
            .from('matches')
            .select(
              `
              id, home_score, away_score, kickoff_at, status,
              home_team:teams!matches_home_team_id_fkey(name, flag_code),
              away_team:teams!matches_away_team_id_fkey(name, flag_code)
            `,
            )
            .in('round_id', roundIds)
            .eq('status', 'encerrado')
            .order('kickoff_at', { ascending: true })
        : Promise.resolve({ data: [] }),

      supabase
        .from('predictions')
        .select('match_id, home_guess, away_guess, points, created_at')
        .eq('pool_id', poolId!)
        .eq('user_id', userId!),

      !leaderboardRes.data
        ? supabase
            .from('profiles')
            .select('name')
            .eq('id', userId!)
            .maybeSingle()
        : Promise.resolve({ data: null }),

      (supabase as any)
        .from('group_predictions')
        .select(
          `
          group_id, first_id, second_id, points,
          group_data:groups!group_predictions_group_id_fkey(code),
          pred_first:teams!group_predictions_first_id_fkey(name, flag_code),
          pred_second:teams!group_predictions_second_id_fkey(name, flag_code)
        `,
        )
        .eq('pool_id', poolId!)
        .eq('user_id', userId!),

      supabase.from('group_standings').select('group_id, first_id, second_id'),

      supabase.from('teams').select('id, name, flag_code'),
    ]);

    setClosedMatches((matchesRes.data ?? []) as ClosedMatch[]);
    setPredictions((predsRes.data ?? []) as PredictionRow[]);

    if (profileRes.data && !leaderboardRes.data) {
      setProfileName((profileRes.data as { name: string }).name);
    }

    const teamsMap = new Map(
      (
        (teamsRes.data ?? []) as Array<{
          id: string;
          name: string;
          flag_code: string | null;
        }>
      ).map((t) => [t.id, { name: t.name, flag_code: t.flag_code }]),
    );
    const standingsMap = new Map(
      (
        (groupStandingsRes.data ?? []) as Array<{
          group_id: string;
          first_id: string | null;
          second_id: string | null;
        }>
      ).map((gs) => [gs.group_id, gs]),
    );
    const mergedGroups: GroupPredResult[] = (
      (groupPredsRes.data ?? []) as any[]
    )
      .map((gp) => {
        const standing = standingsMap.get(gp.group_id as string);
        return {
          group_id: gp.group_id as string,
          group_code: (gp.group_data as { code: string } | null)?.code ?? '?',
          first_id: gp.first_id as string,
          second_id: gp.second_id as string,
          points: gp.points as number | null,
          pred_first: (gp.pred_first as TeamInfo) ?? {
            name: '?',
            flag_code: null,
          },
          pred_second: (gp.pred_second as TeamInfo) ?? {
            name: '?',
            flag_code: null,
          },
          real_first: standing?.first_id
            ? (teamsMap.get(standing.first_id) ?? null)
            : null,
          real_second: standing?.second_id
            ? (teamsMap.get(standing.second_id) ?? null)
            : null,
        };
      })
      .sort((a, b) => a.group_code.localeCompare(b.group_code));
    setGroupPredResults(mergedGroups);

    setLoading(false);
  }

  // ---- Derived data ----

  const predMap = useMemo(
    () => new Map(predictions.map((p) => [p.match_id, p])),
    [predictions],
  );
  const snapshotMap = useMemo(
    () => new Map(snapshots.map((s) => [s.match_id, s])),
    [snapshots],
  );

  const mergedHistory = useMemo(() => {
    let runningPoints = 0;
    return closedMatches.map((match, index) => {
      const prediction = predMap.get(match.id) ?? null;
      runningPoints += prediction?.points ?? 0;
      const snapshot = snapshotMap.get(match.id) ?? null;
      const prevSnapshot =
        index > 0
          ? (snapshotMap.get(closedMatches[index - 1].id) ?? null)
          : null;
      const delta =
        snapshot && prevSnapshot ? prevSnapshot.rank - snapshot.rank : null;
      return { match, prediction, snapshot, delta, runningPoints };
    });
  }, [closedMatches, predMap, snapshotMap]);

  const chartData: ChartPoint[] = useMemo(() => {
    return mergedHistory
      .filter((item) => item.snapshot !== null)
      .map((item, index) => {
        const { match, snapshot, runningPoints } = item;
        const homeAbbr = (match.home_team?.name ?? '?').substring(0, 3).toUpperCase();
        const awayAbbr = (match.away_team?.name ?? '?').substring(0, 3).toUpperCase();
        return {
          index: index + 1,
          rank: snapshot!.rank,
          totalPoints: runningPoints,
          label: `${match.home_team?.name ?? '?'} × ${match.away_team?.name ?? '?'}`,
          xLabel: `${homeAbbr}×${awayAbbr}`,
        };
      });
  }, [mergedHistory]);

  const computed = useMemo(() => {
    const orderedPts = mergedHistory
      .filter((item) => item.prediction !== null)
      .map((item) => item.prediction!.points ?? 0);

    const totalPreds = orderedPts.length;
    const totalPts = stats?.total_points ?? 0;
    const matchPts = totalPts - (stats?.bonus_points ?? 0);
    const avgPoints = totalPreds > 0 ? matchPts / totalPreds : 0;
    const efficiency =
      totalPreds > 0 ? (matchPts / (totalPreds * 20)) * 100 : 0;

    let bestStreak = 0,
      streak = 0;
    for (const pts of orderedPts) {
      if (pts > 0) {
        streak++;
        bestStreak = Math.max(bestStreak, streak);
      } else {
        streak = 0;
      }
    }

    let curStreakCount = 0;
    let curStreakType: 'positive' | 'negative' | 'none' = 'none';
    if (orderedPts.length > 0) {
      const lastPositive = orderedPts[orderedPts.length - 1] > 0;
      curStreakType = lastPositive ? 'positive' : 'negative';
      for (let i = orderedPts.length - 1; i >= 0; i--) {
        if (orderedPts[i] > 0 === lastPositive) curStreakCount++;
        else break;
      }
    }

    const ranks = snapshots.map((s) => s.rank);
    const bestRank = ranks.length ? Math.min(...ranks) : (stats?.rank ?? 0);
    const worstRank = ranks.length ? Math.max(...ranks) : (stats?.rank ?? 0);

    const firstRank = snapshots[0]?.rank ?? stats?.rank ?? 0;
    const currentRank = stats?.rank ?? 0;
    const rankDelta = firstRank - currentRank;

    const daringness =
      totalPreds > 0 ? ((stats?.c20 ?? 0) / totalPreds) * 100 : 0;
    const zeroRate = totalPreds > 0 ? ((stats?.c0 ?? 0) / totalPreds) * 100 : 0;

    // Jogos sem palpite: prediction was auto-inserted after kickoff
    const semPalpite = mergedHistory.filter((item) => {
      const pred = item.prediction;
      if (!pred) return true;
      return new Date(pred.created_at) >= new Date(item.match.kickoff_at);
    }).length;

    // Palpite mais apostado (only real pre-kickoff predictions)
    const palpiteCountMap = new Map<string, number>();
    for (const item of mergedHistory) {
      const pred = item.prediction;
      if (!pred) continue;
      if (new Date(pred.created_at) >= new Date(item.match.kickoff_at))
        continue;
      const key = `${pred.home_guess} × ${pred.away_guess}`;
      palpiteCountMap.set(key, (palpiteCountMap.get(key) ?? 0) + 1);
    }
    let favoritePalpite = '–';
    let favoritePalpiteCount = 0;
    for (const [key, count] of palpiteCountMap.entries()) {
      if (count > favoritePalpiteCount) {
        favoritePalpiteCount = count;
        favoritePalpite = key;
      }
    }

    return {
      avgPoints,
      efficiency,
      bestStreak,
      curStreakCount,
      curStreakType,
      bestRank,
      worstRank,
      rankDelta,
      daringness,
      totalPreds,
      zeroRate,
      semPalpite,
      favoritePalpite,
      favoritePalpiteCount,
    };
  }, [mergedHistory, snapshots, stats]);

  const displayName = stats?.user_name ?? profileName ?? 'Participante';
  const currentRank = stats?.rank ?? null;
  const totalPts = stats?.total_points ?? 0;
  const isSelf = user?.id === userId;
  const medals = ['🥇', '🥈', '🥉'];
  const chartDomain: [number, number] = [
    1,
    Math.max(totalParticipants, ...chartData.map((d) => d.rank), 1),
  ];

  if (loading) {
    return (
      <p className="text-gray-400 text-center py-20">
        Carregando estatísticas...
      </p>
    );
  }

  if (!stats && !profileName) {
    return (
      <div className="space-y-4">
        <BackButton to={`/bolao/${poolId}/ranking`} label="Voltar ao Ranking" />
        <div className="text-center py-20 text-slate-400">
          <p className="text-3xl mb-2">🔍</p>
          <p>Participante não encontrado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <BackButton to={`/bolao/${poolId}/ranking`} label="Voltar ao Ranking" />

      {/* Hero */}
      <div className="modern-card px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center text-white font-black text-xl flex-shrink-0 select-none">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-slate-800 leading-tight">
                {displayName}
              </h1>
              {isSelf && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-700 border border-brand-200">
                  você
                </span>
              )}
            </div>
          </div>
          {currentRank != null && (
            <div className="flex flex-col items-end shrink-0 gap-0.5">
              <div className="flex items-center gap-1.5">
                {currentRank <= 3 && (
                  <span className="text-xl leading-none">
                    {medals[currentRank - 1]}
                  </span>
                )}
                <span className="text-2xl font-black text-slate-800">
                  #{currentRank}
                </span>
              </div>
              <span className="text-sm font-bold text-brand-700">
                {totalPts} pts
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {(['stats', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === tab
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'stats' ? 'Estatísticas Gerais' : 'Histórico'}
          </button>
        ))}
      </div>

      {/* ---- Tab: Estatísticas Gerais ---- */}
      {activeTab === 'stats' && (
        <div className="space-y-5">
          {/* Formal stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Posição atual"
              value={
                currentRank != null
                  ? currentRank <= 3
                    ? `${medals[currentRank - 1]} #${currentRank}`
                    : `#${currentRank}`
                  : '–'
              }
              sub={
                totalParticipants > 0
                  ? `de ${totalParticipants} participantes`
                  : undefined
              }
              highlight
            />
            <StatCard
              label="Pontos totais"
              value={
                <>
                  {totalPts}
                  <span className="text-base font-semibold text-slate-400 ml-1.5">
                    de {closedMatches.length * 20}
                  </span>
                </>
              }
              sub={`${totalPts - (stats?.bonus_points ?? 0)} jogos · + ${stats?.bonus_points ?? 0} bônus`}
            />
            <StatCard
              label="Média por jogo"
              value={
                computed.totalPreds > 0 ? computed.avgPoints.toFixed(1) : '–'
              }
              sub="pontos/jogo"
            />
            <StatCard
              label="Aproveitamento"
              value={
                computed.totalPreds > 0
                  ? `${computed.efficiency.toFixed(0)}%`
                  : '–'
              }
              sub="do máximo possível"
            />
          </div>

          {/* Points distribution */}
          {stats && (
            <div>
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2 px-0.5">
                Distribuição de pontos
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                {[
                  {
                    pts: 20,
                    count: stats.c20,
                    emoji: '🤩',
                    label: 'Cravadas',
                    cls: 'bg-yellow-50 border-yellow-300 text-yellow-700',
                  },
                  {
                    pts: 15,
                    count: stats.c15,
                    emoji: '😄',
                    label: '15 Pontos',
                    cls: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                  },
                  {
                    pts: 10,
                    count: stats.c10,
                    emoji: '😐',
                    label: '10 Pontos',
                    cls: 'bg-indigo-50 border-indigo-200 text-indigo-700',
                  },
                  {
                    pts: 5,
                    count: stats.c5,
                    emoji: '😬',
                    label: '5 Pontos',
                    cls: 'bg-orange-50 border-orange-200 text-orange-700',
                  },
                  {
                    pts: 0,
                    count: stats.c0,
                    emoji: '😵',
                    label: 'Zeradas',
                    cls: 'bg-red-50 border-red-200 text-red-700',
                  },
                  {
                    pts: -1,
                    count: stats.bonus_points,
                    emoji: '⭐',
                    label: 'Bônus',
                    cls: 'bg-violet-50 border-violet-200 text-violet-700',
                  },
                ].map(({ pts, count, emoji, label, cls }) => {
                  const total = pts >= 0 ? (count ?? 0) * pts : null;
                  const isBonus = pts === -1;
                  return (
                    <div
                      key={pts}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${cls}`}
                    >
                      <span className="text-xl leading-none">{emoji}</span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold opacity-60 leading-tight uppercase tracking-wide">
                          {label}
                        </p>
                        <p className="text-xl font-black leading-tight">
                          {isBonus ? (
                            `+${count ?? 0} pts`
                          ) : (
                            <>
                              <span className="text-sm font-extrabold opacity-50">
                                ×
                              </span>
                              {count ?? 0}
                            </>
                          )}
                          {total !== null && (
                            <span className="text-sm font-semibold opacity-50 ml-1">
                              ({total} pts)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Curiosidades */}
          <div>
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2 px-0.5">
              Curiosidades
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <CuriosityCard
                label={
                  <>
                    Melhor
                    <br className="sm:hidden" /> posição
                  </>
                }
                value={snapshots.length ? `#${computed.bestRank}` : '–'}
                sub="histórica no ranking"
                icon="🏆"
                color="yellow"
              />
              <CuriosityCard
                label={
                  <>
                    Pior
                    <br className="sm:hidden" /> posição
                  </>
                }
                value={snapshots.length ? `#${computed.worstRank}` : '–'}
                sub="histórica no ranking"
                icon="📉"
                color="red"
              />
              <CuriosityCard
                label="Palpite favorito"
                value={computed.favoritePalpite}
                sub={
                  computed.favoritePalpiteCount > 0
                    ? `apostado ${computed.favoritePalpiteCount}× no bolão`
                    : 'nenhum palpite ainda'
                }
                icon="🔁"
                color="blue"
              />
              <CuriosityCard
                label="Alzeihmer"
                value={`${computed.semPalpite}`}
                sub="jogos encerrados sem palpite enviado"
                icon="🙈"
                color="orange"
              />
              <CuriosityCard
                label="Bola Cheia"
                value={
                  computed.totalPreds > 0
                    ? `${computed.daringness.toFixed(0)}%`
                    : '–'
                }
                sub="dos palpites CRAVARAM"
                icon="🤩"
                color="blue"
              />
              <CuriosityCard
                label="Bola Murcha"
                value={
                  computed.totalPreds > 0
                    ? `${computed.zeroRate.toFixed(0)}%`
                    : '–'
                }
                sub="dos palpites ZERARAM"
                icon="😵"
                color="purple"
              />
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 1 ? (
            <div>
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2 px-0.5">
                Evolução no ranking
              </h3>
              <div className="modern-card p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 20, right: 12, left: -8, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="xLabel"
                      tick={false}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      dataKey="rank"
                      reversed
                      domain={chartDomain}
                      ticks={[1, 10, 20, 30, 43]}
                      tickFormatter={(v: number) => `#${v}`}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      allowDecimals={false}
                      width={34}
                      padding={{ top: 15, bottom: 5 }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="rank"
                      stroke="#0052cc"
                      strokeWidth={2.5}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        const isFirst = payload.rank === 1;
                        return (
                          <circle
                            key={`dot-${payload.index}`}
                            cx={cx}
                            cy={cy}
                            r={isFirst ? 5 : 3}
                            fill={isFirst ? '#f59e0b' : '#0052cc'}
                            stroke={isFirst ? '#ffffff' : 'none'}
                            strokeWidth={isFirst ? 1.5 : 0}
                          />
                        );
                      }}
                      activeDot={{ r: 5, fill: '#0044a8', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-center text-[10px] text-slate-400 mt-1">
                  Posição após cada jogo encerrado
                </p>
              </div>
            </div>
          ) : (
            closedMatches.length === 0 && (
              <div className="text-center py-10 text-slate-400">
                <p className="text-3xl mb-2">⏳</p>
                <p className="text-sm">Nenhum jogo encerrado ainda.</p>
              </div>
            )
          )}
        </div>
      )}

      {/* ---- Tab: Histórico por Jogo ---- */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Pontuação Jogos */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setMatchesOpen((p) => !p)}
              className="w-full flex items-center justify-between py-0.5"
            >
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                Pontuação Jogos
              </h3>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${matchesOpen ? '' : '-rotate-90'}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {matchesOpen &&
              (mergedHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p className="text-3xl mb-2">📋</p>
                  <p className="text-sm">Nenhum jogo encerrado ainda.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow overflow-auto">
                  <table className="w-full text-sm sm:min-w-[680px]">
                    <thead className="bg-brand-600 text-white text-xs">
                      <tr>
                        <th className="px-3 py-3 text-left font-semibold">
                          Jogo
                        </th>
                        <th className="hidden sm:table-cell px-3 py-3 text-center font-semibold">
                          Resultado
                        </th>
                        <th className="hidden sm:table-cell px-3 py-3 text-center font-semibold">
                          Palpite
                        </th>
                        <th className="px-3 py-3 text-center font-semibold">
                          Pts
                        </th>
                        <th className="px-3 py-3 text-center font-semibold">
                          Posição
                        </th>
                        <th className="px-3 py-3 text-center font-semibold">
                          Var.
                        </th>
                        <th className="px-3 py-3 text-right font-semibold">
                          Acum.
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {mergedHistory.map(
                        ({ match, prediction, snapshot, delta, runningPoints }, idx) => (
                          <tr
                            key={match.id}
                            className={
                              idx % 2 === 0
                                ? 'bg-white hover:bg-slate-50'
                                : 'bg-slate-50/60 hover:bg-slate-50'
                            }
                          >
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="hidden sm:inline text-xs font-semibold text-slate-700">
                                  {match.home_team?.name ?? '?'}
                                </span>
                                <FlagOnly
                                  flagCode={match.home_team?.flag_code}
                                  size="xs"
                                />
                                <span className="text-slate-300 text-xs shrink-0">
                                  ×
                                </span>
                                <FlagOnly
                                  flagCode={match.away_team?.flag_code}
                                  size="xs"
                                />
                                <span className="hidden sm:inline text-xs font-semibold text-slate-700">
                                  {match.away_team?.name ?? '?'}
                                </span>
                              </div>
                            </td>
                            <td className="hidden sm:table-cell px-3 py-3 text-center">
                              <span className="font-bold text-slate-800 tabular-nums">
                                {match.home_score ?? '–'} ×{' '}
                                {match.away_score ?? '–'}
                              </span>
                            </td>
                            <td className="hidden sm:table-cell px-3 py-3 text-center">
                              {prediction ? (
                                <span className="text-slate-700 tabular-nums">
                                  {prediction.home_guess} ×{' '}
                                  {prediction.away_guess}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs">
                                  sem palpite
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <PointsBadge
                                points={prediction?.points ?? null}
                              />
                            </td>
                            <td className="px-3 py-3 text-center">
                              <RankBadge rank={snapshot?.rank ?? null} />
                            </td>
                            <td className="px-3 py-3 text-center">
                              <DeltaBadge delta={delta} />
                            </td>
                            <td className="px-3 py-3 text-right font-bold text-brand-700 tabular-nums">
                              {runningPoints}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>

          {/* Classificações de Grupos */}
          {groupPredResults.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setGroupsOpen((p) => !p)}
                className="w-full flex items-center justify-between py-0.5"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                    Classificações de Grupos
                  </h3>
                  {groupPredResults.some((g) => (g.points ?? 0) > 0) && (
                    <span className="text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-0.5 rounded-full">
                      ⭐ +
                      {groupPredResults.reduce(
                        (sum, g) => sum + (g.points ?? 0),
                        0,
                      )}{' '}
                      bônus
                    </span>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${groupsOpen ? '' : '-rotate-90'}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {groupsOpen && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {groupPredResults.map((gp) => (
                    <GroupPredCard key={gp.group_id} gp={gp} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
