import { useAppStore } from '../store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { formatFullDate, formatShortDate, formatVnd } from '../lib/format';

const categoryLabels: Record<string, string> = {
  support_fund: 'Quỹ hỗ trợ',
  member_payment: 'Thu thành viên',
  court_fee: 'Tiền sân',
  shuttlecock_fee: 'Tiền cầu',
  other: 'Khác',
};

export default function Finance() {
  const { transactions, settings, members, sessions, globalMonth, globalYear } = useAppStore();

  // Calculate from completed sessions for accuracy
  const currentMonthStr = `${globalYear}-${String(globalMonth + 1).padStart(2, '0')}`;
  const completedThisMonth = sessions.filter(
    s => s.status === 'completed' && s.date.startsWith(currentMonthStr)
  );

  const totalSubsidyUsed = completedThisMonth.reduce((sum, s) => sum + (s.fundSubsidyUsed || 0), 0);
  const remainingFund = Math.max(0, settings.monthlySupportFund - totalSubsidyUsed);
  const totalExpenses = completedThisMonth.reduce((sum, s) => sum + (s.totalCost || 0), 0);

  // Build member stats: sum up costPerPersonNoSubsidy for each member across all completed sessions this month
  const memberStats = members
    .filter(m => m.isActive)
    .map(member => {
      const sessionsAttended = completedThisMonth.filter(s => s.attendeeIds.includes(member.id));
      const totalNoSubsidy = sessionsAttended.reduce((sum, s) => sum + (s.costPerPersonNoSubsidy || 0), 0);
      const totalWithSubsidy = sessionsAttended.reduce((sum, s) => sum + (s.costPerPerson || 0), 0);
      const savings = totalNoSubsidy - totalWithSubsidy;
      return {
        member,
        sessionsCount: sessionsAttended.length,
        totalNoSubsidy,
        totalWithSubsidy,
        savings,
      };
    })
    .filter(e => e.sessionsCount > 0)
    .sort((a, b) => b.sessionsCount - a.sessionsCount);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Tài chính</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quỹ ban đầu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatVnd(settings.monthlySupportFund)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Đã hỗ trợ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">-{formatVnd(totalSubsidyUsed)}</div>
            <p className="text-xs text-muted-foreground">Từ {completedThisMonth.length} buổi đánh</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quỹ còn lại</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${remainingFund <= 0 ? 'text-destructive' : 'text-primary'}`}>
              {formatVnd(remainingFund)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tổng chi phí</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatVnd(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">Sân + Cầu tháng này</p>
          </CardContent>
        </Card>
      </div>

      {/* Member monthly stats */}
      <Card>
        <CardHeader>
          <CardTitle>Thống kê theo thành viên (tháng này)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thành viên</TableHead>
                <TableHead className="text-right">Số buổi</TableHead>
                <TableHead className="text-right">Giá gốc (tổng)</TableHead>
                <TableHead className="text-right">Sau hỗ trợ (tổng)</TableHead>
                <TableHead className="text-right">Tiết kiệm</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Chưa có dữ liệu. Hoàn thành buổi đánh để xem thống kê.
                  </TableCell>
                </TableRow>
              ) : (
                memberStats.map(({ member, sessionsCount, totalNoSubsidy, totalWithSubsidy, savings }) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.name}
                      {member.nickname && <span className="text-muted-foreground ml-1">({member.nickname})</span>}
                    </TableCell>
                    <TableCell className="text-right">{sessionsCount}</TableCell>
                    <TableCell className="text-right">{formatVnd(totalNoSubsidy)}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{formatVnd(totalWithSubsidy)}</TableCell>
                    <TableCell className="text-right text-green-600 font-medium">
                      {savings > 0 ? `-${formatVnd(savings)}` : formatVnd(0)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Session-by-session breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Chi tiết theo buổi đánh</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead className="text-right">Tiền sân</TableHead>
                <TableHead className="text-right">Tiền cầu</TableHead>
                <TableHead className="text-right">Tổng</TableHead>
                <TableHead className="text-right">Quỹ trợ</TableHead>
                <TableHead className="text-right">Giá gốc</TableHead>
                <TableHead className="text-right">Sau hỗ trợ</TableHead>
                <TableHead className="text-right">Người</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedThisMonth.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    Chưa có buổi đánh nào hoàn thành trong tháng.
                  </TableCell>
                </TableRow>
              ) : (
                completedThisMonth
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{formatShortDate(s.date)}</TableCell>
                      <TableCell className="text-right">{formatVnd(s.courtFee)}</TableCell>
                      <TableCell className="text-right">{formatVnd(s.shuttlecockFee || 0)}</TableCell>
                      <TableCell className="text-right font-medium">{formatVnd(s.totalCost || 0)}</TableCell>
                      <TableCell className="text-right text-green-600">-{formatVnd(s.fundSubsidyUsed || 0)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatVnd(s.costPerPersonNoSubsidy || 0)}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{formatVnd(s.costPerPerson || 0)}</TableCell>
                      <TableCell className="text-right">{s.attendeeIds.length + s.guestCount}</TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transaction log */}
      <Card>
        <CardHeader>
          <CardTitle>Lịch sử giao dịch</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Danh mục</TableHead>
                <TableHead>Thành viên</TableHead>
                <TableHead className="text-right">Số tiền</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Chưa có giao dịch nào. Hoàn thành một buổi đánh để tự động tạo giao dịch.
                  </TableCell>
                </TableRow>
              ) : (
                transactions
                  .toSorted((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell>{formatFullDate(tx.date)}</TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{categoryLabels[tx.category] || tx.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {tx.relatedMemberId ? members.find(m => m.id === tx.relatedMemberId)?.name || 'Không rõ' : '-'}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatVnd(tx.amount)}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
