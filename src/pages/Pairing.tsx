import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Member } from '../core/models/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Users as UsersIcon, Swords, RefreshCw, Search, Star } from 'lucide-react';

interface Match {
  team1: Member[];
  team2: Member[];
  diff: number;
  totalSkill: number;
}

export default function Pairing() {
  const { members } = useAppStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const activeMembers = useMemo(() => 
    members.filter(m => m.isActive).sort((a, b) => a.name.localeCompare(b.name)),
  [members]);

  const filteredMembers = useMemo(() => 
    activeMembers.filter(m => 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      m.nickname?.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  [activeMembers, searchTerm]);

  const toggleMember = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const calculateBestMatch = (players: Member[]): Match | null => {
    if (players.length !== 4) return null;

    const [p1, p2, p3, p4] = players;
    
    const possibleMatches: Match[] = [
      {
        team1: [p1, p2],
        team2: [p3, p4],
        diff: Math.abs((p1.skillLevel + p2.skillLevel) - (p3.skillLevel + p4.skillLevel)),
        totalSkill: p1.skillLevel + p2.skillLevel + p3.skillLevel + p4.skillLevel
      },
      {
        team1: [p1, p3],
        team2: [p2, p4],
        diff: Math.abs((p1.skillLevel + p3.skillLevel) - (p2.skillLevel + p4.skillLevel)),
        totalSkill: p1.skillLevel + p3.skillLevel + p2.skillLevel + p4.skillLevel
      },
      {
        team1: [p1, p4],
        team2: [p2, p3],
        diff: Math.abs((p1.skillLevel + p4.skillLevel) - (p2.skillLevel + p3.skillLevel)),
        totalSkill: p1.skillLevel + p4.skillLevel + p2.skillLevel + p3.skillLevel
      }
    ];

    return possibleMatches.sort((a, b) => a.diff - b.diff)[0];
  };

  // Helper to get skill stars
  const renderStars = (level: number) => {
    return Array.from({ length: 4 }).map((_, i) => (
      <Star key={i} className={`h-3 w-3 ${i < level ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Gợi ý xếp cặp</h1>
        <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
          <RefreshCw className="mr-2 h-4 w-4" /> Làm mới
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Selection Panel */}
        <Card className="lg:col-span-5 flex flex-col h-[calc(100vh-200px)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-primary" />
              Chọn người chơi ({selectedIds.length})
            </CardTitle>
            <CardDescription>Chọn ít nhất 4 người để gợi ý xếp cặp</CardDescription>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                name="player-search"
                autoComplete="off"
                placeholder="Tìm tên hoặc biệt danh…"
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pt-0">
            <div className="space-y-2">
              {filteredMembers.map((member) => (
                <Label
                  key={member.id}
                  htmlFor={`pairing-member-${member.id}`}
                  className={`flex items-center space-x-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedIds.includes(member.id)
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-transparent hover:bg-muted'
                  }`}
                >
                  <Checkbox
                    id={`pairing-member-${member.id}`}
                    checked={selectedIds.includes(member.id)}
                    onCheckedChange={() => toggleMember(member.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {member.name} {member.nickname && <span className="text-muted-foreground font-normal">({member.nickname})</span>}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {renderStars(member.skillLevel || 2)}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    LV {member.skillLevel || 2}
                  </Badge>
                </Label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pairing Panel */}
        <Card className="lg:col-span-7 flex flex-col h-[calc(100vh-200px)] bg-muted/20">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Swords className="h-5 w-5 text-primary" />
              Cặp đấu đề xuất
            </CardTitle>
            <CardDescription>
              Thuật toán sẽ cân bằng tổng trình độ giữa hai đội
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {selectedIds.length < 4 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="bg-muted rounded-full p-6 mb-4">
                  <UsersIcon className="h-12 w-12 text-muted-foreground opacity-50" />
                </div>
                <h3 className="text-lg font-medium text-muted-foreground">Chưa đủ người chơi</h3>
                <p className="text-sm text-muted-foreground max-w-[250px] mt-2">
                  Vui lòng chọn ít nhất 4 người chơi từ danh sách bên trái để bắt đầu xếp cặp.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Logic for matches */}
                {(() => {
                  const players = members.filter(m => selectedIds.includes(m.id));
                  
                  if (players.length === 4) {
                    const match = calculateBestMatch(players);
                    if (!match) return null;
                    return (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none">
                        <MatchCard match={match} title="Trận đấu cân bằng nhất" />
                      </div>
                    );
                  }

                  if (players.length > 4) {
                    // If more than 4, let's just pick the first 4 for now, 
                    // OR try to find multiple matches if 8, 12 etc.
                    const groups: Member[][] = [];
                    for (let i = 0; i < players.length; i += 4) {
                      if (i + 4 <= players.length) {
                        groups.push(players.slice(i, i + 4));
                      }
                    }

                    return (
                      <div className="space-y-4">
                        <div className="bg-primary/10 p-3 rounded-lg border border-primary/20 text-sm text-primary font-medium flex items-center gap-2">
                          <RefreshCw className="h-4 w-4" />
                          Đã chia {groups.length} sân dựa trên thứ tự chọn
                        </div>
                        {groups.map((group, idx) => {
                          const match = calculateBestMatch(group);
                          if (!match) return null;
                          return <MatchCard key={idx} match={match} title={`Sân ${idx + 1}`} />;
                        })}
                        {players.length % 4 !== 0 && (
                          <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-100 text-yellow-800 text-sm italic">
                            Còn dư {players.length % 4} người đang chờ xoay vòng.
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MatchCard({ match, title }: { match: Match; title: string }) {
  const sum1 = match.team1.reduce((s, p) => s + p.skillLevel, 0);
  const sum2 = match.team2.reduce((s, p) => s + p.skillLevel, 0);

  return (
    <Card className="overflow-hidden border-2 border-primary/10">
      <div className="bg-primary/5 px-4 py-2 border-b flex justify-between items-center">
        <h4 className="font-bold text-sm uppercase tracking-wider text-primary">{title}</h4>
        <Badge variant="outline" className="bg-background">
          Độ lệch: {match.diff}
        </Badge>
      </div>
      <CardContent className="p-0">
        <div className="grid grid-cols-11 items-center p-4 gap-2">
          {/* Team 1 */}
          <div className="col-span-5 space-y-2">
            <div className="text-center mb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Team A (Tổng: {sum1})</span>
            </div>
            {match.team1.map(p => (
              <div key={p.id} className="p-2 rounded-lg bg-card border shadow-sm flex flex-col items-center">
                <span className="font-bold text-sm">{p.name}</span>
                <span className="text-[10px] text-muted-foreground">LV {p.skillLevel}</span>
              </div>
            ))}
          </div>

          {/* VS */}
          <div className="col-span-1 flex flex-col items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-xs italic shadow-lg">
              VS
            </div>
          </div>

          {/* Team 2 */}
          <div className="col-span-5 space-y-2">
            <div className="text-center mb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Team B (Tổng: {sum2})</span>
            </div>
            {match.team2.map(p => (
              <div key={p.id} className="p-2 rounded-lg bg-card border shadow-sm flex flex-col items-center">
                <span className="font-bold text-sm">{p.name}</span>
                <span className="text-[10px] text-muted-foreground">LV {p.skillLevel}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
