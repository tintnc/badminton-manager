import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Member } from '../core/models/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { IntegerInput } from '../components/ui/currency-input';
import { Clock, RefreshCw, RotateCw, Search, Star, Users as UsersIcon } from 'lucide-react';

interface Match {
  team1: Member[];
  team2: Member[];
  diff: number;
  partnerRepeats: number;
}

interface RotationRound {
  round: number;
  matches: Match[];
  resting: Member[];
}

const DEFAULT_SESSION_MINUTES = 120;
const DEFAULT_SET_POINTS = 21;
const DEFAULT_MINUTES_PER_SET = 24;
const MAX_ROUNDS = 12;

function pairKey(a: Member, b: Member) {
  return [a.id, b.id].sort().join(':');
}

function skillSum(players: Member[]) {
  return players.reduce((sum, player) => sum + (player.skillLevel || 2), 0);
}

function calculateBestMatch(players: Member[], partnerCounts = new Map<string, number>()): Match | null {
  if (players.length !== 4) return null;

  const [p1, p2, p3, p4] = players;
  const possibleMatches: Match[] = [
    {
      team1: [p1, p2],
      team2: [p3, p4],
      diff: Math.abs(skillSum([p1, p2]) - skillSum([p3, p4])),
      partnerRepeats: (partnerCounts.get(pairKey(p1, p2)) || 0) + (partnerCounts.get(pairKey(p3, p4)) || 0),
    },
    {
      team1: [p1, p3],
      team2: [p2, p4],
      diff: Math.abs(skillSum([p1, p3]) - skillSum([p2, p4])),
      partnerRepeats: (partnerCounts.get(pairKey(p1, p3)) || 0) + (partnerCounts.get(pairKey(p2, p4)) || 0),
    },
    {
      team1: [p1, p4],
      team2: [p2, p3],
      diff: Math.abs(skillSum([p1, p4]) - skillSum([p2, p3])),
      partnerRepeats: (partnerCounts.get(pairKey(p1, p4)) || 0) + (partnerCounts.get(pairKey(p2, p3)) || 0),
    },
  ];

  return possibleMatches.toSorted((a, b) => {
    const scoreA = a.diff * 100 + a.partnerRepeats * 12;
    const scoreB = b.diff * 100 + b.partnerRepeats * 12;
    return scoreA - scoreB;
  })[0];
}

function buildCourtGroups(players: Member[], courtCount: number, round: number): Member[][] {
  const sortedBySkill = players.toSorted((a, b) => {
    const skillDiff = (b.skillLevel || 2) - (a.skillLevel || 2);
    return skillDiff || a.name.localeCompare(b.name, 'vi');
  });
  const groups = Array.from({ length: courtCount }, () => [] as Member[]);

  sortedBySkill.forEach((player, index) => {
    const skillBand = Math.floor(index / courtCount);
    const courtIndex = (index + skillBand * (round - 1) + (round - 1)) % courtCount;
    groups[courtIndex].push(player);
  });

  return groups.filter(group => group.length === 4);
}

function generateRotationRounds(players: Member[], roundCount: number): RotationRound[] {
  if (players.length < 4 || roundCount <= 0) return [];

  const courtCount = Math.max(1, Math.floor(players.length / 4));
  const playersPerRound = courtCount * 4;
  const playedCounts = new Map(players.map(player => [player.id, 0]));
  const restCounts = new Map(players.map(player => [player.id, 0]));
  const partnerCounts = new Map<string, number>();
  const rounds: RotationRound[] = [];

  for (let round = 1; round <= roundCount; round += 1) {
    const selectedPlayers = players
      .toSorted((a, b) => {
        const playedDiff = (playedCounts.get(a.id) || 0) - (playedCounts.get(b.id) || 0);
        const restDiff = (restCounts.get(b.id) || 0) - (restCounts.get(a.id) || 0);
        return playedDiff || restDiff || a.name.localeCompare(b.name, 'vi');
      })
      .slice(0, playersPerRound);

    const selectedIds = new Set(selectedPlayers.map(player => player.id));
    const resting = players.filter(player => !selectedIds.has(player.id));
    const matches = buildCourtGroups(selectedPlayers, courtCount, round)
      .map(group => calculateBestMatch(group, partnerCounts))
      .filter((match): match is Match => Boolean(match));

    matches.forEach((match) => {
      [...match.team1, ...match.team2].forEach((player) => {
        playedCounts.set(player.id, (playedCounts.get(player.id) || 0) + 1);
      });
      partnerCounts.set(pairKey(match.team1[0], match.team1[1]), (partnerCounts.get(pairKey(match.team1[0], match.team1[1])) || 0) + 1);
      partnerCounts.set(pairKey(match.team2[0], match.team2[1]), (partnerCounts.get(pairKey(match.team2[0], match.team2[1])) || 0) + 1);
    });

    resting.forEach((player) => {
      restCounts.set(player.id, (restCounts.get(player.id) || 0) + 1);
    });

    rounds.push({ round, matches, resting });
  }

  return rounds;
}

function playerLabel(player: Member) {
  return player.nickname ? `${player.name} (${player.nickname})` : player.name;
}

export default function Pairing() {
  const { members } = useAppStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionMinutes, setSessionMinutes] = useState(DEFAULT_SESSION_MINUTES);
  const [setPoints, setSetPoints] = useState(DEFAULT_SET_POINTS);
  const [minutesPerSet, setMinutesPerSet] = useState(DEFAULT_MINUTES_PER_SET);

  const activeMembers = useMemo(
    () => members.filter(m => m.isActive).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [members]
  );

  const selectedPlayers = useMemo(
    () => activeMembers.filter(member => selectedIds.includes(member.id)),
    [activeMembers, selectedIds]
  );

  const filteredMembers = useMemo(
    () => activeMembers.filter(member =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.nickname?.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [activeMembers, searchTerm]
  );

  const estimatedRounds = useMemo(() => {
    const safeDuration = Math.max(1, sessionMinutes);
    const safeSetDuration = Math.max(1, minutesPerSet);
    return Math.min(MAX_ROUNDS, Math.max(1, Math.floor(safeDuration / safeSetDuration)));
  }, [minutesPerSet, sessionMinutes]);

  const rotationRounds = useMemo(
    () => generateRotationRounds(selectedPlayers, estimatedRounds),
    [estimatedRounds, selectedPlayers]
  );

  const courtCount = Math.max(1, Math.floor(selectedPlayers.length / 4));
  const restingPerRound = Math.max(0, selectedPlayers.length - courtCount * 4);

  const toggleMember = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const renderStars = (level: number) => {
    return Array.from({ length: 4 }).map((_, i) => (
      <Star key={i} className={`h-3 w-3 ${i < level ? 'fill-yellow-500 text-yellow-500 dark:fill-yellow-400 dark:text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} />
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Gợi ý xếp cặp</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Xoay vòng nhiều hiệp theo thời lượng buổi và set 21 điểm.
          </p>
        </div>
        <Button variant="outline" onClick={() => setSelectedIds([])} className="w-full sm:w-auto">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Làm mới
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="flex flex-col lg:col-span-5 lg:h-[calc(100vh-200px)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <UsersIcon className="h-5 w-5 text-primary" aria-hidden="true" />
              Chọn người chơi ({selectedIds.length})
            </CardTitle>
            <CardDescription>Chọn ít nhất 4 người để lên lịch xoay vòng.</CardDescription>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                name="player-search"
                autoComplete="off"
                placeholder="Tìm tên hoặc biệt danh…"
                className="pl-9"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pt-0">
            <div className="space-y-2">
              {filteredMembers.map((member) => {
                const isSelected = selectedIds.includes(member.id);
                return (
                  <Label
                    key={member.id}
                    htmlFor={`pairing-member-${member.id}`}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-[background-color,border-color,box-shadow] ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-transparent hover:bg-muted'
                    }`}
                  >
                    <Checkbox
                      id={`pairing-member-${member.id}`}
                      checked={isSelected}
                      onCheckedChange={() => toggleMember(member.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {member.name} {member.nickname && <span className="font-normal text-muted-foreground">({member.nickname})</span>}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1">
                        {renderStars(member.skillLevel || 2)}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      LV {member.skillLevel || 2}
                    </Badge>
                  </Label>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col bg-muted/20 lg:col-span-7 lg:h-[calc(100vh-200px)]">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <RotateCw className="h-5 w-5 text-primary" aria-hidden="true" />
                  Lịch xoay vòng đề xuất
                </CardTitle>
                <CardDescription>
                  Mỗi sân 4 người, người dư sẽ nghỉ luân phiên giữa các hiệp.
                </CardDescription>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs sm:min-w-[360px]">
                <Metric label="Số hiệp" value={`${estimatedRounds}`} />
                <Metric label="Số sân" value={selectedPlayers.length >= 4 ? `${courtCount}` : '0'} />
                <Metric label="Nghỉ/hiệp" value={`${restingPerRound}`} />
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sessionMinutes" className="text-xs">Thời lượng buổi (phút)</Label>
                <IntegerInput id="sessionMinutes" value={sessionMinutes} min={1} onChange={setSessionMinutes} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="setPoints" className="text-xs">Điểm / set</Label>
                <IntegerInput id="setPoints" value={setPoints} min={1} onChange={setSetPoints} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minutesPerSet" className="text-xs">Phút / hiệp {setPoints > 0 ? `(${setPoints} điểm)` : ''}</Label>
                <IntegerInput id="minutesPerSet" value={minutesPerSet} min={1} onChange={setMinutesPerSet} />
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto">
            {selectedPlayers.length < 4 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="mb-4 rounded-full bg-muted p-6">
                  <UsersIcon className="h-12 w-12 text-muted-foreground opacity-50" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-medium text-muted-foreground">Chưa đủ người chơi</h3>
                <p className="mt-2 max-w-[250px] text-sm text-muted-foreground">
                  Cần ít nhất 4 người để tạo lịch xoay vòng.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm font-medium text-primary sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    {sessionMinutes} phút · set {setPoints} điểm · khoảng {minutesPerSet} phút/hiệp
                  </div>
                  <span>{rotationRounds.length} hiệp được tạo</span>
                </div>

                {rotationRounds.map((round) => (
                  <RoundCard key={round.round} round={round} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function RoundCard({ round }: { round: RotationRound }) {
  return (
    <Card className="overflow-hidden border-primary/10">
      <div className="flex flex-col gap-2 border-b bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="default">Hiệp {round.round}</Badge>
          <span className="text-sm font-medium text-muted-foreground">{round.matches.length} sân</span>
        </div>
        {round.resting.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Nghỉ: <span className="font-semibold text-foreground">{round.resting.map(playerLabel).join(', ')}</span>
          </div>
        )}
      </div>
      <CardContent className="space-y-3 p-4">
        {round.matches.map((match, index) => (
          <MatchCard key={`${round.round}-${index}`} match={match} title={`Sân ${index + 1}`} />
        ))}
      </CardContent>
    </Card>
  );
}

function MatchCard({ match, title }: { match: Match; title: string }) {
  const sum1 = skillSum(match.team1);
  const sum2 = skillSum(match.team2);

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="flex flex-col gap-2 border-b bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-sm font-bold text-foreground">{title}</h4>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">Lệch {match.diff}</Badge>
          {match.partnerRepeats > 0 && <Badge variant="secondary">Lặp cặp {match.partnerRepeats}</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-11 sm:items-center">
        <TeamBlock label={`Đội A · Tổng ${sum1}`} players={match.team1} />
        <div className="flex flex-col items-center justify-center sm:col-span-1">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-black italic text-primary-foreground shadow-lg">
            VS
          </div>
        </div>
        <TeamBlock label={`Đội B · Tổng ${sum2}`} players={match.team2} />
      </div>
    </div>
  );
}

function TeamBlock({ label, players }: { label: string; players: Member[] }) {
  return (
    <div className="space-y-2 sm:col-span-5">
      <div className="text-center">
        <span className="text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
      </div>
      {players.map(player => (
        <div key={player.id} className="flex flex-col items-center rounded-lg border bg-card p-2 shadow-sm">
          <span className="max-w-full truncate text-sm font-bold">{playerLabel(player)}</span>
          <span className="text-[10px] text-muted-foreground">LV {player.skillLevel}</span>
        </div>
      ))}
    </div>
  );
}
