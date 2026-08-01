import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { StatCard } from '../components/ui/stat-card';
import { AlertCircle, CheckCircle2, QrCode, ReceiptText, Users } from 'lucide-react';
import { formatFullDate, formatShortDate, formatVnd } from '../lib/format';
import { PageHeader } from '../components/ui/page-header';
import type { Member, Session } from '../core/models/types';
import { MemberFinanceService } from '../core/services/MemberFinanceService';
import { buildGuestPaymentDescription, buildSepayQrUrl, guestPaymentQrConfig } from '../lib/payment-qr';

const categoryLabels: Record<string, string> = {
  support_fund: 'Quỹ hỗ trợ',
  member_payment: 'Quỹ thành viên',
  court_fee: 'Tiền sân',
  shuttlecock_fee: 'Tiền cầu',
  shuttlecock_purchase: 'Mua cầu',
  other: 'Khác',
};

export default function Finance() {
  const {
    transactions,
    settings,
    members,
    sessions,
    globalMonth,
    globalYear,
    addTransaction,
    updateMember,
  } = useAppStore();
  const [collectingKey, setCollectingKey] = useState('');

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

  const guestCollections = useMemo(() => {
    const completedSessions = sessions.filter(session => session.status === 'completed');

    const rows = members
      .filter(member => (member.membershipType || 'regular') === 'guest')
      .map((member) => {
        const paidSessionIds = new Set(member.paidSessionIds || []);
        const attendedSessions = completedSessions
          .filter(session => session.attendeeIds.includes(member.id))
          .toSorted((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const unpaidSessions = attendedSessions.filter(session => !paidSessionIds.has(session.id));
        const unpaidThisMonth = unpaidSessions.filter(session => session.date.startsWith(currentMonthStr));

        return {
          member,
          unpaidSessions,
          unpaidThisMonth,
          totalDebt: unpaidSessions.length * settings.guestFee,
        };
      })
      .filter(row => row.unpaidSessions.length > 0)
      .toSorted((a, b) => b.totalDebt - a.totalDebt || a.member.name.localeCompare(b.member.name, 'vi'));

    return {
      rows,
      totalDebt: rows.reduce((sum, row) => sum + row.totalDebt, 0),
      totalUnpaidSessions: rows.reduce((sum, row) => sum + row.unpaidSessions.length, 0),
      totalDebtors: rows.length,
    };
  }, [currentMonthStr, members, sessions, settings.guestFee]);

  const getGuestDebt = (member: Member, paidSessionIds: string[]) =>
    MemberFinanceService.getGuestDebt({ ...member, paidSessionIds }, sessions, settings.guestFee);

  const collectGuestSession = async (member: Member, session: Session) => {
    const key = `${member.id}:${session.id}`;
    if (collectingKey) return;
    setCollectingKey(key);
    try {
      const paidSessionIds = member.paidSessionIds || [];
      if (paidSessionIds.includes(session.id)) return;

      const nextPaidSessionIds = [...paidSessionIds, session.id];
      await addTransaction({
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        type: 'income',
        category: 'member_payment',
        amount: settings.guestFee,
        description: `Thu tiền vãng lai ${member.name} buổi ${formatShortDate(session.date)}`,
        relatedMemberId: member.id,
        relatedSessionId: session.id,
      });
      await updateMember({
        ...member,
        paidSessionIds: nextPaidSessionIds,
        debt: getGuestDebt(member, nextPaidSessionIds),
      });
    } finally {
      setCollectingKey('');
    }
  };

  const collectAllGuestSessions = async (member: Member, unpaidSessions: Session[]) => {
    const key = `${member.id}:all`;
    if (collectingKey || unpaidSessions.length === 0) return;
    setCollectingKey(key);
    try {
      const paidSessionIds = member.paidSessionIds || [];
      const paidIdSet = new Set(paidSessionIds);
      const sessionsToCollect = unpaidSessions.filter(session => !paidIdSet.has(session.id));

      for (const session of sessionsToCollect) {
        await addTransaction({
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          type: 'income',
          category: 'member_payment',
          amount: settings.guestFee,
          description: `Thu tiền vãng lai ${member.name} buổi ${formatShortDate(session.date)}`,
          relatedMemberId: member.id,
          relatedSessionId: session.id,
        });
      }

      const nextPaidSessionIds = [...paidSessionIds, ...sessionsToCollect.map(session => session.id)];
      await updateMember({
        ...member,
        paidSessionIds: nextPaidSessionIds,
        debt: getGuestDebt(member, nextPaidSessionIds),
      });
    } finally {
      setCollectingKey('');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tài chính"
        description="Theo dõi quỹ hỗ trợ, chi phí và thanh toán khách vãng lai mỗi tháng."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          variant="vertical"
          label="Quỹ ban đầu"
          value={formatVnd(settings.monthlySupportFund)}
          revealDelay={0}
        />
        <StatCard
          variant="vertical"
          label="Đã hỗ trợ"
          value={`-${formatVnd(totalSubsidyUsed)}`}
          detail={`Từ ${completedThisMonth.length} buổi đánh`}
          tone="warning"
          revealDelay={80}
        />
        <StatCard
          variant="vertical"
          label="Quỹ còn lại"
          value={formatVnd(remainingFund)}
          tone={remainingFund <= 0 ? 'danger' : 'success'}
          revealDelay={160}
        />
        <StatCard
          variant="vertical"
          label="Tổng chi phí"
          value={formatVnd(totalExpenses)}
          detail="Sân + Cầu tháng này"
          tone="danger"
          revealDelay={240}
        />
      </div>

      {/* Member monthly stats */}
      <Card>
        <CardHeader>
          <CardTitle>Thống kê theo thành viên (tháng này)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[720px]">
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
                    <TableCell className="text-right font-medium text-success">
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
          <Table className="min-w-[860px]">
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
                      <TableCell className="text-right text-success">-{formatVnd(s.fundSubsidyUsed || 0)}</TableCell>
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

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-primary" aria-hidden="true" />
                Thu Tiền Vãng Lai
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Gom các khách vãng lai còn thiếu để tick thu tiền nhanh theo từng buổi.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs sm:min-w-[360px]">
              <div className="rounded-md bg-muted/50 p-2">
                <div className="flex items-center gap-1 font-medium text-muted-foreground">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" /> Người thiếu
                </div>
                <div className="mt-1 text-lg font-bold tabular-nums">{guestCollections.totalDebtors}</div>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <div className="flex items-center gap-1 font-medium text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> Buổi thiếu
                </div>
                <div className="mt-1 text-lg font-bold tabular-nums">{guestCollections.totalUnpaidSessions}</div>
              </div>
              <div className="rounded-md bg-destructive/10 p-2">
                <div className="font-medium text-destructive">Tổng thiếu</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-destructive">{formatVnd(guestCollections.totalDebt)}</div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead>Khách</TableHead>
                <TableHead>Buổi chưa thu</TableHead>
                <TableHead>QR thanh toán</TableHead>
                <TableHead className="text-right">Thiếu tháng này</TableHead>
                <TableHead className="text-right">Tổng thiếu</TableHead>
                <TableHead className="text-right">Thu nhanh</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guestCollections.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    Không có khách vãng lai nào đang thiếu tiền.
                  </TableCell>
                </TableRow>
              ) : (
                guestCollections.rows.map(({ member, unpaidSessions, unpaidThisMonth, totalDebt }) => {
                  const paymentDescription = buildGuestPaymentDescription(member, unpaidSessions);
                  const paymentQrUrl = buildSepayQrUrl(totalDebt, paymentDescription);

                  return (
                    <TableRow key={member.id} className="align-top">
                      <TableCell className="font-medium">
                        <div className="min-w-0">
                          <div className="truncate">{member.name}</div>
                          {member.nickname && <div className="truncate text-xs text-muted-foreground">{member.nickname}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-[520px] flex-wrap gap-2">
                          {unpaidSessions.map((session) => {
                            const key = `${member.id}:${session.id}`;
                            const isCollecting = collectingKey === key;

                            return (
                              <label
                                key={session.id}
                                htmlFor={`collect-${member.id}-${session.id}`}
                                className="inline-flex min-h-8 items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
                              >
                                <Checkbox
                                  id={`collect-${member.id}-${session.id}`}
                                  checked={isCollecting}
                                  disabled={Boolean(collectingKey)}
                                  onCheckedChange={(checked) => {
                                    if (checked) void collectGuestSession(member, session);
                                  }}
                                />
                                <span className="tabular-nums">{formatShortDate(session.date)}</span>
                              </label>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-[300px] items-center gap-3">
                          <div className="flex size-20 shrink-0 items-center justify-center rounded-md border bg-white p-1">
                            <img
                              src={paymentQrUrl}
                              alt={`QR thanh toán ${formatVnd(totalDebt)} cho ${member.name}`}
                              className="size-full object-contain"
                              loading="lazy"
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                              {guestPaymentQrConfig.bank} · {guestPaymentQrConfig.account}
                            </div>
                            <div className="break-words text-xs font-medium leading-relaxed text-foreground">
                              {paymentDescription}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatVnd(unpaidThisMonth.length * settings.guestFee)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive tabular-nums">
                        {formatVnd(totalDebt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(collectingKey)}
                          onClick={() => void collectAllGuestSessions(member, unpaidSessions)}
                        >
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          <span>{collectingKey === `${member.id}:all` ? 'Đang thu…' : 'Thu hết'}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
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
          <Table className="min-w-[820px]">
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
                      <TableCell className={`text-right font-medium tabular-nums ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
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
