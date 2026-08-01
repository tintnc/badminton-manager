import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Wallet, Users, CalendarDays, TrendingDown, CheckCircle2, Trophy } from 'lucide-react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { formatNumber, formatShortDate, formatVnd } from '@/lib/format';

export default function Dashboard() {
  const { members, sessions, settings, globalMonth, globalYear } = useAppStore();

  const activeMembers = members.filter((m: { isActive: boolean }) => m.isActive).length;

  // Selected month filter
  const currentMonthStr = `${globalYear}-${String(globalMonth + 1).padStart(2, '0')}`;
  const sessionsThisMonth = sessions.filter((s: { date: string }) => s.date.startsWith(currentMonthStr));
  const completedThisMonth = sessionsThisMonth.filter(s => s.status === 'completed');
  const plannedThisMonth = sessionsThisMonth.filter(s => s.status === 'planned');

  // Fund usage: sum of subsidies used from completed sessions this month
  const totalSubsidyUsed = completedThisMonth.reduce((sum, s) => sum + (s.fundSubsidyUsed || 0), 0);
  const remainingFund = Math.max(0, settings.monthlySupportFund - totalSubsidyUsed);

  // Total expenses this month (court + shuttlecock)
  const totalExpensesThisMonth = completedThisMonth.reduce((sum, s) => sum + (s.totalCost || 0), 0);

  // Build chart data from completed sessions (sorted by date)
  const chartData = completedThisMonth
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce((acc: { name: string; quỹ_còn_lại: number; chi_phí: number }[], session, i) => {
      const prevFund = i === 0 ? settings.monthlySupportFund : acc[i - 1].quỹ_còn_lại;
      acc.push({
        name: formatShortDate(session.date),
        quỹ_còn_lại: prevFund - (session.fundSubsidyUsed || 0),
        chi_phí: session.totalCost || 0,
      });
      return acc;
    }, []);

  // Attendance leaderboard
  const attendanceCounts: Record<string, number> = {};
  completedThisMonth.forEach(s => {
    s.attendeeIds.forEach(id => {
      attendanceCounts[id] = (attendanceCounts[id] || 0) + 1;
    });
  });
  const leaderboard = Object.entries(attendanceCounts)
    .map(([id, count]) => ({
      member: members.find(m => m.id === id),
      count,
    }))
    .filter(e => e.member)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const memberAttendanceStats = members
    .filter(m => m.isActive)
    .map(member => {
      const count = attendanceCounts[member.id] || 0;
      const percent = completedThisMonth.length > 0 
        ? Math.round((count / completedThisMonth.length) * 100) 
        : 0;
      return {
        member,
        count,
        percent,
      };
    })
    .sort((a, b) => b.count - a.count || a.member.name.localeCompare(b.member.name));

  const getProgressBarColor = (percent: number) => {
    if (percent >= 80) return 'bg-gradient-to-r from-emerald-500 to-teal-400 dark:from-emerald-400 dark:to-teal-300';
    if (percent >= 50) return 'bg-gradient-to-r from-cyan-500 to-blue-400 dark:from-cyan-400 dark:to-blue-300';
    if (percent >= 25) return 'bg-gradient-to-r from-amber-500 to-orange-400 dark:from-amber-400 dark:to-orange-300';
    if (percent > 0) return 'bg-gradient-to-r from-rose-500 to-pink-400 dark:from-rose-400 dark:to-pink-300';
    return 'bg-slate-200 dark:bg-slate-800';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tổng quan"
        description="Xem nhanh quỹ, buổi đánh và tần suất tham gia trong tháng hiện tại."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          variant="vertical"
          label="Quỹ còn lại"
          value={formatVnd(remainingFund)}
          detail={`Quỹ ban đầu: ${formatVnd(settings.monthlySupportFund)} · Đã dùng: ${formatVnd(totalSubsidyUsed)}`}
          icon={Wallet}
          tone={remainingFund <= 0 ? 'danger' : 'default'}
          revealDelay={0}
        />
        <StatCard
          variant="vertical"
          label="Thành viên"
          value={activeMembers}
          detail="Người chơi đang hoạt động"
          icon={Users}
          revealDelay={80}
        />
        <StatCard
          variant="vertical"
          label="Chi phí tháng này"
          value={formatVnd(totalExpensesThisMonth)}
          detail={`Tổng sân + cầu từ ${completedThisMonth.length} buổi`}
          icon={TrendingDown}
          tone="danger"
          revealDelay={160}
        />
        <StatCard
          variant="vertical"
          label="Buổi đánh"
          value={
            <>
              <span className="text-primary">{completedThisMonth.length}</span>
              <span className="text-muted-foreground text-base font-normal"> / {sessionsThisMonth.length}</span>
            </>
          }
          detail={`Đã hoàn thành · Còn ${plannedThisMonth.length} buổi chưa điểm danh`}
          icon={CalendarDays}
          revealDelay={240}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Tần suất tham gia chi tiết */}
        <Card className="flex flex-col lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold">Tần suất tham gia</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-[380px] pr-2">
            {memberAttendanceStats.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Chưa có dữ liệu tham gia trong tháng này.
              </div>
            ) : (
              <div className="space-y-4">
                {memberAttendanceStats.map(({ member, count, percent }) => (
                  <div key={member.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-semibold text-foreground">
                        {member.name} {member.nickname && <span className="text-muted-foreground font-normal text-xs ml-1">({member.nickname})</span>}
                      </span>
                      <span className="text-xs font-mono font-bold text-muted-foreground shrink-0">
                        {count}/{completedThisMonth.length} buổi ({percent}%)
                      </span>
                    </div>
                    <div className="h-3 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                      <div 
                        className={`h-full rounded-full shadow-sm transition-[width] duration-500 ease-out ${getProgressBarColor(percent)}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bảng xếp hạng tham gia */}
        <Card className="flex flex-col lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle>Top 5 tham gia nhiều nhất</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-4">
              {leaderboard.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  title="Chưa có bảng xếp hạng"
                  description="Hoàn thành một buổi đánh để theo dõi ai tham gia nhiều nhất."
                />
              ) : (
                leaderboard.map((entry, i) => (
                  <div key={entry.member!.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 ring-2 ring-yellow-400/20'
                        : i === 1 ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 ring-2 ring-gray-400/20'
                        : i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 ring-2 ring-orange-400/20'
                        : 'bg-muted text-muted-foreground'
                      }`}>
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{entry.member!.name}</p>
                        {entry.member!.nickname && (
                          <p className="text-xs text-muted-foreground">{entry.member!.nickname}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {entry.count} buổi
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Biểu đồ quỹ & chi phí */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Biểu đồ quỹ & chi phí</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <div className="h-[300px] w-full">
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Hoàn thành buổi đánh đầu tiên để xem biểu đồ
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFund" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => `${formatNumber(value / 1000)}k`} />
                  <Tooltip formatter={(value) => [formatVnd(Number(value ?? 0)), ""]} labelFormatter={(label) => `Buổi ${label}`} />
                  <Area type="monotone" name="Quỹ còn lại" dataKey="quỹ_còn_lại" stroke="hsl(var(--success))" fillOpacity={1} fill="url(#colorFund)" />
                  <Area type="monotone" name="Chi phí" dataKey="chi_phí" stroke="hsl(var(--destructive))" fillOpacity={1} fill="url(#colorExpenses)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
