import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  IconFinalStandings,
  IconGroupPhase,
  IconUpcomingMatches,
  IconEliminationPhase,
  IconMyPredictions,
} from '@/components/Icons';

interface Round {
  id: string;
  name: string;
  phase: string;
}

const PHASE_LABELS: Record<string, string> = {
  dezesseis_avos: 'Dezesseistavas de Final',
  oitavas: 'Oitavas de Final',
  quartas: 'Quartas de Final',
  semi: 'Semifinal',
  terceiro_lugar: 'Disputa de 3o Lugar',
  final: 'Final',
};

export default function MeusPalpitesPage() {
  const { poolId } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [groupRounds, setGroupRounds] = useState<Round[]>([]);
  const [otherRounds, setOtherRounds] = useState<Record<string, Round[]>>({});
  const [specialDeadline, setSpecialDeadline] = useState<string | null>(null);
  // removido: groupPeriod
  const [roundPeriods, setRoundPeriods] = useState<
    Record<string, { start: string | null; end: string | null }>
  >({});
  // removido: groupStatus
  const [roundProgress, setRoundProgress] = useState<
    Record<string, { filled: number; total: number }>
  >({});
  const [groupClassificationProgress, setGroupClassificationProgress] =
    useState<{ filled: number; total: number }>({
      filled: 0,
      total: 0,
    });
  const [podiumDeadline, setPodiumDeadline] = useState<string | null>(null);
  const [podiumProgress, setPodiumProgress] = useState<{
    filled: number;
    total: number;
  }>({
    filled: 0,
    total: 1,
  });

  useEffect(() => {
    if (poolId && user) {
      loadData();
    }
  }, [poolId, user]);

  async function loadData() {
    if (!poolId || !user) return;
    setLoading(true);

    const [{ data: poolData }, { data: roundsData }] = await Promise.all([
      supabase
        .from('pools')
        .select('group_predictions_cutoff_at, podium_predictions_cutoff_at')
        .eq('id', poolId)
        .single(),
      supabase
        .from('rounds')
        .select('id, name, phase, created_at')
        .eq('pool_id', poolId)
        .order('created_at', { ascending: true }),
    ]);

    const rounds = (roundsData ?? []) as Array<Round & { created_at: string }>;
    const groups = rounds
      .filter((round) => round.phase === 'grupos')
      .map(({ id, name, phase }) => ({ id, name, phase }));
    setGroupRounds(groups);
    const groupRoundIds = new Set(groups.map((round) => round.id));

    const groupedOthers = rounds
      .filter((round) => round.phase !== 'grupos')
      .reduce<Record<string, Round[]>>((acc, round) => {
        acc[round.phase] = acc[round.phase] ?? [];
        acc[round.phase].push({
          id: round.id,
          name: round.name,
          phase: round.phase,
        });
        return acc;
      }, {});

    setOtherRounds(groupedOthers);

    const roundIds = rounds.map((round) => round.id);
    let matchesData: Array<{
      id: string;
      round_id: string;
      group_id: string | null;
      cutoff_at: string;
      kickoff_at?: string;
      status?: string;
    }> = [];

    if (roundIds.length > 0) {
      const { data } = await supabase
        .from('matches')
        .select('id, round_id, group_id, cutoff_at, kickoff_at, status')
        .in('round_id', roundIds);

      matchesData = (data ?? []) as Array<{
        id: string;
        round_id: string;
        group_id: string | null;
        cutoff_at: string;
        kickoff_at?: string;
        status?: string;
      }>;
    }
    // Período e status para classificação de grupos
    // removido: groupMatches
    // removido: groupKickoffs e groupCutoffs
    // removido: setGroupPeriod

    // Status para classificação de grupos
    // removido: groupStatusValue e lógica associada
    // removido: setGroupStatus

    // Período e status para cada rodada
    const nextRoundPeriods: Record<
      string,
      { start: string | null; end: string | null }
    > = {};
    const nextRoundStatus: Record<string, string> = {};
    const now = new Date();
    for (const round of rounds) {
      const roundMatches = matchesData.filter((m) => m.round_id === round.id);
      const kickoffs = roundMatches
        .map((m) => m.kickoff_at)
        .filter(Boolean)
        .sort();
      const cutoffs = roundMatches
        .map((m) => m.cutoff_at)
        .filter(Boolean)
        .sort();
      nextRoundPeriods[round.id] = {
        start: kickoffs[0] ?? null,
        end: cutoffs[cutoffs.length - 1] ?? null,
      };
      // Status lógica
      let status = 'Pendente';
      if (kickoffs.length && cutoffs.length) {
        const start = new Date(kickoffs[0]);
        const end = new Date(cutoffs[cutoffs.length - 1]);
        if (now < start) status = 'Em aberto';
        else if (now >= start && now <= end) status = 'Em andamento';
        else if (now > end) status = 'Encerrada';
      }
      nextRoundStatus[round.id] = status;
    }
    setRoundPeriods(nextRoundPeriods);

    const totalByRound = matchesData.reduce<Record<string, number>>(
      (acc, match) => {
        acc[match.round_id] = (acc[match.round_id] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const matchIds = matchesData.map((match) => match.id);
    const filledByRound: Record<string, number> = {};

    if (matchIds.length > 0) {
      const { data: predictionsData } = await supabase
        .from('predictions')
        .select(
          'match_id, home_guess, away_guess, match:matches!predictions_match_id_fkey(round_id)',
        )
        .eq('pool_id', poolId)
        .eq('user_id', user.id)
        .in('match_id', matchIds);

      for (const row of (predictionsData ?? []) as any[]) {
        if (row.home_guess === null || row.away_guess === null) continue;
        const roundId = row.match?.round_id as string | undefined;
        if (!roundId) continue;
        filledByRound[roundId] = (filledByRound[roundId] ?? 0) + 1;
      }
    }

    const nextRoundProgress: Record<string, { filled: number; total: number }> =
      {};
    for (const round of rounds) {
      nextRoundProgress[round.id] = {
        filled: filledByRound[round.id] ?? 0,
        total: totalByRound[round.id] ?? 0,
      };
    }
    setRoundProgress(nextRoundProgress);

    const groupIds = new Set(
      matchesData
        .filter(
          (match) =>
            groupRoundIds.has(match.round_id) && Boolean(match.group_id),
        )
        .map((match) => match.group_id as string),
    );

    let filledGroups = 0;
    if (groupIds.size > 0) {
      const { data: gpData } = await supabase
        .from('group_predictions')
        .select('group_id, first_id, second_id')
        .eq('pool_id', poolId)
        .eq('user_id', user.id);

      filledGroups = (
        (gpData ?? []) as Array<{
          group_id: string;
          first_id: string | null;
          second_id: string | null;
        }>
      ).filter(
        (row) =>
          groupIds.has(row.group_id) &&
          Boolean(row.first_id) &&
          Boolean(row.second_id),
      ).length;
    }

    setGroupClassificationProgress({
      filled: filledGroups,
      total: groupIds.size,
    });

    const { data: podiumData } = await supabase
      .from('podium_predictions')
      .select('champion_id, vice_id, third_id')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .maybeSingle();

    const podiumFilled = Boolean(
      (podiumData as any)?.champion_id &&
      (podiumData as any)?.vice_id &&
      (podiumData as any)?.third_id,
    );
    setPodiumProgress({
      filled: podiumFilled ? 1 : 0,
      total: 1,
    });

    const manualDeadline =
      (poolData as any)?.group_predictions_cutoff_at ?? null;
    if (manualDeadline) {
      setSpecialDeadline(manualDeadline);
      setPodiumDeadline(manualDeadline);
      setLoading(false);
      return;
    }

    if (groupRoundIds.size > 0) {
      const firstCutoff =
        matchesData
          .filter((match) => groupRoundIds.has(match.round_id))
          .map((match) => match.cutoff_at)
          .filter(Boolean)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ??
        null;

      setSpecialDeadline(firstCutoff);
      setPodiumDeadline(firstCutoff);
    } else {
      setSpecialDeadline(null);
      setPodiumDeadline(null);
    }

    setLoading(false);
  }

  const orderedOtherPhases = useMemo(() => {
    const phaseOrder = [
      'final',
      'terceiro_lugar',
      'semi',
      'quartas',
      'oitavas',
      'dezesseis_avos',
    ];
    const phases = Object.keys(otherRounds);
    return phases.sort((a, b) => {
      const ia = phaseOrder.indexOf(a);
      const ib = phaseOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [otherRounds]);

  const formatDateNoYear = (date: string) => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  };

  const progressBadge = (filled: number, total: number) => (
    <span
      className={`inline-flex items-center rounded-full text-xs font-semibold px-2 py-0.5 ${filled === total && total > 0 ? 'bg-brand-100 text-brand-700' : 'bg-blue-50 text-blue-600'}`}
    >
      {filled}/{total} palpites
    </span>
  );

  const now = new Date();
  const isRoundClosed = (roundId: string) => {
    const end = roundPeriods[roundId]?.end;
    return end ? new Date(end) < now : false;
  };
  const groupsClosed =
    !loading &&
    groupRounds.length > 0 &&
    groupRounds.every((r) => isRoundClosed(r.id));
  const classificationClosed =
    !loading && Boolean(specialDeadline) && new Date(specialDeadline!) < now;
  const eliminationActive =
    !loading &&
    orderedOtherPhases.some((phase) =>
      (otherRounds[phase] ?? []).some((r) => !isRoundClosed(r.id)),
    );

  return (
    <div className="space-y-6">
      <div>
        <BackButton
          to={poolId ? `/bolao/${poolId}` : '/dashboard'}
          label="Voltar ao Bolão"
        />
      </div>

      <section className="relative px-0.5 py-0.5">
        <div className="border-b border-slate-200 pb-1.5">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-950 text-white flex-shrink-0">
              <IconMyPredictions className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800 leading-tight">
              Meus Palpites
            </h1>
          </div>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-600">
            Navegue por tipo de palpite, fase e rodada.
          </p>
        </div>
      </section>

      {/* Outras Fases */}
      <section
        className={`modern-card p-4 sm:p-5 space-y-3 ${eliminationActive ? 'ring-1 ring-brand-300' : ''}`}
      >
        <h2 className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-700 uppercase tracking-wide">
          <IconEliminationPhase className="w-4 h-4 text-blue-950" />
          Fase Eliminatória
          {eliminationActive && (
            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[9px] font-bold px-1.5 py-0.5 normal-case tracking-normal">
              Atual
            </span>
          )}
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400">Carregando fases...</p>
        ) : orderedOtherPhases.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nenhuma fase eliminatória cadastrada.
          </p>
        ) : (
          <div className="space-y-4">
            {orderedOtherPhases.map((phase) => (
              <div key={phase} className="space-y-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide sm:tracking-widest px-1 break-words">
                  {PHASE_LABELS[phase] ?? phase}
                </h3>
                {otherRounds[phase].map((round) => (
                  <Link
                    key={round.id}
                    to={`/bolao/${poolId}/rodada/${round.id}`}
                    className="flex items-center justify-between rounded-xl border border-gray-300 bg-white pl-3 pr-6 py-4 hover:bg-slate-50 hover:border-gray-400 transition shadow-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <IconUpcomingMatches className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <p className="text-xs font-semibold text-gray-800 min-w-0">
                        {round.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      {progressBadge(
                        roundProgress[round.id]?.filled ?? 0,
                        roundProgress[round.id]?.total ?? 0,
                      )}
                      <span className="text-gray-400 text-xl font-light">
                        ›
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fase de Grupos */}
      <section
        className={`modern-card p-4 sm:p-5 space-y-3 ${groupsClosed ? 'bg-slate-50' : ''}`}
      >
        <h2
          className={`inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide ${groupsClosed ? 'text-gray-400' : 'text-gray-700'}`}
        >
          <IconGroupPhase
            className={`w-4 h-4 ${groupsClosed ? 'text-gray-400' : 'text-blue-950'}`}
          />
          Fase de Grupos
          {groupsClosed && (
            <span className="inline-flex items-center rounded-full bg-slate-200 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 normal-case tracking-normal">
              Encerrado
            </span>
          )}
        </h2>
        <p className="text-xs text-gray-400">
          Prazo fecha 30 minutos antes de cada partida.
        </p>
        {loading ? (
          <p className="text-sm text-gray-400">Carregando rodadas...</p>
        ) : groupRounds.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma rodada cadastrada.</p>
        ) : (
          <div className="space-y-2">
            {groupRounds.map((round, index) => (
              <Link
                key={round.id}
                to={`/bolao/${poolId}/rodada/${round.id}`}
                className="flex items-center justify-between rounded-xl border border-gray-300 bg-white pl-3 pr-6 py-4 hover:bg-slate-50 hover:border-gray-400 transition shadow-sm"
              >
                <div className="min-w-0 flex-1 flex items-start gap-2">
                  <IconUpcomingMatches className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-gray-800">
                    Rodada {index + 1}
                    {roundPeriods[round.id]?.start &&
                      roundPeriods[round.id]?.end && (
                        <span className="hidden sm:inline text-xs font-normal text-gray-400 ml-2">
                          {formatDateNoYear(roundPeriods[round.id].start!)}–
                          {formatDateNoYear(roundPeriods[round.id].end!)}
                        </span>
                      )}
                  </p>
                  {roundPeriods[round.id]?.start &&
                    roundPeriods[round.id]?.end && (
                      <p className="sm:hidden text-[10px] text-gray-400 mt-0.5">
                        {formatDateNoYear(roundPeriods[round.id].start!)}–
                        {formatDateNoYear(roundPeriods[round.id].end!)}
                      </p>
                    )}
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  {progressBadge(
                    roundProgress[round.id]?.filled ?? 0,
                    roundProgress[round.id]?.total ?? 0,
                  )}
                  <span className="text-gray-400 text-xl font-light">›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Palpites de classificacao */}
      <section
        className={`modern-card p-4 sm:p-5 space-y-3 ${classificationClosed ? 'bg-slate-50' : ''}`}
      >
        <h2
          className={`inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide ${classificationClosed ? 'text-gray-400' : 'text-gray-700'}`}
        >
          <IconFinalStandings
            className={`w-4 h-4 ${classificationClosed ? 'text-gray-400' : 'text-blue-950'}`}
          />
          Palpites de Classificação
          {classificationClosed && (
            <span className="inline-flex items-center rounded-full bg-slate-200 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 normal-case tracking-normal">
              Encerrado
            </span>
          )}
        </h2>
        {(specialDeadline ?? podiumDeadline) && (
          <p className="text-xs text-gray-400">
            Prazo fecha em{' '}
            {(() => {
              const d = new Date(specialDeadline ?? podiumDeadline!);
              return `${d.toLocaleDateString('pt-BR', { dateStyle: 'short' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            })()}
          </p>
        )}
        <Link
          to={poolId ? `/bolao/${poolId}/classificacao` : '/dashboard'}
          className="flex items-center justify-between rounded-xl border border-gray-300 bg-white px-4 py-3 hover:bg-slate-50 hover:border-gray-400 transition shadow-sm"
        >
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <IconGroupPhase className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <p className="text-xs font-semibold text-gray-800">
              Classificação de grupos (1º e 2º)
            </p>
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            {progressBadge(
              groupClassificationProgress.filled,
              groupClassificationProgress.total,
            )}
            <span className="text-gray-400 text-xl font-light">›</span>
          </div>
        </Link>
        <Link
          to={poolId ? `/bolao/${poolId}/colocados` : '/dashboard'}
          className="flex items-center justify-between rounded-xl border border-gray-300 bg-white px-4 py-3 hover:bg-slate-50 hover:border-gray-400 transition shadow-sm"
        >
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <IconFinalStandings className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <p className="text-xs font-semibold text-gray-800">
              Colocados finais (Campeão, Vice e 3º Lugar)
            </p>
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            {progressBadge(podiumProgress.filled, podiumProgress.total)}
            <span className="text-gray-400 text-xl font-light">›</span>
          </div>
        </Link>
      </section>
    </div>
  );
}
