import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import TeamWithFlag from '@/components/TeamWithFlag';
import ResultMatchCard from '@/components/ResultMatchCard';
import MatchPredictionsModal from '@/components/MatchPredictionsModal';
import PredictionEditModal from '@/components/PredictionEditModal';
import {
  IconAward,
  IconParticipants,
  IconUpcomingMatches,
  IconFinishedMatches,
  IconMyPredictions,
  IconRanking,
} from '@/components/Icons';
import logoAlt from '@/assets/logo_alt.png';
import worldCup2026Logo from '@/assets/FIFA-2026-World-Cup-Logo-75.png';

interface Round {
  id: string;
  name: string;
  phase: string;
}

interface LeaderboardRow {
  user_id: string;
  user_name: string;
  total_points: number;
  rank: number;
}

interface MatchRow {
  id: string;
  round_id: string;
  kickoff_at: string;
  venue: string;
  cutoff_at: string;
  status: 'pendente' | 'ao_vivo' | 'encerrado';
  home_score: number | null;
  away_score: number | null;
  group_id: string | null;
  group_code: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_team: { name: string; flag_code: string | null } | null;
  away_team: { name: string; flag_code: string | null } | null;
  home_win_pct: number | null;
  draw_pct: number | null;
  away_win_pct: number | null;
}

interface PredictionRow {
  match_id: string;
  home_guess: number;
  away_guess: number;
  points: number | null;
}

interface UserPred {
  user_id: string;
  user_name: string;
  home_guess: number;
  away_guess: number;
  points: number | null;
  predicted?: boolean;
}

interface PrizeOverview {
  confirmed_count: number;
  first_prize_cents: number;
  second_prize_cents: number;
  third_prize_cents: number;
}

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export default function BolaoPage() {
  const { poolId } = useParams();
  const { user } = useAuth();
  const [poolName, setPoolName] = useState('');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [topRanking, setTopRanking] = useState<LeaderboardRow[]>([]);
  const [myRanking, setMyRanking] = useState<LeaderboardRow | null>(null);
  const [recentMatches, setRecentMatches] = useState<MatchRow[]>([]);
  const [upcomingTodayMatches, setUpcomingTodayMatches] = useState<MatchRow[]>(
    [],
  );
  const [predictionsByMatch, setPredictionsByMatch] = useState<
    Record<string, PredictionRow>
  >({});
  const [selectedPastMatchId, setSelectedPastMatchId] = useState<string | null>(
    null,
  );
  const [modalMode, setModalMode] = useState<'edit' | 'view'>('view');
  const [userPreds, setUserPreds] = useState<UserPred[]>([]);
  const [loadingPastPreds, setLoadingPastPreds] = useState(false);
  const [savingPrediction, setSavingPrediction] = useState(false);
  const [prizeOverview, setPrizeOverview] = useState<PrizeOverview | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [liveMatchData, setLiveMatchData] = useState<
    Record<string, { status: MatchRow['status']; home_score: number | null; away_score: number | null; time_detail: string | null }>
  >({});

  useEffect(() => {
    if (poolId && user) loadData();
  }, [poolId, user]);

  useEffect(() => {
    const channel = supabase
      .channel('bolao-live-matches')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        (payload) => {
          const r = payload.new as { id: string; status: MatchRow['status']; home_score: number | null; away_score: number | null; time_detail: string | null };
          setLiveMatchData((prev) => ({
            ...prev,
            [r.id]: { status: r.status, home_score: r.home_score, away_score: r.away_score, time_detail: r.time_detail },
          }));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!selectedPastMatchId) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closePastPredsModal();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedPastMatchId]);

  async function loadData() {
    setLoading(true);

    const matchSelect = `
      id, round_id, kickoff_at, venue, cutoff_at, status, home_score, away_score, group_id,
      home_team_id, away_team_id, external_match_id, home_win_pct, draw_pct, away_win_pct, time_detail,
      home_team:teams!matches_home_team_id_fkey(name, flag_code),
      away_team:teams!matches_away_team_id_fkey(name, flag_code)
    `;

    const [
      { data: pool },
      { data: prizeData, error: prizeError },
      { data: roundData },
      { data: groupsData },
      { data: leaderboardData },
    ] = await Promise.all([
      supabase.from('pools').select('name').eq('id', poolId!).single(),
      (supabase as any).rpc('get_pool_prize_overview', { p_pool_id: poolId! }),
      supabase.from('rounds').select('*').eq('pool_id', poolId!).order('created_at'),
      supabase.from('groups').select('id, code'),
      supabase.from('leaderboard').select('user_id, user_name, total_points, rank').eq('pool_id', poolId!).order('rank', { ascending: true }).order('user_name', { ascending: true }),
    ]);

    setPoolName((pool as any)?.name ?? '');

    if (prizeError) {
      setPrizeOverview(null);
    } else {
      const row = Array.isArray(prizeData) ? prizeData[0] : prizeData;
      setPrizeOverview(row ? {
        confirmed_count: Number(row.confirmed_count ?? 0),
        first_prize_cents: Number(row.first_prize_cents ?? 0),
        second_prize_cents: Number(row.second_prize_cents ?? 0),
        third_prize_cents: Number(row.third_prize_cents ?? 0),
      } : {
        confirmed_count: 0,
        first_prize_cents: 0,
        second_prize_cents: 0,
        third_prize_cents: 0,
      });
    }

    const nextRounds = (roundData ?? []) as Round[];
    setRounds(nextRounds);
    const roundIds = nextRounds.map((r) => r.id);

    const groupCodeMap = new Map(
      (groupsData ?? []).map((g: any) => [g.id, g.code]),
    );

    const filteredRows = (leaderboardData ?? []) as LeaderboardRow[];
    setTopRanking(filteredRows.slice(0, 5));
    setMyRanking(filteredRows.find((row) => row.user_id === user!.id) ?? null);

    if (roundIds.length > 0) {
      const [{ data: recentData }, { data: upcomingData }] = await Promise.all([
        supabase.from('matches').select(matchSelect).in('round_id', roundIds).eq('status', 'encerrado').order('kickoff_at', { ascending: false }).limit(4),
        supabase.from('matches').select(matchSelect).in('round_id', roundIds).neq('status', 'encerrado').order('kickoff_at', { ascending: true }).limit(3),
      ]);

      const recent = ((recentData ?? []) as unknown as MatchRow[]).map((m) => ({
        ...m,
        group_code: m.group_id ? groupCodeMap.get(m.group_id) || null : null,
      }));
      const upcoming = ((upcomingData ?? []) as unknown as MatchRow[]).map((m) => ({
        ...m,
        group_code: m.group_id ? groupCodeMap.get(m.group_id) || null : null,
      }));

      setRecentMatches(recent);
      setUpcomingTodayMatches(upcoming);

      // Pre-populate liveMatchData for matches already ao_vivo on page load
      const initialLive: Record<string, { status: MatchRow['status']; home_score: number | null; away_score: number | null; time_detail: string | null }> = {};
      for (const m of [...recent, ...upcoming]) {
        if (m.status === 'ao_vivo') {
          initialLive[m.id] = { status: m.status, home_score: m.home_score, away_score: m.away_score, time_detail: (m as any).time_detail ?? null };
        }
      }
      if (Object.keys(initialLive).length > 0) {
        setLiveMatchData((prev) => ({ ...prev, ...initialLive }));
      }

      const matchIds = [...recent, ...upcoming].map((m) => m.id);
      if (matchIds.length > 0) {
        const { data: predsData } = await supabase
          .from('predictions')
          .select('match_id, home_guess, away_guess, points')
          .eq('pool_id', poolId!)
          .eq('user_id', user!.id)
          .in('match_id', matchIds);

        const map: Record<string, PredictionRow> = {};
        for (const p of (predsData ?? []) as PredictionRow[]) map[p.match_id] = p;
        setPredictionsByMatch(map);
      } else {
        setPredictionsByMatch({});
      }
    } else {
      setRecentMatches([]);
      setUpcomingTodayMatches([]);
      setPredictionsByMatch({});
    }

    setLoading(false);
  }

  function dayLabel(kickoffAt: string, status?: MatchRow['status']): { label: string; className: string } {
    if (status === 'ao_vivo') {
      return { label: 'Ao vivo', className: 'bg-red-100 text-red-700' };
    }

    const now = new Date();
    const kickoffDate = new Date(kickoffAt);

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const matchDay = new Date(
      kickoffDate.getFullYear(),
      kickoffDate.getMonth(),
      kickoffDate.getDate(),
    );
    const time = kickoffDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    if (matchDay.getTime() === today.getTime())
      return {
        label: `HOJE · ${time}`,
        className: 'bg-emerald-100 text-emerald-700',
      };
    if (matchDay.getTime() === tomorrow.getTime())
      return {
        label: `Amanhã · ${time}`,
        className: 'bg-sky-100 text-sky-700',
      };
    const date = kickoffDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    return {
      label: `${date} · ${time}`,
      className: 'bg-gray-100 text-gray-600',
    };
  }

  function findRoundName(roundId: string) {
    return rounds.find((r) => r.id === roundId)?.name ?? 'Rodada';
  }

  function formatGroupLabel(groupCode: string | null): string {
    if (!groupCode) return 'Mata-mata';
    return `Grupo ${groupCode.toUpperCase()}`;
  }

  function formatCutoffDate(cutoffAt: string): string {
    const now = new Date();
    const cutoffDate = new Date(cutoffAt);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const cutoffDay = new Date(
      cutoffDate.getFullYear(),
      cutoffDate.getMonth(),
      cutoffDate.getDate(),
    );

    const time = cutoffDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (cutoffDay.getTime() === today.getTime()) return `HOJE - ${time}`;
    if (cutoffDay.getTime() === tomorrow.getTime()) return `AMANHÃ - ${time}`;
    const date = cutoffDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    return `${date} - ${time}`;
  }

  function compactRoundLabel(label: string) {
    return label.replace(/rodada\s*(\d+)/gi, 'R$1');
  }

  function formatCents(cents: number) {
    return brlFormatter.format(cents / 100);
  }

  function closePastPredsModal() {
    setSelectedPastMatchId(null);
    setUserPreds([]);
  }

  async function savePredictionFromModal(home: number | null, away: number | null) {
    if (!poolId || !user || !selectedPastMatchId) return;

    // Only save if both sides are filled
    if (home === null || away === null) return;

    setSavingPrediction(true);

    const existing = predictionsByMatch[selectedPastMatchId];
    let saveError: any = null;

    if (existing) {
      const { error } = await (supabase.from('predictions') as any)
        .update({ home_guess: home, away_guess: away })
        .eq('pool_id', poolId)
        .eq('match_id', selectedPastMatchId)
        .eq('user_id', user.id);
      saveError = error;
    } else {
      const { error } = await (supabase.from('predictions') as any).insert({
        pool_id: poolId,
        match_id: selectedPastMatchId,
        user_id: user.id,
        home_guess: home,
        away_guess: away,
      });
      saveError = error;
    }

    if (saveError) {
      console.error('[BolaoPage] save prediction error', saveError);
      setSavingPrediction(false);
      return;
    }

    setPredictionsByMatch(p => ({
      ...p,
      [selectedPastMatchId]: { match_id: selectedPastMatchId, home_guess: home, away_guess: away, points: null }
    }));
    setSavingPrediction(false);
  }

  async function openPastPredsModal(matchId: string) {
    if (!poolId) return;

    const match = [...upcomingTodayMatches, ...recentMatches].find(
      (m) => m.id === matchId,
    );
    if (!match) return;

    // Detectar cenário
    const now = new Date();
    // Parse cutoff_at string robustamente - converter espaço para T se necessário
    const cutoffStr = match.cutoff_at.replace(' ', 'T');
    const cutoffTime = new Date(cutoffStr);
    const isOpen = cutoffTime > now;

    // Modo edição: palpites ainda abertos
    // Modo visualização: palpites fechados
    const mode = isOpen ? 'edit' : 'view';
    setModalMode(mode);

    setSelectedPastMatchId(matchId);
    setLoadingPastPreds(true);

    // Sempre carregar palpites para calcular percentuais
    const [predsRes, leaderboardRes, membersRes] = await Promise.all([
      supabase
        .from('predictions')
        .select('user_id, home_guess, away_guess, points')
        .eq('pool_id', poolId)
        .eq('match_id', matchId),
      supabase
        .from('leaderboard')
        .select('user_id, user_name')
        .eq('pool_id', poolId),
      supabase
        .from('pool_members')
        .select('user_id')
        .eq('pool_id', poolId),
    ]);

    const predsData = predsRes.data ?? [];

    const allMemberIds: string[] = (membersRes.data ?? [])
      .map((r: any) => r.user_id)
      .filter(Boolean);

    const nameByUserId = new Map<string, string>(
      (leaderboardRes.data ?? []).map((row: any) => [
        row.user_id,
        row.user_name,
      ]),
    );

    const predictedUserIds = Array.from(
      new Set(
        predsData
          .map((r: any) => r.user_id)
          .filter(Boolean),
      ),
    );

    if (predictedUserIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', predictedUserIds);

      for (const row of profilesData ?? []) {
        if (!nameByUserId.has((row as any).id) && (row as any).name) {
          nameByUserId.set((row as any).id, (row as any).name);
        }
      }
    }

    // Mapear palpites por user_id
    const predByUser = new Map(
      predsData.map((r: any) => [r.user_id, r]),
    );

    // Para cada membro, se não tem palpite, considera como 0x0
    const list: UserPred[] = allMemberIds.map((userId) => {
      const pred = predByUser.get(userId);
      return {
        user_id: userId,
        user_name:
          nameByUserId.get(userId) ??
          `Usuario ${String(userId).slice(0, 8)}`,
        home_guess: pred?.home_guess ?? 0,
        away_guess: pred?.away_guess ?? 0,
        points: pred?.points ?? null,
        predicted: pred !== undefined,
      };
    });

    // Em modo view, mostrar todos os palpites (incluindo os 0x0)
    // Em modo edit, mostrar palpites vazios (serão carregados dinamicamente)
    setUserPreds(mode === 'view' ? list : []);

    setLoadingPastPreds(false);
  }

  return (
    <div className="space-y-2">
      <div className="fade-rise relative overflow-hidden px-4 sm:px-0 pt-4 pb-4 sm:pt-4 sm:pb-4 bg-gradient-to-r from-brand-700 via-emerald-600 to-sky-600 rounded-3xl shadow-none -mt-4">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-6 right-6 h-16 w-16 rounded-full bg-white/10 blur-2xl" />
        </div>
        <div className="relative z-10 flex flex-row items-center justify-center gap-2 sm:gap-6 w-full">
          <img
            src={logoAlt}
            alt="Logo Bolão"
            className="h-14 sm:h-24 w-auto drop-shadow-md flex-shrink-0 mx-2 sm:mx-4"
          />
          <h1 className="flex-1 font-bebas text-xl sm:text-4xl tracking-widest uppercase text-white text-center drop-shadow-lg mx-2">
            {poolName}
          </h1>
          <img
            src={worldCup2026Logo}
            alt="Logo Copa do Mundo 2026"
            className="h-14 sm:h-24 w-auto drop-shadow-md flex-shrink-0 mx-2 sm:mx-4"
          />
        </div>
      </div>

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-2">
          <section className="lg:col-span-12 modern-card soft-hover fade-rise p-4 sm:p-5 border border-emerald-100 bg-slate-50">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center justify-between gap-2.5 sm:justify-start sm:shrink-0">
                <h2 className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-4 text-sm sm:text-base font-extrabold text-amber-600 shadow-sm">
                  <IconAward className="w-6 h-6 sm:w-7 sm:h-7 text-amber-600" />
                  Premiação
                  <IconAward className="w-6 h-6 sm:w-7 sm:h-7 text-amber-600" />
                </h2>
                <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-center min-w-[120px] sm:min-w-[180px] flex sm:flex-row items-center justify-center gap-2 sm:gap-2.5">
                  <IconParticipants className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-700 flex-shrink-0" />
                  <div className="flex flex-col items-start justify-center gap-0">
                    <p className="text-sm sm:text-base font-extrabold text-emerald-800">
                      {prizeOverview?.confirmed_count ?? 0}
                    </p>
                    <p className="text-xs sm:text-sm font-semibold text-emerald-700">
                      participantes
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-2 w-full sm:w-auto sm:ml-auto">
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-center min-w-[96px] sm:min-w-[88px]">
                  <p className="text-[9px] uppercase tracking-wide font-bold text-yellow-700">
                    1º · 70%
                  </p>
                  <p className="text-xs sm:text-sm font-extrabold text-yellow-800">
                    {formatCents(prizeOverview?.first_prize_cents ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center min-w-[96px] sm:min-w-[88px]">
                  <p className="text-[9px] uppercase tracking-wide font-bold text-slate-600">
                    2º · 20%
                  </p>
                  <p className="text-xs sm:text-sm font-extrabold text-slate-700">
                    {formatCents(prizeOverview?.second_prize_cents ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center min-w-[96px] sm:min-w-[88px]">
                  <p className="text-[9px] uppercase tracking-wide font-bold text-amber-700">
                    3º · 10%
                  </p>
                  <p className="text-xs sm:text-sm font-extrabold text-amber-800">
                    {formatCents(prizeOverview?.third_prize_cents ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="lg:col-span-6 modern-card soft-hover fade-rise p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-gray-800">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-950 text-white flex-shrink-0">
                  <IconUpcomingMatches className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
                Próximas partidas
              </h2>
              <Link
                to={`/bolao/${poolId}/palpites`}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-100 transition"
              >
                Meus Palpites
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3 w-3"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.22 4.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 010-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
            </div>
            <hr className="border-slate-100 mb-3" />
            {upcomingTodayMatches.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nenhuma próxima partida encontrada.
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingTodayMatches.map((match) => {
                  const pred = predictionsByMatch[match.id];
                  const live = liveMatchData[match.id];
                  const currentStatus = live?.status ?? match.status;
                  const currentHomeScore = live?.home_score ?? match.home_score;
                  const currentAwayScore = live?.away_score ?? match.away_score;
                  const currentTimeDetail = live?.time_detail ?? null;
                  const day = dayLabel(match.kickoff_at, currentStatus);
                  const hasPred =
                    pred?.home_guess !== undefined &&
                    pred?.away_guess !== undefined;
                  const canViewPreds = new Date(match.cutoff_at) <= new Date();

                  return (
                    <div
                      key={match.id}
                      className={`rounded-2xl border p-2.5 sm:p-3 transition ${
                        hasPred || canViewPreds
                          ? 'border-sky-200 bg-sky-50/60'
                          : 'border-rose-300 bg-rose-50/70 ring-1 ring-rose-200'
                      }`}
                    >
                      {/* meta */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-2 py-1">
                          <span className="sm:hidden text-[10px] font-semibold text-gray-700">
                            {compactRoundLabel(findRoundName(match.round_id))}
                          </span>
                          <span className="hidden sm:inline text-[10px] font-semibold text-gray-700">
                            {findRoundName(match.round_id)}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${day.className}`}
                        >
                          {currentStatus === 'ao_vivo' && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                            </span>
                          )}
                          {day.label}
                          {currentStatus === 'ao_vivo' && currentTimeDetail && (
                            <span className="font-normal opacity-80">· {({ HT: 'Intervalo', ET: 'Prorrogação', Pen: 'Pênaltis' } as Record<string, string>)[currentTimeDetail] ?? currentTimeDetail}</span>
                          )}
                        </span>
                        <div className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-2 py-1">
                          <span className="text-[10px] font-semibold text-gray-700">
                            {formatGroupLabel(match.group_code)}
                          </span>
                        </div>
                      </div>

                      <hr className="border-slate-200 mb-2" />

                      {/* times */}
                      <div className="flex items-center justify-center gap-2 mb-2.5">
                        <TeamWithFlag
                          name={match.home_team?.name}
                          flagCode={match.home_team?.flag_code}
                          size="sm"
                          compact
                          reverse
                          align="right"
                          className="flex-1 font-semibold text-gray-800 justify-end"
                        />
                        {currentStatus === 'ao_vivo' ? (
                          <span className="text-sm font-extrabold text-red-600 px-1 tabular-nums">
                            {currentHomeScore ?? 0} × {currentAwayScore ?? 0}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-slate-400 px-1">
                            ×
                          </span>
                        )}
                        <TeamWithFlag
                          name={match.away_team?.name}
                          flagCode={match.away_team?.flag_code}
                          size="sm"
                          compact
                          align="left"
                          className="flex-1 font-semibold text-gray-800"
                        />
                      </div>

                      {/* prediction area – main focus */}
                      {canViewPreds ? (
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <span className="text-[11px] text-sky-700 font-semibold text-right">
                            seu palpite:
                          </span>
                          <span className="inline-flex items-center rounded-lg border border-sky-300 bg-sky-100 px-2 py-0.5 text-sm font-extrabold text-sky-800">
                            {hasPred ? `${pred.home_guess}×${pred.away_guess}` : '0×0'}
                          </span>
                          <button
                            onClick={() => openPastPredsModal(match.id)}
                            className="justify-self-end inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-50 transition"
                          >
                            👁️ Palpites
                            <svg
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-3 w-3"
                            >
                              <path
                                fillRule="evenodd"
                                d="M7.22 4.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 010-1.06z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      ) : hasPred ? (
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <span className="text-[11px] text-sky-700 font-semibold text-right">
                            seu palpite:
                          </span>
                          <span className="inline-flex items-center rounded-lg border border-sky-300 bg-sky-100 px-2 py-0.5 text-sm font-extrabold text-sky-800">
                            {pred.home_guess}×{pred.away_guess}
                          </span>
                          <button
                            onClick={() => openPastPredsModal(match.id)}
                            className="justify-self-end inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-50 transition"
                          >
                            ✏️ Alterar
                            <svg
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-3 w-3"
                            >
                              <path
                                fillRule="evenodd"
                                d="M7.22 4.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 010-1.06z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => openPastPredsModal(match.id)}
                          className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold py-1.5 transition"
                        >
                          <span>⚠️</span> Dar palpite
                        </button>
                      )}

                      {new Date(match.cutoff_at) > new Date() && (
                        <p className="text-[9px] text-center text-slate-400 mt-2 font-semibold">
                          Fecha:{' '}
                          <span className="text-slate-700 font-bold">
                            {formatCutoffDate(match.cutoff_at)}
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="lg:col-span-6 modern-card soft-hover fade-rise p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-gray-800">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-950 text-white flex-shrink-0">
                  <IconFinishedMatches className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
                Partidas passadas
              </h2>
              <Link
                to={`/bolao/${poolId}/rodada/${recentMatches[recentMatches.length - 1]?.round_id ?? rounds[rounds.length - 1]?.id ?? ''}/palpites`}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-100 transition"
              >
                Ver resultados
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3 w-3"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.22 4.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 010-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
            </div>
            <hr className="border-slate-100 mb-3" />
            {recentMatches.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nenhuma partida encerrada ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {recentMatches.map((match, idx) => {
                  const pred = predictionsByMatch[match.id];
                  return (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => openPastPredsModal(match.id)}
                      className={`block w-full text-left${idx === 3 ? ' hidden lg:block' : ''}`}
                    >
                      <ResultMatchCard
                        kickoffAt={match.kickoff_at}
                        venue={match.venue}
                        metaPrefix={findRoundName(match.round_id)}
                        metaPrefixMobile={compactRoundLabel(
                          findRoundName(match.round_id),
                        )}
                        homeTeam={match.home_team}
                        awayTeam={match.away_team}
                        homeScore={match.home_score}
                        awayScore={match.away_score}
                        canViewPreds
                        isClosed={match.status === 'encerrado'}
                        myPrediction={pred}
                        className="hover:border-brand-200"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="lg:col-span-12 modern-card soft-hover fade-rise p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-gray-800">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-950 text-white flex-shrink-0">
                    <IconMyPredictions className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </span>
                  Meus Palpites
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Classificação, grupos e mata-mata
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  to={`/bolao/${poolId}/palpites`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-950 hover:bg-blue-900 text-white text-xs font-semibold transition"
                >
                  Abrir
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3 w-3"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.22 4.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 010-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </section>

          <section className="lg:col-span-12 modern-card soft-hover fade-rise p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-gray-800">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-950 text-white flex-shrink-0">
                  <IconRanking className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
                Ranking
              </h2>
              <Link
                to={`/bolao/${poolId}/ranking`}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-100 transition"
              >
                Ver completo
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3 w-3"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.22 4.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 010-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
            </div>
            <hr className="border-slate-100 mb-3" />
            {topRanking.length === 0 ? (
              <p className="text-sm text-gray-400">Sem ranking ainda.</p>
            ) : (
              <div className="space-y-2">
                {topRanking.map((row) => {
                  const isTop = row.rank <= 3;
                  const medal =
                    row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : '🥉';
                  const outerClass = isTop
                    ? row.rank === 1
                      ? 'bg-yellow-50 border border-yellow-200 shadow-md'
                      : row.rank === 2
                        ? 'bg-slate-50 border border-gray-200 shadow-sm'
                        : 'bg-amber-50 border border-amber-200 shadow-sm'
                    : 'bg-gradient-to-r from-slate-50 to-white border border-gray-100';

                  return (
                    <div
                      key={row.user_id}
                      className={`flex items-center justify-between rounded-xl px-2 py-2 ${outerClass}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={
                            isTop
                              ? 'text-xl sm:text-2xl shrink-0'
                              : 'text-base shrink-0'
                          }
                        >
                          {isTop ? medal : `#${row.rank}`}
                        </span>
                        <p
                          className={
                            isTop
                              ? 'text-sm sm:text-sm font-extrabold text-gray-800 truncate'
                              : 'text-sm text-gray-700 font-medium truncate'
                          }
                        >
                          {row.user_name}
                          {row.user_id === user?.id && (
                            <span
                              title="Você"
                              aria-label="Você (esta é a sua conta)"
                              className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-normal bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm"
                            >
                              você
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <span
                          className={
                            isTop
                              ? 'inline-flex items-center px-3 py-1 rounded-full font-bold text-base sm:text-lg ' +
                                (row.total_points >= 100
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-white text-brand-700 border border-gray-100')
                              : 'inline-flex items-center px-2 py-0.5 rounded-full font-bold text-xs ' +
                                (row.total_points >= 100
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-white text-brand-700 border border-gray-100')
                          }
                        >
                          {row.total_points}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {myRanking && !topRanking.some((r) => r.user_id === user?.id) && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between rounded-xl px-2 py-2 bg-gradient-to-r from-brand-50 to-sky-50 border border-brand-100">
                  <div className="flex items-center gap-2">
                    <span className="text-base">#{myRanking.rank}</span>
                    <p className="text-sm font-bold text-brand-700 truncate">
                      {myRanking.user_name}{' '}
                      <span
                        title="Você"
                        aria-label="Você (esta é a sua conta)"
                        className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-normal bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm"
                      >
                        você
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-xs bg-white text-brand-700 border border-gray-100">
                      {myRanking.total_points}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {modalMode === 'edit' ? (
        <PredictionEditModal
          open={Boolean(selectedPastMatchId)}
          match={
            selectedPastMatchId
              ? ((recentMatches.find((m) => m.id === selectedPastMatchId) ||
                  upcomingTodayMatches.find(
                    (m) => m.id === selectedPastMatchId,
                  )) ??
                null)
              : null
          }
          onClose={closePastPredsModal}
          myPrediction={
            selectedPastMatchId && predictionsByMatch[selectedPastMatchId]
              ? {
                  home_guess: predictionsByMatch[selectedPastMatchId].home_guess,
                  away_guess: predictionsByMatch[selectedPastMatchId].away_guess,
                }
              : null
          }
          isSaving={savingPrediction}
          onPredictionChange={savePredictionFromModal}
          onSaveSuccess={() => {}}
        />
      ) : (
        <MatchPredictionsModal
          open={Boolean(selectedPastMatchId)}
          match={
            selectedPastMatchId
              ? ((recentMatches.find((m) => m.id === selectedPastMatchId) ||
                  upcomingTodayMatches.find(
                    (m) => m.id === selectedPastMatchId,
                  )) ??
                null)
              : null
          }
          userPreds={userPreds}
          loadingPreds={loadingPastPreds}
          onClose={closePastPredsModal}
          currentUserId={user?.id ?? null}
        />
      )}
    </div>
  );
}
