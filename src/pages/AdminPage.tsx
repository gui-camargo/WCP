import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { IconSettings } from '@/components/Icons';
import TeamWithFlag from '@/components/TeamWithFlag';
import SnapshotPredictions from '@/components/SnapshotPredictions';
import SnapshotGroupPredictions, { type GroupPredRow } from '@/components/SnapshotGroupPredictions';
import SnapshotPodiumPredictions, { type PodiumPredRow } from '@/components/SnapshotPodiumPredictions';
import { exportSnapshotAsImage, exportElementAsImage } from '@/lib/export-snapshot';

const PHASE_LABELS: Record<string, string> = {
  grupos: 'Fase de Grupos',
  dezesseis_avos: 'Dezesseistavas de Final',
  oitavas: 'Oitavas de Final',
  quartas: 'Quartas de Final',
  semi: 'Semifinal',
  terceiro_lugar: 'Disputa de 3º',
  final: 'Final',
};

interface Member {
  user_id: string;
  name: string;
  email: string;
  is_admin: boolean;
}

interface PaymentRow {
  user_id: string;
  name: string;
  email: string;
  is_admin: boolean;
  amount_cents: number;
  status: 'pendente' | 'confirmado' | 'rejeitado';
  paid_at: string | null;
  confirmed_at: string | null;
  notes: string | null;
}

interface PaymentDraft {
  status: 'pendente' | 'confirmado' | 'rejeitado';
  notes: string;
}

interface Round {
  id: string;
  name: string;
  phase: string;
}

interface Match {
  id: string;
  group: { code: string } | null;
  kickoff_at: string;
  venue: string;
  cutoff_at: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team: { name: string; flag_code: string | null } | null;
  away_team: { name: string; flag_code: string | null } | null;
}

interface ResultDraft {
  home: string;
  away: string;
  cutoffAt: string;
}

interface GroupStandingDraft {
  first_id: string;
  second_id: string;
}

interface PodiumStandingDraft {
  champion_id: string;
  vice_id: string;
  third_id: string;
}

interface TeamOption {
  id: string;
  name: string;
  flag_code: string | null;
}

interface GroupSection {
  id: string;
  code: string;
  teams: { id: string; name: string; flag_code: string | null }[];
}

interface Prediction {
  user_id: string;
  user_name: string;
  home_guess: number;
  away_guess: number;
  points: number | null;
  current_rank?: number | null;
}

function toDateTimeLocalValue(dbValue: string | null | undefined) {
  if (!dbValue) return '';
  return dbValue.replace(' ', 'T').slice(0, 16);
}

export default function AdminPage() {
  const { poolId } = useParams();
  const { profile } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [email, setEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberMsg, setAddMemberMsg] = useState('');
  const [newRound, setNewRound] = useState({ name: '', phase: 'grupos' });
  const [addingRound, setAddingRound] = useState(false);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>(
    {},
  );
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [savingMatch, setSavingMatch] = useState<Record<string, boolean>>({});
  const [retakingSnapshot, setRetakingSnapshot] = useState<Record<string, boolean>>({});
  const [matchMessage, setMatchMessage] = useState<Record<string, string>>({});
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pendente' | 'encerrado'
  >('all');
  const [isGlobalDefault, setIsGlobalDefault] = useState(false);
  const [updatingDefault, setUpdatingDefault] = useState(false);
  const [defaultMessage, setDefaultMessage] = useState('');
  const [groupPredictionsCutoffDraft, setGroupPredictionsCutoffDraft] =
    useState('');
  const [savingGroupPredictionsCutoff, setSavingGroupPredictionsCutoff] =
    useState(false);
  const [groupPredictionsCutoffMessage, setGroupPredictionsCutoffMessage] =
    useState('');
  const [groupSections, setGroupSections] = useState<GroupSection[]>([]);
  const [groupStandingsDrafts, setGroupStandingsDrafts] = useState<
    Record<string, GroupStandingDraft>
  >({});
  const [savingGroupStandingByGroup, setSavingGroupStandingByGroup] = useState<
    Record<string, boolean>
  >({});
  const [groupStandingMsgByGroup, setGroupStandingMsgByGroup] = useState<
    Record<string, string>
  >({});
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([]);
  const [paymentDrafts, setPaymentDrafts] = useState<
    Record<string, PaymentDraft>
  >({});
  const [savingPaymentByUser, setSavingPaymentByUser] = useState<
    Record<string, boolean>
  >({});
  const [savingAdminByUser, setSavingAdminByUser] = useState<
    Record<string, boolean>
  >({});
  const [nameDraftByUser, setNameDraftByUser] = useState<
    Record<string, string>
  >({});
  const [savingNameByUser, setSavingNameByUser] = useState<
    Record<string, boolean>
  >({});
  const [editingNameByUser, setEditingNameByUser] = useState<
    Record<string, boolean>
  >({});
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'geral' | 'classificacao' | 'pessoas' | 'jogos'
  >('jogos');

  const [predictionsByMatch, setPredictionsByMatch] = useState<
    Record<string, Prediction[]>
  >({});
  const [loadingPredictions, setLoadingPredictions] = useState<
    Record<string, boolean>
  >({});
  const [openSnapshotMatch, setOpenSnapshotMatch] = useState<string | null>(
    null,
  );
  const [snapshotRankingDeltas, setSnapshotRankingDeltas] = useState<Map<string, { rank_after: number; position_delta: number | null }>>(new Map());
  const [exportingImage, setExportingImage] = useState(false);
  const [podiumStandingDraft, setPodiumStandingDraft] = useState<PodiumStandingDraft>({ champion_id: '', vice_id: '', third_id: '' });
  const [savingPodiumStanding, setSavingPodiumStanding] = useState(false);
  const [podiumStandingMsg, setPodiumStandingMsg] = useState('');
  const [allTeams, setAllTeams] = useState<TeamOption[]>([]);
  const [podiumPredsForSnapshot, setPodiumPredsForSnapshot] = useState<PodiumPredRow[] | null>(null);
  const [loadingPodiumPredsSnapshot, setLoadingPodiumPredsSnapshot] = useState(false);
  const [openSnapshotPodium, setOpenSnapshotPodium] = useState(false);
  const [exportingPodiumImage, setExportingPodiumImage] = useState(false);
  const [groupPredsForSnapshot, setGroupPredsForSnapshot] = useState<Record<string, GroupPredRow[]>>({});
  const [loadingGroupPredsSnapshot, setLoadingGroupPredsSnapshot] = useState<Record<string, boolean>>({});
  const [openSnapshotGroup, setOpenSnapshotGroup] = useState<string | null>(null);
  const [exportingGroupImage, setExportingGroupImage] = useState(false);
  const [syncingExternalIds, setSyncingExternalIds] = useState(false);
  const [syncExternalIdsResult, setSyncExternalIdsResult] = useState<
    string | null
  >(null);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [downloadingGroupReport, setDownloadingGroupReport] = useState(false);
  const [downloadingPodiumReport, setDownloadingPodiumReport] = useState(false);
  const [allTeamsList, setAllTeamsList] = useState<TeamOption[]>([]);
  const [newMatch, setNewMatch] = useState({ home_team_id: '', away_team_id: '', kickoff_at: '', venue: '' });
  const [addingMatch, setAddingMatch] = useState(false);

  const paidMembersCount = paymentRows.filter(
    (p) => p.status === 'confirmado',
  ).length;
  const pendingMembersCount = paymentRows.filter(
    (p) => p.status !== 'confirmado',
  ).length;

  const availableGroups = Array.from(
    new Set(
      matches
        .map((m) => m.group?.code)
        .filter((code): code is string => Boolean(code)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const filteredMatches = (() => {
    const filtered = matches.filter((m) => {
      const groupOk = groupFilter === 'all' || m.group?.code === groupFilter;
      const statusOk = statusFilter === 'all' || m.status === statusFilter;
      return groupOk && statusOk;
    });

    // Days where every match is encerrado go to the end of the list
    const allClosedByDay = new Map<string, boolean>();
    for (const m of matches) {
      const day = m.kickoff_at.slice(0, 10);
      allClosedByDay.set(day, (allClosedByDay.get(day) ?? true) && m.status === 'encerrado');
    }

    return filtered.sort((a, b) => {
      const dayA = a.kickoff_at.slice(0, 10);
      const dayB = b.kickoff_at.slice(0, 10);
      const closedA = allClosedByDay.get(dayA) ?? false;
      const closedB = allClosedByDay.get(dayB) ?? false;
      if (closedA !== closedB) return closedA ? 1 : -1;
      const ga = a.group?.code ?? 'ZZ';
      const gb = b.group?.code ?? 'ZZ';
      if (ga !== gb) return ga.localeCompare(gb);
      return new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime();
    });
  })();

  const sortedPaymentRows = [...paymentRows].sort((a, b) => {
    const statusOrder: Record<string, number> = {
      pendente: 0,
      confirmado: 1,
      rejeitado: 2,
    };
    return (statusOrder[a.status] ?? 999) - (statusOrder[b.status] ?? 999);
  });

  useEffect(() => {
    if (poolId) loadData();
  }, [poolId]);

  useEffect(() => {
    if (!openSnapshotMatch) { setSnapshotRankingDeltas(new Map()); return }
    const match = matches.find((m) => m.id === openSnapshotMatch)
    if (match?.status !== 'encerrado') return
    ;(supabase as any).rpc('get_match_ranking_delta', { p_match_id: openSnapshotMatch }).then(({ data }: any) => {
      const map = new Map<string, { rank_after: number; position_delta: number | null }>()
      for (const row of data ?? []) map.set(row.user_id, { rank_after: row.rank_after, position_delta: row.position_delta })
      setSnapshotRankingDeltas(map)
    })
  }, [openSnapshotMatch]);

  useEffect(() => {
    if (selectedRoundId) loadMatches(selectedRoundId);
    else {
      setMatches([]);
      setResultDrafts({});
      setMatchMessage({});
      setGroupFilter('all');
      setStatusFilter('all');
    }
  }, [selectedRoundId]);

  async function loadData() {
    const { data: poolData } = await supabase
      .from('pools')
      .select('is_default_global, group_predictions_cutoff_at')
      .eq('id', poolId!)
      .single();

    setIsGlobalDefault(Boolean((poolData as any)?.is_default_global));
    setGroupPredictionsCutoffDraft(
      toDateTimeLocalValue(
        (poolData as any)?.group_predictions_cutoff_at ?? null,
      ),
    );

    const { data: memberData } = await supabase
      .from('pool_members')
      .select('user_id')
      .eq('pool_id', poolId!);

    const userIds = (memberData ?? []).map((m: any) => m.user_id);
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, email, is_admin')
        .in('id', userIds);

      const byId = new Map((profilesData ?? []).map((p: any) => [p.id, p]));
      const merged: Member[] = userIds.map((id: string) => {
        const p = byId.get(id);
        return {
          user_id: id,
          name: p?.name ?? '(sem nome)',
          email: p?.email ?? '(sem email)',
          is_admin: Boolean(p?.is_admin),
        };
      });
      setMembers(merged);
      await loadPayments(merged);
    } else {
      setMembers([]);
      setPaymentRows([]);
      setPaymentDrafts({});
    }

    const { data: roundData } = await supabase
      .from('rounds')
      .select('*')
      .eq('pool_id', poolId!)
      .order('created_at');
    const nextRounds = (roundData ?? []) as Round[];
    setRounds(nextRounds);

    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name, flag_code')
      .neq('name', 'A Definir')
      .order('name');
    setAllTeamsList((teamsData ?? []) as TeamOption[]);

    if (nextRounds.length === 0) {
      setSelectedRoundId('');
    } else if (
      !selectedRoundId ||
      !nextRounds.some((r) => r.id === selectedRoundId)
    ) {
      setSelectedRoundId(nextRounds[0].id);
    }

    await loadGroupStandings(nextRounds);
  }

  async function loadPayments(membersList: Member[]) {
    if (!poolId) return;

    const userIds = membersList.map((m) => m.user_id);
    if (userIds.length === 0) {
      setPaymentRows([]);
      setPaymentDrafts({});
      return;
    }

    setLoadingPayments(true);

    const { data, error } = await (supabase.from('payments') as any)
      .select('user_id, amount_cents, status, paid_at, confirmed_at, notes')
      .eq('pool_id', poolId)
      .in('user_id', userIds);

    const paymentsByUser = new Map<string, any>(
      (data ?? []).map((row: any) => [row.user_id, row]),
    );

    const rows: PaymentRow[] = membersList.map((member) => {
      const payment = paymentsByUser.get(member.user_id);
      return {
        user_id: member.user_id,
        name: member.name,
        email: member.email,
        is_admin: member.is_admin,
        amount_cents: payment?.amount_cents ?? 10000,
        status: (payment?.status ?? 'pendente') as
          | 'pendente'
          | 'confirmado'
          | 'rejeitado',
        paid_at: payment?.paid_at ?? null,
        confirmed_at: payment?.confirmed_at ?? null,
        notes: payment?.notes ?? null,
      };
    });

    if (error) {
      console.error('[Admin] loadPayments:error', { message: error.message });
    }

    setPaymentRows(rows);
    setEditingNameByUser({});
    setNameDraftByUser(
      rows.reduce(
        (acc, row) => {
          acc[row.user_id] = row.name;
          return acc;
        },
        {} as Record<string, string>,
      ),
    );
    setPaymentDrafts(
      rows.reduce(
        (acc, row) => {
          acc[row.user_id] = {
            status: row.status,
            notes: row.notes ?? '',
          };
          return acc;
        },
        {} as Record<string, PaymentDraft>,
      ),
    );
    setLoadingPayments(false);
  }

  function updatePaymentDraft(userId: string, patch: Partial<PaymentDraft>) {
    setPaymentDrafts((prev) => ({
      ...prev,
      [userId]: {
        status: patch.status ?? prev[userId]?.status ?? 'pendente',
        notes: patch.notes ?? prev[userId]?.notes ?? '',
      },
    }));
  }

  async function saveMemberPayment(
    userId: string,
    forcedStatus?: 'pendente' | 'confirmado' | 'rejeitado',
  ) {
    if (!poolId || !profile) return;

    const draft = paymentDrafts[userId];
    const nextStatus = forcedStatus ?? draft?.status;
    if (!nextStatus) return;

    setSavingPaymentByUser((prev) => ({ ...prev, [userId]: true }));

    const nowIso = new Date().toISOString();
    const paidAt = nextStatus === 'confirmado' ? nowIso : null;
    const confirmedAt = nextStatus === 'pendente' ? null : nowIso;
    const confirmedBy = nextStatus === 'pendente' ? null : profile.id;

    const { error } = await (supabase.from('payments') as any).upsert(
      {
        pool_id: poolId,
        user_id: userId,
        amount_cents: 10000,
        status: nextStatus,
        paid_at: paidAt,
        confirmed_at: confirmedAt,
        confirmed_by: confirmedBy,
        notes: draft?.notes?.trim() ? draft.notes.trim() : null,
      },
      { onConflict: 'pool_id,user_id' },
    );

    if (error) {
      setSavingPaymentByUser((prev) => ({ ...prev, [userId]: false }));
      return;
    }

    await loadPayments(members);
    setSavingPaymentByUser((prev) => ({ ...prev, [userId]: false }));
  }

  async function setMemberAdmin(userId: string, nextIsAdmin: boolean) {
    if (profile?.id === userId && !nextIsAdmin) return;

    setSavingAdminByUser((prev) => ({ ...prev, [userId]: true }));

    const { error } = await (supabase.from('profiles') as any)
      .update({ is_admin: nextIsAdmin })
      .eq('id', userId);

    if (!error) {
      setMembers((prev) =>
        prev.map((member) =>
          member.user_id === userId
            ? { ...member, is_admin: nextIsAdmin }
            : member,
        ),
      );

      setPaymentRows((prev) =>
        prev.map((row) =>
          row.user_id === userId ? { ...row, is_admin: nextIsAdmin } : row,
        ),
      );
    }

    setSavingAdminByUser((prev) => ({ ...prev, [userId]: false }));
  }

  function updateNameDraft(userId: string, value: string) {
    setNameDraftByUser((prev) => ({ ...prev, [userId]: value }));
  }

  async function saveMemberName(userId: string) {
    const nextName = (nameDraftByUser[userId] ?? '').trim();
    if (!nextName) {
      return false;
    }

    setSavingNameByUser((prev) => ({ ...prev, [userId]: true }));

    const { error } = await (supabase.from('profiles') as any)
      .update({ name: nextName })
      .eq('id', userId);

    let saved = false;
    if (!error) {
      setMembers((prev) =>
        prev.map((member) =>
          member.user_id === userId ? { ...member, name: nextName } : member,
        ),
      );

      setPaymentRows((prev) =>
        prev.map((row) =>
          row.user_id === userId ? { ...row, name: nextName } : row,
        ),
      );

      setNameDraftByUser((prev) => ({ ...prev, [userId]: nextName }));
      saved = true;
    }

    setSavingNameByUser((prev) => ({ ...prev, [userId]: false }));
    return saved;
  }

  async function handleMemberNameAction(userId: string, currentName: string) {
    const isEditing = Boolean(editingNameByUser[userId]);
    if (!isEditing) {
      setEditingNameByUser((prev) => ({ ...prev, [userId]: true }));
      return;
    }

    const nextName = (nameDraftByUser[userId] ?? currentName).trim();
    if (!nextName) return;

    if (nextName === currentName) {
      setEditingNameByUser((prev) => ({ ...prev, [userId]: false }));
      return;
    }

    const saved = await saveMemberName(userId);
    if (saved) {
      setEditingNameByUser((prev) => ({ ...prev, [userId]: false }));
    }
  }

  async function loadGroupStandings(poolRounds?: Round[]) {
    const roundsForPool = poolRounds ?? rounds;
    const groupRoundIds = roundsForPool
      .filter((r) => r.phase === 'grupos')
      .map((r) => r.id);

    if (groupRoundIds.length === 0) {
      setGroupSections([]);
      setGroupStandingsDrafts({});
      return;
    }

    const allRoundIds = roundsForPool.map((r) => r.id);
    const { data: allMatchesData } = await supabase
      .from('matches')
      .select(
        `
        home_team:teams!matches_home_team_id_fkey(id, name, flag_code),
        away_team:teams!matches_away_team_id_fkey(id, name, flag_code)
      `,
      )
      .in('round_id', allRoundIds);

    const teamMap = new Map<string, TeamOption>();
    for (const row of allMatchesData ?? []) {
      const ht = (row as any).home_team;
      const at = (row as any).away_team;
      if (ht) teamMap.set(ht.id, ht);
      if (at) teamMap.set(at.id, at);
    }
    const sortedTeams = Array.from(teamMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    );
    setAllTeams(sortedTeams);

    const { data: podiumData } = await (supabase.from('podium_standings') as any)
      .select('champion_id, vice_id, third_id')
      .eq('pool_id', poolId)
      .maybeSingle();

    setPodiumStandingDraft({
      champion_id: podiumData?.champion_id ?? '',
      vice_id: podiumData?.vice_id ?? '',
      third_id: podiumData?.third_id ?? '',
    });

    const { data: matchesData } = await supabase
      .from('matches')
      .select(
        `
        group_id,
        group:groups(id, code),
        home_team:teams!matches_home_team_id_fkey(id, name, flag_code),
        away_team:teams!matches_away_team_id_fkey(id, name, flag_code)
      `,
      )
      .in('round_id', groupRoundIds)
      .not('group_id', 'is', null);

    const groupMap = new Map<string, GroupSection>();
    for (const row of matchesData ?? []) {
      const group = (row as any).group;
      const groupId = (row as any).group_id;
      if (!groupId || !group) continue;
      const current = groupMap.get(groupId) ?? {
        id: group.id,
        code: group.code,
        teams: [] as GroupSection['teams'],
      };

      const homeTeam = (row as any).home_team;
      const awayTeam = (row as any).away_team;
      if (homeTeam && !current.teams.some((t) => t.id === homeTeam.id))
        current.teams.push(homeTeam);
      if (awayTeam && !current.teams.some((t) => t.id === awayTeam.id))
        current.teams.push(awayTeam);

      groupMap.set(groupId, current);
    }

    const sections = Array.from(groupMap.values()).sort((a, b) =>
      a.code.localeCompare(b.code),
    );
    setGroupSections(sections);

    const groupIds = sections.map((s) => s.id);
    if (groupIds.length === 0) {
      setGroupStandingsDrafts({});
      return;
    }

    const { data: standingsData } = await supabase
      .from('group_standings')
      .select('group_id, first_id, second_id')
      .in('group_id', groupIds);

    const standingsByGroup = new Map(
      (standingsData ?? []).map((row: any) => [row.group_id, row]),
    );
    const nextDrafts: Record<string, GroupStandingDraft> = {};
    for (const section of sections) {
      const standing = standingsByGroup.get(section.id);
      nextDrafts[section.id] = {
        first_id: standing?.first_id ?? '',
        second_id: standing?.second_id ?? '',
      };
    }

    setGroupStandingsDrafts(nextDrafts);
  }

  function updateGroupStandingDraft(
    groupId: string,
    field: 'first_id' | 'second_id',
    value: string,
  ) {
    setGroupStandingsDrafts((prev) => ({
      ...prev,
      [groupId]: {
        first_id:
          field === 'first_id' ? value : (prev[groupId]?.first_id ?? ''),
        second_id:
          field === 'second_id' ? value : (prev[groupId]?.second_id ?? ''),
      },
    }));
    setGroupStandingMsgByGroup((prev) => ({ ...prev, [groupId]: '' }));
  }

  async function saveGroupStanding(groupId: string) {
    const draft = groupStandingsDrafts[groupId];
    if (!draft) return;

    if (
      !draft.first_id ||
      !draft.second_id ||
      draft.first_id === draft.second_id
    ) {
      setGroupStandingMsgByGroup((prev) => ({
        ...prev,
        [groupId]: 'Selecione 1º e 2º diferentes.',
      }));
      return;
    }

    setSavingGroupStandingByGroup((prev) => ({ ...prev, [groupId]: true }));
    setGroupStandingMsgByGroup((prev) => ({ ...prev, [groupId]: '' }));

    const { error } = await (supabase.from('group_standings') as any).upsert(
      {
        group_id: groupId,
        first_id: draft.first_id,
        second_id: draft.second_id,
      },
      { onConflict: 'group_id' },
    );

    if (error) {
      setGroupStandingMsgByGroup((prev) => ({
        ...prev,
        [groupId]: 'Nao conseguimos salvar a classificacao. Tente novamente.',
      }));
      setSavingGroupStandingByGroup((prev) => ({ ...prev, [groupId]: false }));
      return;
    }

    const { error: recalcError } = await (supabase as any).rpc(
      'recalculate_group_predictions_for_group',
      { p_group_id: groupId },
    );
    if (recalcError) {
      setGroupStandingMsgByGroup((prev) => ({
        ...prev,
        [groupId]: 'Classificacao salva com sucesso!',
      }));
    } else {
      setGroupStandingMsgByGroup((prev) => ({
        ...prev,
        [groupId]: 'Classificacao salva e pontuacao recalculada.',
      }));
    }

    setSavingGroupStandingByGroup((prev) => ({ ...prev, [groupId]: false }));
  }

  async function savePodiumStanding() {
    if (!poolId || savingPodiumStanding) return;
    const { champion_id, vice_id, third_id } = podiumStandingDraft;
    if (!champion_id || !vice_id || !third_id) {
      setPodiumStandingMsg('Selecione campeão, vice e 3º lugar.');
      return;
    }
    const ids = [champion_id, vice_id, third_id];
    if (new Set(ids).size !== 3) {
      setPodiumStandingMsg('Os três times devem ser diferentes.');
      return;
    }

    setSavingPodiumStanding(true);
    setPodiumStandingMsg('');

    const { error } = await (supabase.from('podium_standings') as any).upsert(
      { pool_id: poolId, champion_id, vice_id, third_id },
      { onConflict: 'pool_id' },
    );

    if (error) {
      setPodiumStandingMsg('Erro ao salvar. Tente novamente.');
      setSavingPodiumStanding(false);
      return;
    }

    const { error: recalcError } = await (supabase as any).rpc(
      'recalculate_podium_predictions_for_pool',
      { p_pool_id: poolId },
    );

    setPodiumStandingMsg(
      recalcError
        ? 'Pódio salvo, mas erro ao recalcular pontos.'
        : 'Pódio salvo e pontuação recalculada.',
    );
    setSavingPodiumStanding(false);
  }

  async function setAsGlobalDefault() {
    if (!poolId || updatingDefault) return;

    setUpdatingDefault(true);
    setDefaultMessage('');

    const { error } = await (supabase as any).rpc('set_global_default_pool', {
      p_pool_id: poolId,
    });
    if (error) {
      setDefaultMessage(
        'Nao conseguimos atualizar as configuracoes. Tente novamente.',
      );
      setUpdatingDefault(false);
      return;
    }

    setIsGlobalDefault(true);
    setDefaultMessage('Configuracoes atualizadas com sucesso!');
    setUpdatingDefault(false);
  }

  async function saveGroupPredictionsCutoff() {
    if (!poolId || savingGroupPredictionsCutoff) return;

    setSavingGroupPredictionsCutoff(true);
    setGroupPredictionsCutoffMessage('');

    let nextValue: string | null = null;
    if (groupPredictionsCutoffDraft) {
      const parsed = new Date(groupPredictionsCutoffDraft);
      if (Number.isNaN(parsed.getTime())) {
        setGroupPredictionsCutoffMessage(
          'Data invalida para prazo da classificacao.',
        );
        setSavingGroupPredictionsCutoff(false);
        return;
      }
      nextValue = parsed.toISOString();
    }

    const { error } = await (supabase.from('pools') as any)
      .update({ group_predictions_cutoff_at: nextValue })
      .eq('id', poolId);

    if (error) {
      setGroupPredictionsCutoffMessage(
        'Nao conseguimos atualizar o prazo. Tente novamente.',
      );
    } else {
      setGroupPredictionsCutoffMessage(
        nextValue
          ? 'Prazo atualizado com sucesso!'
          : 'Prazo removido. Usando configuracao automatica.',
      );
    }

    setSavingGroupPredictionsCutoff(false);
  }

  async function loadMatches(roundId: string) {
    setLoadingMatches(true);

    const { data, error } = await supabase
      .from('matches')
      .select(
        `
        id, kickoff_at, venue, cutoff_at, status, home_score, away_score,
        group:groups(code),
        home_team:teams!matches_home_team_id_fkey(name, flag_code),
        away_team:teams!matches_away_team_id_fkey(name, flag_code)
      `,
      )
      .eq('round_id', roundId)
      .order('kickoff_at');

    if (error) {
      setMatches([]);
      setResultDrafts({});
      setLoadingMatches(false);
      return;
    }

    const loaded = ((data ?? []) as unknown as Match[]).sort((a, b) => {
      const ga = a.group?.code ?? 'ZZ';
      const gb = b.group?.code ?? 'ZZ';
      if (ga !== gb) return ga.localeCompare(gb);
      return (
        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
      );
    });
    setMatches(loaded);

    const drafts: Record<string, ResultDraft> = {};
    for (const m of loaded) {
      drafts[m.id] = {
        home: m.home_score !== null ? String(m.home_score) : '',
        away: m.away_score !== null ? String(m.away_score) : '',
        cutoffAt: toDateTimeLocalValue(m.cutoff_at),
      };
    }
    setResultDrafts(drafts);
    setMatchMessage({});
    setGroupFilter('all');
    setStatusFilter('all');
    setLoadingMatches(false);
  }

  async function addMember() {
    if (!email.trim()) return;
    setAddingMember(true);
    setAddMemberMsg('');
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.trim())
      .single();

    if (!profileData) {
      setAddMemberMsg('Usuário não encontrado com esse email.');
      setAddingMember(false);
      return;
    }

    const { error } = await (supabase.from('pool_members') as any).insert({
      pool_id: poolId!,
      user_id: (profileData as any).id,
    });
    if (error) {
      setAddMemberMsg(
        error.code === '23505'
          ? 'Este participante ja esta no bolao.'
          : 'Nao conseguimos adicionar. Tente novamente.',
      );
    } else {
      setAddMemberMsg('Participante adicionado com sucesso!');
      setEmail('');
      loadData();
    }
    setAddingMember(false);
  }

  async function downloadPredictionsReport() {
    if (!poolId || downloadingReport) return;
    setDownloadingReport(true);

    const rows: any[] = [];
    const batchSize = 1000;
    let offset = 0;
    while (true) {
      const { data: batch, error } = await (supabase as any)
        .rpc('get_predictions_report', { p_pool_id: poolId })
        .range(offset, offset + batchSize - 1);
      if (error || !batch || batch.length === 0) break;
      rows.push(...batch);
      if (batch.length < batchSize) break;
      offset += batchSize;
    }

    if (!rows || rows.length === 0) {
      setDownloadingReport(false);
      return;
    }

    const headers = [
      'Rodada',
      'Time da Casa',
      'Time Visitante',
      'Data',
      'Participante',
      'Palpite Casa',
      'Palpite Visitante',
      'Pontos',
      'Status',
    ];
    const csvLines = [
      headers.join(';'),
      ...(rows as any[]).map((row: any) => {
        const cols = [
          row.round_name ?? '',
          row.home_team ?? '',
          row.away_team ?? '',
          row.kickoff_at ? new Date(row.kickoff_at).toLocaleString('pt-BR') : '',
          row.participant ?? '',
          String(row.home_guess ?? 0),
          String(row.away_guess ?? 0),
          String(row.points ?? 0),
          row.status ?? '',
        ];
        return cols
          .map((v) =>
            v.includes(';') || v.includes('"')
              ? `"${v.replace(/"/g, '""')}"`
              : v,
          )
          .join(';');
      }),
    ];
    const csvContent = csvLines.join('\r\n');

    const bytes = new Uint8Array(csvContent.length);
    for (let i = 0; i < csvContent.length; i++) {
      const code = csvContent.charCodeAt(i);
      bytes[i] = code < 256 ? code : 63;
    }

    const blob = new Blob([bytes], { type: 'text/csv;charset=windows-1252' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-palpites-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadingReport(false);
  }

  async function downloadGroupPredictionsReport() {
    if (!poolId || downloadingGroupReport) return;
    setDownloadingGroupReport(true);

    const { data: predsData } = await (
      supabase.from('group_predictions') as any
    )
      .select(
        `
        group_id,
        points,
        group:groups!group_predictions_group_id_fkey(code),
        profile:profiles!group_predictions_user_id_fkey(name),
        first_team:teams!group_predictions_first_id_fkey(name),
        second_team:teams!group_predictions_second_id_fkey(name)
      `,
      )
      .eq('pool_id', poolId)
      .order('created_at');

    const { data: standingsData } = await (
      supabase.from('group_standings') as any
    ).select(`
        group_id,
        first_team:teams!group_standings_first_id_fkey(name),
        second_team:teams!group_standings_second_id_fkey(name)
      `);

    const standingsByGroupId = new Map<string, any>(
      (standingsData ?? []).map((s: any) => [s.group_id, s] as [string, any]),
    );

    const sorted = ((predsData ?? []) as any[]).sort((a, b) => {
      const gA = a.group?.code ?? '';
      const gB = b.group?.code ?? '';
      if (gA !== gB) return gA.localeCompare(gB);
      return (a.profile?.name ?? '').localeCompare(
        b.profile?.name ?? '',
        'pt-BR',
      );
    });

    const headers = [
      'Grupo',
      'Participante',
      '1º Palpite',
      '2º Palpite',
      '1º Real',
      '2º Real',
      'Pontos',
    ];
    const csvLines = [
      headers.join(';'),
      ...sorted.map((pred: any) => {
        const standing = standingsByGroupId.get(pred.group_id) ?? null;
        const cols = [
          `Grupo ${pred.group?.code ?? '?'}`,
          pred.profile?.name ?? '',
          pred.first_team?.name ?? '',
          pred.second_team?.name ?? '',
          standing?.first_team?.name ?? '-',
          standing?.second_team?.name ?? '-',
          pred.points !== null && pred.points !== undefined
            ? String(pred.points)
            : '-',
        ];
        return cols
          .map((v: string) =>
            v.includes(';') || v.includes('"')
              ? `"${v.replace(/"/g, '""')}"`
              : v,
          )
          .join(';');
      }),
    ];
    const csvContent = csvLines.join('\r\n');

    const bytes = new Uint8Array(csvContent.length);
    for (let i = 0; i < csvContent.length; i++) {
      const code = csvContent.charCodeAt(i);
      bytes[i] = code < 256 ? code : 63;
    }

    const blob = new Blob([bytes], { type: 'text/csv;charset=windows-1252' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-classificados-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadingGroupReport(false);
  }

  async function downloadPodiumPredictionsReport() {
    if (!poolId || downloadingPodiumReport) return;
    setDownloadingPodiumReport(true);

    const { data: predsData } = await (
      supabase.from('podium_predictions') as any
    )
      .select(
        `
        points,
        profile:profiles!podium_predictions_user_id_fkey(name),
        champion:teams!podium_predictions_champion_id_fkey(name),
        vice:teams!podium_predictions_vice_id_fkey(name),
        third:teams!podium_predictions_third_id_fkey(name)
      `,
      )
      .eq('pool_id', poolId);

    const sorted = ((predsData ?? []) as any[]).sort((a, b) => {
      if ((b.points ?? -1) !== (a.points ?? -1))
        return (b.points ?? -1) - (a.points ?? -1);
      return (a.profile?.name ?? '').localeCompare(
        b.profile?.name ?? '',
        'pt-BR',
      );
    });

    const headers = [
      'Participante',
      'Campeão',
      'Vice-campeão',
      '3º Lugar',
      'Pontos',
    ];
    const csvLines = [
      headers.join(';'),
      ...sorted.map((pred: any) => {
        const cols = [
          pred.profile?.name ?? '',
          pred.champion?.name ?? '',
          pred.vice?.name ?? '',
          pred.third?.name ?? '',
          pred.points !== null && pred.points !== undefined
            ? String(pred.points)
            : '-',
        ];
        return cols
          .map((v: string) =>
            v.includes(';') || v.includes('"')
              ? `"${v.replace(/"/g, '""')}"`
              : v,
          )
          .join(';');
      }),
    ];
    const csvContent = csvLines.join('\r\n');

    const bytes = new Uint8Array(csvContent.length);
    for (let i = 0; i < csvContent.length; i++) {
      const code = csvContent.charCodeAt(i);
      bytes[i] = code < 256 ? code : 63;
    }

    const blob = new Blob([bytes], { type: 'text/csv;charset=windows-1252' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-podium-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadingPodiumReport(false);
  }

  async function syncExternalIds() {
    setSyncingExternalIds(true);
    setSyncExternalIdsResult(null);
    const { data, error } = await supabase.functions.invoke('map-external-ids');
    if (error) {
      setSyncExternalIdsResult(`Erro: ${error.message}`);
    } else if (data.mapped === 0) {
      const detail = [
        data.message,
        data.error ? JSON.stringify(data.error) : null,
      ]
        .filter(Boolean)
        .join(' | ');
      setSyncExternalIdsResult(
        `0 de ${data.total ?? '?'} partidas vinculadas. ${detail}`,
      );
    } else {
      setSyncExternalIdsResult(
        `${data.mapped} de ${data.total} partidas vinculadas.`,
      );
    }
    setSyncingExternalIds(false);
  }

  async function addRound() {
    if (!newRound.name) return;
    setAddingRound(true);
    await (supabase.from('rounds') as any).insert({
      ...newRound,
      pool_id: poolId!,
    });
    setNewRound({ name: '', phase: 'grupos' });
    setAddingRound(false);
    loadData();
  }

  async function addMatch() {
    if (!selectedRoundId || !newMatch.home_team_id || !newMatch.away_team_id || !newMatch.kickoff_at) return;
    setAddingMatch(true);
    await supabase.from('matches').insert({
      round_id: selectedRoundId,
      home_team_id: newMatch.home_team_id,
      away_team_id: newMatch.away_team_id,
      kickoff_at: new Date(newMatch.kickoff_at).toISOString(),
      venue: newMatch.venue,
    } as any);
    setNewMatch({ home_team_id: '', away_team_id: '', kickoff_at: '', venue: '' });
    setAddingMatch(false);
    loadMatches(selectedRoundId);
  }

  function updateDraft(matchId: string, side: 'home' | 'away', value: string) {
    setResultDrafts((prev) => ({
      ...prev,
      [matchId]: {
        home: side === 'home' ? value : (prev[matchId]?.home ?? ''),
        away: side === 'away' ? value : (prev[matchId]?.away ?? ''),
        cutoffAt: prev[matchId]?.cutoffAt ?? '',
      },
    }));
  }

  function updateCutoffDraft(matchId: string, value: string) {
    setResultDrafts((prev) => ({
      ...prev,
      [matchId]: {
        home: prev[matchId]?.home ?? '',
        away: prev[matchId]?.away ?? '',
        cutoffAt: value,
      },
    }));
  }

  function parseDraft(matchId: string) {
    const draft = resultDrafts[matchId];
    if (!draft) return null;
    const home = Number.parseInt(draft.home, 10);
    const away = Number.parseInt(draft.away, 10);
    if (
      !Number.isInteger(home) ||
      !Number.isInteger(away) ||
      home < 0 ||
      away < 0
    )
      return null;
    return { home, away };
  }

  async function saveCutoff(matchId: string) {
    const cutoffDraft = resultDrafts[matchId]?.cutoffAt ?? '';
    if (!cutoffDraft) {
      setMatchMessage((prev) => ({
        ...prev,
        [matchId]: 'Preencha uma data valida.',
      }));
      return;
    }

    setSavingMatch((prev) => ({ ...prev, [matchId]: true }));
    setMatchMessage((prev) => ({ ...prev, [matchId]: '' }));

    const parsedDate = new Date(cutoffDraft);
    const cutoffAt = Number.isNaN(parsedDate.getTime())
      ? null
      : parsedDate.toISOString();

    const { error } = await (supabase.from('matches') as any)
      .update({ cutoff_at: cutoffAt })
      .eq('id', matchId);

    if (error) {
      setMatchMessage((prev) => ({
        ...prev,
        [matchId]: 'Nao conseguimos atualizar o cutoff. Tente novamente.',
      }));
    } else {
      setMatchMessage((prev) => ({
        ...prev,
        [matchId]: 'Cutoff atualizado com sucesso!',
      }));
      if (selectedRoundId) loadMatches(selectedRoundId);
    }

    setSavingMatch((prev) => ({ ...prev, [matchId]: false }));
  }

  async function closeMatch(matchId: string) {
    const parsed = parseDraft(matchId);
    if (!parsed) {
      setMatchMessage((prev) => ({
        ...prev,
        [matchId]: 'Preencha placares válidos antes de encerrar.',
      }));
      return;
    }

    const cutoffDraft = resultDrafts[matchId]?.cutoffAt ?? '';
    const currentMatch = matches.find((m) => m.id === matchId);
    const originalCutoff = currentMatch?.cutoff_at ?? null;
    const originalDraftValue = toDateTimeLocalValue(originalCutoff);

    let cutoffAt: string | null = null;
    if (!cutoffDraft) {
      cutoffAt = null;
    } else if (originalCutoff && cutoffDraft === originalDraftValue) {
      cutoffAt = originalCutoff;
    } else {
      const parsedDate = new Date(cutoffDraft);
      cutoffAt = Number.isNaN(parsedDate.getTime())
        ? null
        : parsedDate.toISOString();
    }

    setSavingMatch((prev) => ({ ...prev, [matchId]: true }));
    setMatchMessage((prev) => ({ ...prev, [matchId]: '' }));

    const { error } = await (supabase.from('matches') as any)
      .update({
        home_score: parsed.home,
        away_score: parsed.away,
        cutoff_at: cutoffAt,
        status: 'encerrado',
      })
      .eq('id', matchId);

    if (error) {
      setMatchMessage((prev) => ({
        ...prev,
        [matchId]: 'Nao conseguimos atualizar o resultado. Tente novamente.',
      }));
    } else {
      setMatchMessage((prev) => ({
        ...prev,
        [matchId]: 'Partida encerrada e pontos recalculados.',
      }));
      if (selectedRoundId) loadMatches(selectedRoundId);
    }

    setSavingMatch((prev) => ({ ...prev, [matchId]: false }));
  }

  async function reopenMatch(matchId: string) {
    setSavingMatch((prev) => ({ ...prev, [matchId]: true }));
    setMatchMessage((prev) => ({ ...prev, [matchId]: '' }));

    const { error } = await (supabase.from('matches') as any)
      .update({ home_score: null, away_score: null, status: 'pendente' })
      .eq('id', matchId);

    if (error) {
      setMatchMessage((prev) => ({
        ...prev,
        [matchId]: 'Nao conseguimos reabrir a partida. Tente novamente.',
      }));
    } else {
      setMatchMessage((prev) => ({
        ...prev,
        [matchId]: 'Partida reaberta. Pontos do jogo zerados.',
      }));
      if (selectedRoundId) loadMatches(selectedRoundId);
    }

    setSavingMatch((prev) => ({ ...prev, [matchId]: false }));
  }

  async function retakeSnapshot(matchId: string) {
    setRetakingSnapshot((prev) => ({ ...prev, [matchId]: true }));
    setMatchMessage((prev) => ({ ...prev, [matchId]: '' }));

    const { error } = await (supabase as any).rpc('take_leaderboard_snapshot', {
      p_match_id: matchId,
    });

    setMatchMessage((prev) => ({
      ...prev,
      [matchId]: error
        ? 'Erro ao refazer snapshot. Tente novamente.'
        : 'Snapshot atualizado com os rankings atuais.',
    }));
    setRetakingSnapshot((prev) => ({ ...prev, [matchId]: false }));
  }

  async function loadPredictions(matchId: string) {
    if (predictionsByMatch[matchId]) {
      setOpenSnapshotMatch(matchId);
      return;
    }

    setLoadingPredictions((prev) => ({ ...prev, [matchId]: true }));

    const [{ data: predictionsData, error: predictionsError }, { data: leaderboardData }] = await Promise.all([
      (supabase.from('predictions') as any)
        .select(`user_id, home_guess, away_guess, points`)
        .eq('match_id', matchId)
        .eq('pool_id', poolId),
      supabase
        .from('leaderboard')
        .select('user_id, rank')
        .eq('pool_id', poolId!),
    ]);

    if (predictionsError) {
      console.error('[Admin] loadPredictions:error', {
        message: predictionsError.message,
      });
      setLoadingPredictions((prev) => ({ ...prev, [matchId]: false }));
      return;
    }

    const allMemberIds = members.map((m) => m.user_id);
    const allUserIds = Array.from(
      new Set([
        ...(predictionsData ?? []).map((p: any) => p.user_id),
        ...allMemberIds,
      ]),
    );

    let userNames: Record<string, string> = {};
    if (allUserIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', allUserIds);

      userNames = Object.fromEntries(
        (profilesData ?? []).map((p: any) => [p.id, p.name]),
      );
    }

    const predByUser = new Map<string, any>(
      (predictionsData ?? []).map((p: any) => [p.user_id, p]),
    );
    const rankByUserId = new Map<string, number>(
      (leaderboardData ?? []).map((row: any) => [row.user_id, row.rank]),
    );

    const predictions: Prediction[] = allMemberIds.map((userId) => {
      const pred = predByUser.get(userId);
      const memberName = members.find((m) => m.user_id === userId)?.name;
      return {
        user_id: userId,
        user_name: userNames[userId] ?? memberName ?? 'Sem nome',
        home_guess: pred?.home_guess ?? 0,
        away_guess: pred?.away_guess ?? 0,
        points: pred?.points ?? null,
        current_rank: rankByUserId.get(userId) ?? null,
      };
    });

    setPredictionsByMatch((prev) => ({
      ...prev,
      [matchId]: predictions,
    }));

    setLoadingPredictions((prev) => ({ ...prev, [matchId]: false }));
    setOpenSnapshotMatch(matchId);
  }

  async function handleExportImage(matchId: string) {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    setExportingImage(true);

    try {
      await exportSnapshotAsImage(
        matchId,
        match.home_team?.name ?? 'Time A',
        match.away_team?.name ?? 'Time B',
        match.kickoff_at,
      );
    } catch (error) {
      console.error('[Admin] Error exporting image:', error);
      alert('Erro ao gerar imagem. Tente novamente.');
    } finally {
      setExportingImage(false);
    }
  }

  async function loadPodiumPredsForSnapshot() {
    setLoadingPodiumPredsSnapshot(true);

    const { data } = await (supabase.from('podium_predictions') as any)
      .select(
        `user_id, points,
         champion_team:teams!podium_predictions_champion_id_fkey(id, name, flag_code),
         vice_team:teams!podium_predictions_vice_id_fkey(id, name, flag_code),
         third_team:teams!podium_predictions_third_id_fkey(id, name, flag_code)`,
      )
      .eq('pool_id', poolId);

    const memberNameMap = new Map(members.map((m) => [m.user_id, m.name]));

    const preds: PodiumPredRow[] = ((data ?? []) as any[]).map((row: any) => ({
      user_id: row.user_id,
      user_name: memberNameMap.get(row.user_id) ?? `Usuario ${String(row.user_id).slice(0, 8)}`,
      champion_team: row.champion_team ?? null,
      vice_team: row.vice_team ?? null,
      third_team: row.third_team ?? null,
      points: row.points ?? null,
    }));

    setPodiumPredsForSnapshot(preds);
    setLoadingPodiumPredsSnapshot(false);
    setOpenSnapshotPodium(true);
  }

  async function handleExportPodiumImage() {
    setExportingPodiumImage(true);
    try {
      const today = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      await exportElementAsImage('snapshot-podium', `palpites-podium-${today}.png`);
    } catch (error) {
      console.error('[Admin] Error exporting podium snapshot:', error);
      alert('Erro ao gerar imagem. Tente novamente.');
    } finally {
      setExportingPodiumImage(false);
    }
  }

  async function loadGroupPredsForSnapshot(groupId: string) {
    if (groupPredsForSnapshot[groupId]) {
      setOpenSnapshotGroup(groupId);
      return;
    }

    setLoadingGroupPredsSnapshot((prev) => ({ ...prev, [groupId]: true }));

    const { data } = await (supabase.from('group_predictions') as any)
      .select(
        `user_id, points,
         first_team:teams!group_predictions_first_id_fkey(id, name, flag_code),
         second_team:teams!group_predictions_second_id_fkey(id, name, flag_code)`,
      )
      .eq('pool_id', poolId)
      .eq('group_id', groupId);

    const memberNameMap = new Map(members.map((m) => [m.user_id, m.name]));

    const preds: GroupPredRow[] = ((data ?? []) as any[]).map((row: any) => ({
      user_id: row.user_id,
      user_name: memberNameMap.get(row.user_id) ?? `Usuario ${String(row.user_id).slice(0, 8)}`,
      first_team: row.first_team ?? null,
      second_team: row.second_team ?? null,
      points: row.points ?? null,
    }));

    setGroupPredsForSnapshot((prev) => ({ ...prev, [groupId]: preds }));
    setLoadingGroupPredsSnapshot((prev) => ({ ...prev, [groupId]: false }));
    setOpenSnapshotGroup(groupId);
  }

  async function handleExportGroupImage(groupId: string, groupCode: string) {
    setExportingGroupImage(true);
    try {
      const today = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      await exportElementAsImage(
        `snapshot-group-${groupId}`,
        `palpites-grupo-${groupCode.toLowerCase()}-${today}.png`,
      );
    } catch (error) {
      console.error('[Admin] Error exporting group snapshot:', error);
      alert('Erro ao gerar imagem. Tente novamente.');
    } finally {
      setExportingGroupImage(false);
    }
  }

  if (!profile?.is_admin) {
    return (
      <div className="text-center py-20 text-gray-400">
        Acesso restrito a administradores.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative px-0.5 py-0.5">
        <div className="border-b border-slate-200 pb-1.5">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-950 text-white flex-shrink-0">
              <IconSettings className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800 leading-tight">
              Administração do Bolão
            </h1>
          </div>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-600">
            {members.length} participantes · {rounds.length} rodadas
          </p>
        </div>
      </section>

      <section className="modern-card p-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => setActiveTab('geral')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold border transition ${activeTab === 'geral' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            Geral
          </button>
          <button
            onClick={() => setActiveTab('classificacao')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold border transition ${activeTab === 'classificacao' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            Classificação
          </button>
          <button
            onClick={() => setActiveTab('pessoas')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold border transition ${activeTab === 'pessoas' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            Pessoas
          </button>
          <button
            onClick={() => setActiveTab('jogos')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold border transition ${activeTab === 'jogos' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            Jogos
          </button>
        </div>
      </section>

      {activeTab === 'geral' && (
        <>
          <section>
            <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">
              Configuração Global
            </h2>
            <div className="modern-card p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    Bolão padrão para novos usuários
                  </p>
                </div>
                <button
                  onClick={setAsGlobalDefault}
                  disabled={isGlobalDefault || updatingDefault}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {updatingDefault
                    ? 'Salvando...'
                    : isGlobalDefault
                      ? 'Padrão global ativo'
                      : 'Definir como padrão global'}
                </button>
              </div>
              {defaultMessage && (
                <p className="text-sm mt-3 text-gray-600">{defaultMessage}</p>
              )}

              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-800">
                  Prazo próprio para palpite de classificação
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="datetime-local"
                    value={groupPredictionsCutoffDraft}
                    onChange={(e) =>
                      setGroupPredictionsCutoffDraft(e.target.value)
                    }
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />

                  <button
                    onClick={saveGroupPredictionsCutoff}
                    disabled={savingGroupPredictionsCutoff}
                    className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {savingGroupPredictionsCutoff
                      ? 'Salvando...'
                      : 'Salvar prazo'}
                  </button>
                </div>

                {groupPredictionsCutoffMessage && (
                  <p className="text-sm mt-2 text-gray-600">
                    {groupPredictionsCutoffMessage}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">
              Relatórios
            </h2>
            <div className="space-y-3">
              <div className="modern-card p-4">
                <p className="text-sm text-gray-600 mb-3">
                  Exporta todos os palpites de jogos encerrados com pontuação e
                  status de participação.
                </p>
                <button
                  onClick={downloadPredictionsReport}
                  disabled={downloadingReport}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {downloadingReport ? 'Gerando...' : 'Baixar CSV de Palpites'}
                </button>
              </div>
              <div className="modern-card p-4">
                <p className="text-sm text-gray-600 mb-3">
                  Exporta os palpites de classificados de grupo (1º e 2º de cada
                  grupo) com a classificação real e pontuação.
                </p>
                <button
                  onClick={downloadGroupPredictionsReport}
                  disabled={downloadingGroupReport}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {downloadingGroupReport
                    ? 'Gerando...'
                    : 'Baixar CSV de Classificados de Grupo'}
                </button>
              </div>
              <div className="modern-card p-4">
                <p className="text-sm text-gray-600 mb-3">
                  Exporta os palpites de pódio (campeão, vice-campeão e 3º
                  lugar) com pontuação.
                </p>
                <button
                  onClick={downloadPodiumPredictionsReport}
                  disabled={downloadingPodiumReport}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {downloadingPodiumReport
                    ? 'Gerando...'
                    : 'Baixar CSV de Pódio'}
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Classificacao real por grupo */}
      {activeTab === 'classificacao' && (
        <section className="space-y-6">
          {/* Podium */}
          <div>
            <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">
              Pódio Final
            </h2>
            <div className="modern-card p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1 text-xs text-gray-600 font-semibold">
                  <span className="flex items-center gap-1">
                    <span className="text-amber-500 text-base">🥇</span> Campeão
                  </span>
                  <select
                    value={podiumStandingDraft.champion_id}
                    onChange={(e) => setPodiumStandingDraft((p) => ({ ...p, champion_id: e.target.value }))}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Selecione</option>
                    {allTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-gray-600 font-semibold">
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400 text-base">🥈</span> Vice-campeão
                  </span>
                  <select
                    value={podiumStandingDraft.vice_id}
                    onChange={(e) => setPodiumStandingDraft((p) => ({ ...p, vice_id: e.target.value }))}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Selecione</option>
                    {allTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-gray-600 font-semibold">
                  <span className="flex items-center gap-1">
                    <span className="text-amber-700 text-base">🥉</span> 3º Lugar
                  </span>
                  <select
                    value={podiumStandingDraft.third_id}
                    onChange={(e) => setPodiumStandingDraft((p) => ({ ...p, third_id: e.target.value }))}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Selecione</option>
                    {allTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              {(podiumStandingDraft.champion_id || podiumStandingDraft.vice_id || podiumStandingDraft.third_id) && (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {podiumStandingDraft.champion_id && (
                    <TeamWithFlag
                      name={allTeams.find((t) => t.id === podiumStandingDraft.champion_id)?.name}
                      flagCode={allTeams.find((t) => t.id === podiumStandingDraft.champion_id)?.flag_code}
                      size="sm"
                      compact
                    />
                  )}
                  {podiumStandingDraft.vice_id && (
                    <TeamWithFlag
                      name={allTeams.find((t) => t.id === podiumStandingDraft.vice_id)?.name}
                      flagCode={allTeams.find((t) => t.id === podiumStandingDraft.vice_id)?.flag_code}
                      size="sm"
                      compact
                    />
                  )}
                  {podiumStandingDraft.third_id && (
                    <TeamWithFlag
                      name={allTeams.find((t) => t.id === podiumStandingDraft.third_id)?.name}
                      flagCode={allTeams.find((t) => t.id === podiumStandingDraft.third_id)?.flag_code}
                      size="sm"
                      compact
                    />
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={savePodiumStanding}
                  disabled={savingPodiumStanding}
                  className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {savingPodiumStanding ? 'Salvando...' : 'Salvar pódio'}
                </button>
                <button
                  onClick={loadPodiumPredsForSnapshot}
                  disabled={loadingPodiumPredsSnapshot}
                  className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition"
                >
                  {loadingPodiumPredsSnapshot ? 'Carregando...' : 'Ver snapshot'}
                </button>
                {podiumStandingMsg && (
                  <p className="text-xs text-gray-600">{podiumStandingMsg}</p>
                )}
              </div>
            </div>
          </div>

          {/* Classificados por grupo */}
          <div>
            <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">
              Classificados por Grupo
            </h2>
          {groupSections.length === 0 ? (
            <p className="text-sm text-gray-400">
              Nenhum grupo encontrado na fase de grupos deste bolao.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {groupSections.map((section) => {
                const draft = groupStandingsDrafts[section.id] ?? {
                  first_id: '',
                  second_id: '',
                };
                const isSaving = Boolean(
                  savingGroupStandingByGroup[section.id],
                );

                return (
                  <div
                    key={section.id}
                    className="modern-card p-4 space-y-3 border border-slate-200"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold tracking-wide text-gray-800 uppercase">
                        Grupo {section.code}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1 text-xs text-gray-600">
                        1º colocado
                        <select
                          value={draft.first_id}
                          onChange={(e) =>
                            updateGroupStandingDraft(
                              section.id,
                              'first_id',
                              e.target.value,
                            )
                          }
                          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="">Selecione</option>
                          {section.teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1 text-xs text-gray-600">
                        2º colocado
                        <select
                          value={draft.second_id}
                          onChange={(e) =>
                            updateGroupStandingDraft(
                              section.id,
                              'second_id',
                              e.target.value,
                            )
                          }
                          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="">Selecione</option>
                          {section.teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 min-h-[52px]">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                          1º real
                        </p>
                        {draft.first_id ? (
                          <div className="mt-1">
                            {(() => {
                              const team = section.teams.find(
                                (t) => t.id === draft.first_id,
                              );
                              return team ? (
                                <TeamWithFlag
                                  name={team.name}
                                  flagCode={team.flag_code}
                                  size="sm"
                                  compact
                                />
                              ) : (
                                <p className="text-xs text-gray-400">
                                  Nao definido
                                </p>
                              );
                            })()}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1">
                            Nao definido
                          </p>
                        )}
                      </div>
                      <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 min-h-[52px]">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
                          2º real
                        </p>
                        {draft.second_id ? (
                          <div className="mt-1">
                            {(() => {
                              const team = section.teams.find(
                                (t) => t.id === draft.second_id,
                              );
                              return team ? (
                                <TeamWithFlag
                                  name={team.name}
                                  flagCode={team.flag_code}
                                  size="sm"
                                  compact
                                />
                              ) : (
                                <p className="text-xs text-gray-400">
                                  Nao definido
                                </p>
                              );
                            })()}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1">
                            Nao definido
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveGroupStanding(section.id)}
                        disabled={isSaving}
                        className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                      >
                        {isSaving ? 'Salvando...' : 'Salvar classificacao'}
                      </button>
                      <button
                        onClick={() => loadGroupPredsForSnapshot(section.id)}
                        disabled={Boolean(loadingGroupPredsSnapshot[section.id])}
                        className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition"
                      >
                        {loadingGroupPredsSnapshot[section.id] ? 'Carregando...' : 'Ver snapshot'}
                      </button>
                    </div>

                    {groupStandingMsgByGroup[section.id] && (
                      <p className="text-xs text-gray-600">
                        {groupStandingMsgByGroup[section.id]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </section>
      )}

      {activeTab === 'pessoas' && (
        <section>
          <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">
            Pessoas
          </h2>

          <div className="modern-card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-emerald-700 font-bold">
                Confirmados
              </p>
              <p className="text-2xl font-black text-emerald-800">
                {paidMembersCount}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-amber-700 font-bold">
                Pendentes
              </p>
              <p className="text-2xl font-black text-amber-800">
                {pendingMembersCount}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={addMember}
              disabled={addingMember}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 sm:w-auto"
            >
              Adicionar
            </button>
          </div>
          {addMemberMsg && (
            <p className="text-sm mb-3 text-gray-600">{addMemberMsg}</p>
          )}

          {loadingPayments ? (
            <p className="text-sm text-gray-400">Carregando...</p>
          ) : (
            <>
              <div className="md:hidden space-y-2">
                {sortedPaymentRows.map((row) => (
                  <div
                    key={row.user_id}
                    className={`modern-card p-3 ${row.status === 'pendente' ? 'border-2 border-amber-500 bg-amber-200 shadow-[0_0_0_1px_rgba(245,158,11,0.45)]' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      {editingNameByUser[row.user_id] ? (
                        <input
                          type="text"
                          value={nameDraftByUser[row.user_id] ?? row.name}
                          onChange={(e) =>
                            updateNameDraft(row.user_id, e.target.value)
                          }
                          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      ) : (
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">
                          {row.name}
                        </p>
                      )}
                      <button
                        onClick={() =>
                          handleMemberNameAction(row.user_id, row.name)
                        }
                        disabled={
                          Boolean(savingNameByUser[row.user_id]) ||
                          (Boolean(editingNameByUser[row.user_id]) &&
                            !(nameDraftByUser[row.user_id] ?? row.name).trim())
                        }
                        className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {savingNameByUser[row.user_id] ? (
                          '...'
                        ) : editingNameByUser[row.user_id] ? (
                          'Salvar'
                        ) : (
                          <span
                            aria-label="Editar nome"
                            title="Editar nome"
                            className="inline-flex items-center justify-center"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                            </svg>
                          </span>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {row.email}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${row.status === 'confirmado' ? 'bg-emerald-100 text-emerald-700' : row.status === 'rejeitado' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}
                      >
                        {row.status === 'confirmado'
                          ? 'Confirmado'
                          : row.status === 'rejeitado'
                            ? 'Rejeitado'
                            : 'Pendente'}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${row.is_admin ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {row.is_admin ? 'Admin' : 'Participante'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block modern-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left">Nome</th>
                      <th className="px-4 py-2 text-left">Email</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedPaymentRows.map((row) => {
                      const draft = paymentDrafts[row.user_id] ?? {
                        status: row.status,
                        notes: row.notes ?? '',
                      };
                      const isSavingPayment = Boolean(
                        savingPaymentByUser[row.user_id],
                      );
                      const isSavingAdmin = Boolean(
                        savingAdminByUser[row.user_id],
                      );
                      const isSavingName = Boolean(
                        savingNameByUser[row.user_id],
                      );
                      const isEditingName = Boolean(
                        editingNameByUser[row.user_id],
                      );
                      const nextName = (
                        nameDraftByUser[row.user_id] ?? row.name
                      ).trim();
                      const canClickNameAction =
                        !isSavingName &&
                        (!isEditingName || nextName.length > 0);

                      return (
                        <tr
                          key={row.user_id}
                          className={
                            row.status === 'pendente'
                              ? 'bg-amber-200/80 ring-1 ring-inset ring-amber-500'
                              : ''
                          }
                        >
                          <td className="px-4 py-3 font-medium text-gray-800">
                            <div className="flex items-center gap-2">
                              {row.status === 'pendente' && (
                                <span
                                  className="h-2.5 w-2.5 rounded-full bg-amber-700"
                                  aria-hidden="true"
                                />
                              )}
                              {isEditingName ? (
                                <input
                                  type="text"
                                  value={
                                    nameDraftByUser[row.user_id] ?? row.name
                                  }
                                  onChange={(e) =>
                                    updateNameDraft(row.user_id, e.target.value)
                                  }
                                  className="min-w-[170px] rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                />
                              ) : (
                                <span>{row.name}</span>
                              )}
                              <button
                                onClick={() =>
                                  handleMemberNameAction(row.user_id, row.name)
                                }
                                disabled={!canClickNameAction}
                                className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                {isSavingName ? (
                                  '...'
                                ) : isEditingName ? (
                                  'Salvar'
                                ) : (
                                  <span
                                    aria-label="Editar nome"
                                    title="Editar nome"
                                    className="inline-flex items-center justify-center"
                                  >
                                    <svg
                                      viewBox="0 0 24 24"
                                      className="h-3.5 w-3.5"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      aria-hidden="true"
                                    >
                                      <path d="M12 20h9" />
                                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                                    </svg>
                                  </span>
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {row.email}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <select
                                value={draft.status}
                                onChange={async (e) => {
                                  const nextStatus = e.target.value as
                                    | 'pendente'
                                    | 'confirmado'
                                    | 'rejeitado';
                                  updatePaymentDraft(row.user_id, {
                                    status: nextStatus,
                                  });
                                  await saveMemberPayment(
                                    row.user_id,
                                    nextStatus,
                                  );
                                }}
                                disabled={isSavingPayment}
                                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
                              >
                                <option value="pendente">Pendente</option>
                                <option value="confirmado">Confirmado</option>
                                <option value="rejeitado">Rejeitado</option>
                              </select>
                              {isSavingPayment && (
                                <span className="text-[11px] text-gray-400">
                                  ...
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  setMemberAdmin(row.user_id, !row.is_admin)
                                }
                                disabled={
                                  isSavingAdmin ||
                                  (profile?.id === row.user_id && row.is_admin)
                                }
                                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${row.is_admin ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} disabled:opacity-50`}
                              >
                                {row.is_admin ? 'Admin' : 'Tornar admin'}
                              </button>
                              {isSavingAdmin && (
                                <span className="text-[11px] text-gray-400">
                                  ...
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {/* Rodadas */}
      {/* Resultados */}
      {activeTab === 'jogos' && (
        <section>
          <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">
            Resultados
          </h2>

          <div className="modern-card p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rodada
            </label>
            <select
              value={selectedRoundId}
              onChange={(e) => setSelectedRoundId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {rounds.length === 0 && <option value="">Sem rodadas</option>}
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({PHASE_LABELS[r.phase] ?? r.phase})
                </option>
              ))}
            </select>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filtrar por grupo
                </label>
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">Todos os grupos</option>
                  {availableGroups.map((code) => (
                    <option key={code} value={code}>
                      Grupo {code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filtrar por status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as 'all' | 'pendente' | 'encerrado',
                    )
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">Todos os status</option>
                  <option value="pendente">Pendente</option>
                  <option value="encerrado">Encerrado</option>
                </select>
              </div>
            </div>
          </div>

          {selectedRoundId && rounds.find((r) => r.id === selectedRoundId)?.phase !== 'grupos' && (
            <div className="modern-card p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Adicionar Jogo</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Time da Casa</label>
                  <select
                    value={newMatch.home_team_id}
                    onChange={(e) => setNewMatch((m) => ({ ...m, home_team_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Selecione...</option>
                    {allTeamsList.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Time Visitante</label>
                  <select
                    value={newMatch.away_team_id}
                    onChange={(e) => setNewMatch((m) => ({ ...m, away_team_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Selecione...</option>
                    {allTeamsList.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Data e Hora</label>
                  <input
                    type="datetime-local"
                    value={newMatch.kickoff_at}
                    onChange={(e) => setNewMatch((m) => ({ ...m, kickoff_at: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Local</label>
                  <input
                    type="text"
                    value={newMatch.venue}
                    onChange={(e) => setNewMatch((m) => ({ ...m, venue: e.target.value }))}
                    placeholder="Ex: Los Angeles"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <button
                onClick={addMatch}
                disabled={addingMatch || !newMatch.home_team_id || !newMatch.away_team_id || !newMatch.kickoff_at}
                className="mt-3 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {addingMatch ? '...' : 'Adicionar Jogo'}
              </button>
            </div>
          )}

          {loadingMatches ? (
            <p className="text-gray-400 text-center py-8">
              Carregando jogos...
            </p>
          ) : matches.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              Nenhum jogo encontrado para esta rodada.
            </p>
          ) : filteredMatches.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              Nenhum jogo encontrado para os filtros selecionados.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredMatches.map((m) => (
                <div key={m.id} className="modern-card soft-hover p-4">
                  {/** Partida encerrada fica bloqueada ate ser reaberta. */}
                  {(() => {
                    const isMatchLocked =
                      m.status === 'encerrado' || Boolean(savingMatch[m.id]);
                    return (
                      <>
                        <div className="flex items-center justify-between mb-3 gap-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700 w-fit">
                              Grupo {m.group?.code ?? '-'}
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5 flex-1">
                            <p className="text-xs text-gray-400">
                              {new Date(m.kickoff_at).toLocaleString('pt-BR', {
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                            {m.venue && (
                              <p className="text-xs text-gray-400">{m.venue}</p>
                            )}
                          </div>
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded-full ${m.status === 'encerrado' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-700'}`}
                          >
                            {m.status === 'encerrado'
                              ? 'Encerrado'
                              : 'Pendente'}
                          </span>
                        </div>

                        <div className="flex items-center justify-center gap-2">
                          <div className="flex-1 flex justify-end items-center gap-1">
                            <TeamWithFlag
                              name={m.home_team?.name}
                              flagCode={m.home_team?.flag_code}
                              size="sm"
                              compact
                              reverse
                              align="right"
                              className="font-semibold text-gray-800"
                            />
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={resultDrafts[m.id]?.home ?? ''}
                              onChange={(e) =>
                                updateDraft(m.id, 'home', e.target.value)
                              }
                              disabled={isMatchLocked}
                              className="w-12 text-center border border-gray-300 rounded px-1 py-1.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100"
                            />
                          </div>
                          <span className="text-gray-400 font-bold">×</span>
                          <div className="flex-1 flex justify-start items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={resultDrafts[m.id]?.away ?? ''}
                              onChange={(e) =>
                                updateDraft(m.id, 'away', e.target.value)
                              }
                              disabled={isMatchLocked}
                              className="w-12 text-center border border-gray-300 rounded px-1 py-1.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100"
                            />
                            <TeamWithFlag
                              name={m.away_team?.name}
                              flagCode={m.away_team?.flag_code}
                              size="sm"
                              compact
                              align="left"
                              className="font-semibold text-gray-800"
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-center gap-2">
                          <label className="text-xs text-gray-500">
                            Cutoff:
                          </label>
                          <input
                            type="datetime-local"
                            value={resultDrafts[m.id]?.cutoffAt ?? ''}
                            onChange={(e) =>
                              updateCutoffDraft(m.id, e.target.value)
                            }
                            disabled={isMatchLocked}
                            className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100"
                          />
                          <button
                            onClick={() => saveCutoff(m.id)}
                            disabled={isMatchLocked}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-2 py-1 rounded-lg disabled:opacity-50 transition"
                          >
                            {savingMatch[m.id] ? '...' : 'Salvar'}
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-center gap-2">
                          {m.status === 'encerrado' ? (
                            <button
                              onClick={() => reopenMatch(m.id)}
                              disabled={Boolean(savingMatch[m.id])}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
                            >
                              {savingMatch[m.id]
                                ? 'Reabrindo...'
                                : 'Reabrir Partida'}
                            </button>
                          ) : (
                            <button
                              onClick={() => closeMatch(m.id)}
                              disabled={Boolean(savingMatch[m.id])}
                              className="bg-gray-700 hover:bg-gray-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
                            >
                              {savingMatch[m.id]
                                ? 'Encerrando...'
                                : 'Encerrar Partida'}
                            </button>
                          )}

                          {m.status === 'encerrado' && (
                            <button
                              onClick={() => retakeSnapshot(m.id)}
                              disabled={Boolean(retakingSnapshot[m.id])}
                              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
                              title="Refaz o snapshot com os rankings atuais (use após corrigir placar)"
                            >
                              {retakingSnapshot[m.id]
                                ? 'Atualizando...'
                                : 'Refazer Snapshot'}
                            </button>
                          )}

                          <button
                            onClick={() => loadPredictions(m.id)}
                            disabled={Boolean(loadingPredictions[m.id])}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
                          >
                            {loadingPredictions[m.id]
                              ? 'Carregando...'
                              : '🖼️ Snapshot'}
                          </button>
                        </div>

                        {matchMessage[m.id] && (
                          <p className="text-xs text-center mt-2 text-gray-500">
                            {matchMessage[m.id]}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'jogos' && (
        <section>
          <div className="modern-card p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-700 mb-1">
              API-Football
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Vincula automaticamente as partidas do banco com os IDs da
              API-Football (por nome dos times + horário). Execute uma vez por
              fase.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={syncExternalIds}
                disabled={syncingExternalIds}
                className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {syncingExternalIds
                  ? 'Sincronizando...'
                  : 'Sincronizar IDs externos'}
              </button>
              {syncExternalIdsResult && (
                <span className="text-sm text-gray-600">
                  {syncExternalIdsResult}
                </span>
              )}
            </div>
          </div>

          <h2 className="text-lg font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">
            Rodadas
          </h2>
          <div className="modern-card p-4 mb-4 grid sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={newRound.name}
              onChange={(e) =>
                setNewRound((r) => ({ ...r, name: e.target.value }))
              }
              placeholder="Nome (ex: Grupo A – Rodada 1)"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <select
              value={newRound.phase}
              onChange={(e) =>
                setNewRound((r) => ({ ...r, phase: e.target.value }))
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {Object.entries(PHASE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <button
              onClick={addRound}
              disabled={addingRound}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {addingRound ? '...' : 'Adicionar Rodada'}
            </button>
          </div>
          <div className="modern-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">Rodada</th>
                  <th className="px-4 py-2 text-left">Fase</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rounds.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {PHASE_LABELS[r.phase] ?? r.phase}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Snapshot Modal */}
      {openSnapshotMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto w-full max-w-xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">
                Snapshot de Palpites
              </h2>
              <button
                onClick={() => setOpenSnapshotMatch(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {(() => {
                const match = matches.find((m) => m.id === openSnapshotMatch);
                const preds = (predictionsByMatch[openSnapshotMatch] ?? []).map((p) => ({
                  ...p,
                  rank_after: snapshotRankingDeltas.size > 0 ? (snapshotRankingDeltas.get(p.user_id)?.rank_after ?? null) : undefined,
                  position_delta: snapshotRankingDeltas.size > 0 ? (snapshotRankingDeltas.get(p.user_id)?.position_delta ?? null) : undefined,
                  current_rank: p.current_rank ?? null,
                }));

                if (!match)
                  return <p className="text-gray-500">Jogo não encontrado</p>;

                return (
                  <>
                    <SnapshotPredictions
                      matchId={match.id}
                      homeTeamName={match.home_team?.name ?? null}
                      homeTeamFlagCode={match.home_team?.flag_code ?? null}
                      awayTeamName={match.away_team?.name ?? null}
                      awayTeamFlagCode={match.away_team?.flag_code ?? null}
                      homeScore={match.home_score}
                      awayScore={match.away_score}
                      kickoffAt={match.kickoff_at}
                      venue={match.venue}
                      predictions={preds}
                      isFinished={match.status === 'encerrado'}
                      generatedAt={new Date().toISOString()}
                    />

                    <div className="mt-6 flex flex-col gap-2">
                      <button
                        onClick={() => handleExportImage(openSnapshotMatch)}
                        disabled={exportingImage}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 transition"
                      >
                        {exportingImage
                          ? 'Gerando imagem...'
                          : '📥 Baixar como Imagem PNG'}
                      </button>

                      <button
                        onClick={() => setOpenSnapshotMatch(null)}
                        className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2.5 rounded-lg transition"
                      >
                        Fechar
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Group Snapshot Modal */}
      {openSnapshotGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto w-full max-w-lg">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">
                Snapshot — Grupo {groupSections.find((s) => s.id === openSnapshotGroup)?.code ?? ''}
              </h2>
              <button
                onClick={() => setOpenSnapshotGroup(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {(() => {
                const section = groupSections.find((s) => s.id === openSnapshotGroup);
                const draft = groupStandingsDrafts[openSnapshotGroup] ?? { first_id: '', second_id: '' };
                const preds = groupPredsForSnapshot[openSnapshotGroup] ?? [];

                if (!section) return <p className="text-gray-500">Grupo não encontrado</p>;

                return (
                  <>
                    <SnapshotGroupPredictions
                      groupId={section.id}
                      groupCode={section.code}
                      realFirstTeam={
                        draft.first_id
                          ? (section.teams.find((t) => t.id === draft.first_id) ?? null)
                          : null
                      }
                      realSecondTeam={
                        draft.second_id
                          ? (section.teams.find((t) => t.id === draft.second_id) ?? null)
                          : null
                      }
                      predictions={preds}
                      generatedAt={new Date().toISOString()}
                    />

                    <div className="mt-6 flex flex-col gap-2">
                      <button
                        onClick={() => handleExportGroupImage(section.id, section.code)}
                        disabled={exportingGroupImage}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 transition"
                      >
                        {exportingGroupImage ? 'Gerando imagem...' : '📥 Baixar como Imagem PNG'}
                      </button>

                      <button
                        onClick={() => setOpenSnapshotGroup(null)}
                        className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2.5 rounded-lg transition"
                      >
                        Fechar
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Podium Snapshot Modal */}
      {openSnapshotPodium && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto w-full max-w-lg">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Snapshot — Pódio Final</h2>
              <button
                onClick={() => setOpenSnapshotPodium(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <SnapshotPodiumPredictions
                snapshotId="snapshot-podium"
                realChampion={
                  podiumStandingDraft.champion_id
                    ? (allTeams.find((t) => t.id === podiumStandingDraft.champion_id) ?? null)
                    : null
                }
                realVice={
                  podiumStandingDraft.vice_id
                    ? (allTeams.find((t) => t.id === podiumStandingDraft.vice_id) ?? null)
                    : null
                }
                realThird={
                  podiumStandingDraft.third_id
                    ? (allTeams.find((t) => t.id === podiumStandingDraft.third_id) ?? null)
                    : null
                }
                predictions={podiumPredsForSnapshot ?? []}
                generatedAt={new Date().toISOString()}
              />

              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={handleExportPodiumImage}
                  disabled={exportingPodiumImage}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 transition"
                >
                  {exportingPodiumImage ? 'Gerando imagem...' : '📥 Baixar como Imagem PNG'}
                </button>
                <button
                  onClick={() => setOpenSnapshotPodium(false)}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2.5 rounded-lg transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
