import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Session } from '../core/models/types';
import { ScheduleGenerator } from '../core/services/ScheduleGenerator';
import { CostCalculator } from '../core/services/CostCalculator';
import { Calendar, Users as UsersIcon, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { formatFullDate, formatShortDate, formatVnd } from '../lib/format';

import { CurrencyInput, IntegerInput } from '../components/ui/currency-input';

export default function Sessions() {
  const { 
    sessions, 
    saveSessions, 
    members, 
    settings, 
    updateSession, 
    addTransaction, 
    deleteTransactionsBySession, 
    updateMember,
    globalMonth,
    globalYear 
  } = useAppStore();
  
  const selectedMonth = globalMonth;
  const selectedYear = globalYear;

  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isGenerateConfirmOpen, setIsGenerateConfirmOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<Session | null>(null);

  function MemberTypeBadge({ type }: { type?: 'employee' | 'guest' | 'regular' }) {
    const t = type || 'regular';
    if (t === 'employee') {
      return (
        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          Nhân viên
        </span>
      );
    }
    if (t === 'guest') {
      return (
        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          Vãng lai
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
        Thường
      </span>
    );
  }

  const filteredSessions = sessions.filter(s => {
    const d = new Date(s.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const createSchedule = async () => {
    const newSessions = ScheduleGenerator.generateForMonth(
      selectedYear,
      selectedMonth,
      settings.defaultLocation,
      settings.defaultStartTime,
      settings.defaultEndTime
    );
    await saveSessions(newSessions);
    setIsGenerateConfirmOpen(false);
  };

  const handleGenerate = async () => {
    if (filteredSessions.length > 0) {
      setIsGenerateConfirmOpen(true);
      return;
    }
    await createSchedule();
  };

  const openAttendance = (session: Session) => {
    // Ensure legacy sessions have shuttlecocksUsed (default to 0 if missing)
    const s: Session = { ...session, shuttlecocksUsed: session.shuttlecocksUsed ?? 0 };
    setActiveSession(s);
    setIsAttendanceOpen(true);
  };

  const toggleAttendance = (memberId: string) => {
    if (!activeSession) return;
    const isAttending = activeSession.attendeeIds.includes(memberId);
    const newAttendees = isAttending
      ? activeSession.attendeeIds.filter(id => id !== memberId)
      : [...activeSession.attendeeIds, memberId];
    setActiveSession({ ...activeSession, attendeeIds: newAttendees });
  };

  // Calculate how much fund is still available this month
  // = monthlySupportFund - sum of fundSubsidyUsed from all OTHER completed sessions this month
  const getRemainingFund = (excludeSessionId?: string) => {
    const currentMonthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const usedThisMonth = sessions
      .filter(s => s.status === 'completed' && s.date.startsWith(currentMonthStr) && s.id !== excludeSessionId)
      .reduce((sum, s) => sum + (s.fundSubsidyUsed || 0), 0);
    return Math.max(0, settings.monthlySupportFund - usedThisMonth);
  };

  // Live calculation based on current session state
  const getCalcDetailed = (session: Session) => {
    const shuttlecockFee = CostCalculator.shuttlecockFee(
      session.shuttlecocksUsed,
      settings.shuttlecockTubePrice,
      settings.shuttlecocksPerTube
    );
    const attendees = members.filter(m => session.attendeeIds.includes(m.id));
    return CostCalculator.calculateDetailedSessionCost(
      session.courtFee,
      shuttlecockFee,
      attendees,
      session.guestCount
    );
  };

  const saveAttendance = async () => {
    if (!activeSession) return;
    const shuttlecockFee = CostCalculator.shuttlecockFee(
      activeSession.shuttlecocksUsed,
      settings.shuttlecockTubePrice,
      settings.shuttlecocksPerTube
    );

    // 1. REVERT TIỀN/NỢ CỦA BUỔI ĐÁNH CŨ (NẾU ĐÃ HOÀN THÀNH TRƯỚC ĐÓ)
    const oldSession = sessions.find(s => s.id === activeSession.id);
    if (oldSession && oldSession.status === 'completed') {
      // Revert cho từng thành viên tham gia buổi cũ
      for (const oldAttendeeId of oldSession.attendeeIds) {
        const member = members.find(m => m.id === oldAttendeeId);
        if (member) {
          const type = member.membershipType || 'regular';
          if (type === 'regular') {
            const updatedMember = {
              ...member,
              prepaidBalance: (member.prepaidBalance || 0) + oldSession.costPerPerson,
            };
            await updateMember(updatedMember);
          } else if (type === 'guest') {
            const updatedMember = {
              ...member,
              debt: Math.max(0, (member.debt || 0) - 35000),
            };
            await updateMember(updatedMember);
          }
        }
      }

      // Xóa tất cả các transaction liên quan đến buổi đánh cũ này
      await deleteTransactionsBySession(activeSession.id);
    }

    // 2. TÍNH CHI PHÍ BUỔI MỚI THEO CƠ CẤU THÀNH VIÊN
    const attendees = members.filter(m => activeSession.attendeeIds.includes(m.id));
    const breakdown = CostCalculator.calculateDetailedSessionCost(
      activeSession.courtFee,
      shuttlecockFee,
      attendees,
      activeSession.guestCount
    );

    const {
      totalCost,
      subsidyUsed,
      costPerPerson,
      costPerPersonNoSubsidy,
      guestCountTotal,
      guestFeeTotal
    } = breakdown;

    // 3. ÁP DỤNG CHI PHÍ MỚI VÀO VÍ CỦA TỪNG THÀNH VIÊN
    for (const attendee of attendees) {
      const type = attendee.membershipType || 'regular';
      if (type === 'regular') {
        const updatedMember = {
          ...attendee,
          prepaidBalance: (attendee.prepaidBalance || 0) - costPerPerson,
        };
        await updateMember(updatedMember);
      } else if (type === 'guest') {
        const updatedMember = {
          ...attendee,
          debt: (attendee.debt || 0) + 35000,
        };
        await updateMember(updatedMember);
      }
    }

    // 4. LƯU THÔNG TIN BUỔI ĐÁNH
    const updatedSession: Session = {
      ...activeSession,
      shuttlecockFee,
      totalCost,
      fundSubsidyUsed: subsidyUsed,
      costPerPerson,
      costPerPersonNoSubsidy,
      status: 'completed' as const,
    };
    await updateSession(updatedSession);

    // 5. TẠO CÁC GIAO DỊCH TÀI CHÍNH MỚI
    const sessionDate = activeSession.date;
    const dateLabel = formatShortDate(sessionDate);

    // Chi phí tiền sân
    if (activeSession.courtFee > 0) {
      await addTransaction({
        id: crypto.randomUUID(),
        date: sessionDate,
        type: 'expense',
        category: 'court_fee',
        amount: activeSession.courtFee,
        description: `Tiền sân buổi ${dateLabel}`,
        relatedSessionId: activeSession.id,
      });
    }

    // Chi phí tiền cầu
    if (shuttlecockFee > 0) {
      await addTransaction({
        id: crypto.randomUUID(),
        date: sessionDate,
        type: 'expense',
        category: 'shuttlecock_fee',
        amount: shuttlecockFee,
        description: `Tiền cầu buổi ${dateLabel} (${activeSession.shuttlecocksUsed} trái)`,
        relatedSessionId: activeSession.id,
      });
    }

    // Hỗ trợ từ quỹ (cho Nhân viên công ty)
    if (subsidyUsed > 0) {
      await addTransaction({
        id: crypto.randomUUID(),
        date: sessionDate,
        type: 'income',
        category: 'support_fund',
        amount: subsidyUsed,
        description: `Quỹ hỗ trợ buổi ${dateLabel} (${breakdown.employeeCount} nhân viên)`,
        relatedSessionId: activeSession.id,
      });
    }

    // Thu nhập từ khách vãng lai
    if (guestFeeTotal > 0) {
      await addTransaction({
        id: crypto.randomUUID(),
        date: sessionDate,
        type: 'income',
        category: 'member_payment',
        amount: guestFeeTotal,
        description: `Thu tiền vãng lai buổi ${dateLabel} (${guestCountTotal} khách)`,
        relatedSessionId: activeSession.id,
      });
    }

    setIsAttendanceOpen(false);
  };

  const pricePerBird = CostCalculator.pricePerShuttlecock(
    settings.shuttlecockTubePrice,
    settings.shuttlecocksPerTube
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Buổi đánh</h1>

        <div className="flex items-center gap-2">
          <Button onClick={handleGenerate} variant="secondary">
            <Calendar className="mr-2 h-4 w-4" /> Tạo lịch
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredSessions.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
            Chưa có lịch đánh trong tháng này. Hãy nhấn "Tạo lịch" để bắt đầu.
          </div>
        ) : (
          filteredSessions.map(session => (
            <Card key={session.id} className={session.status === 'completed' ? 'border-primary/50 bg-primary/5' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex justify-between items-center">
                  <span>{formatFullDate(session.date)}</span>
                  {session.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm pb-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Giờ:</span>
                  <span>{session.startTime} - {session.endTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sân:</span>
                  <span className="truncate ml-4">{session.location}</span>
                </div>
                {session.status === 'completed' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Người tham gia:</span>
                      <span>{session.attendeeIds.length + session.guestCount}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Phí mỗi người:</span>
                      <span>{formatVnd(session.costPerPerson)}</span>
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter className="pt-0">
                <Button
                  className="w-full"
                  variant={session.status === 'completed' ? 'outline' : 'default'}
                  onClick={() => openAttendance(session)}
                >
                  <UsersIcon className="mr-2 h-4 w-4" />
                  {session.status === 'completed' ? 'Sửa thông tin' : 'Điểm danh'}
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isGenerateConfirmOpen} onOpenChange={setIsGenerateConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo thêm lịch?</DialogTitle>
            <DialogDescription>
              Tháng này đã có lịch. Nếu tiếp tục, các buổi mới có thể trùng với lịch hiện tại.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsGenerateConfirmOpen(false)}>
              Hủy
            </Button>
            <Button onClick={createSchedule}>Tạo thêm lịch</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attendance Dialog */}
      <Dialog open={isAttendanceOpen} onOpenChange={setIsAttendanceOpen}>
        <DialogContent className="w-[95vw] md:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Chi tiết buổi đánh: {activeSession ? formatFullDate(activeSession.date) : ''}
            </DialogTitle>
          </DialogHeader>

          {activeSession && (() => {
            const calc = getCalcDetailed(activeSession);
            const shuttlecockFee = CostCalculator.shuttlecockFee(
              activeSession.shuttlecocksUsed,
              settings.shuttlecockTubePrice,
              settings.shuttlecocksPerTube
            );
            return (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 py-4">

                {/* Left: Attendees */}
                <div className="lg:col-span-3 space-y-4">
                  <h3 className="font-semibold text-lg flex justify-between items-center">
                    Chọn người tham gia
                    <span className="text-sm font-normal text-muted-foreground">
                      Đã chọn {activeSession.attendeeIds.length}
                    </span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {members.filter(m => m.isActive).map(member => (
                      <Label
                        key={member.id}
                        htmlFor={`member-${member.id}`}
                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          activeSession.attendeeIds.includes(member.id)
                            ? 'border-primary bg-primary/10'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <Checkbox
                          className="shrink-0"
                          checked={activeSession.attendeeIds.includes(member.id)}
                          id={`member-${member.id}`}
                          onCheckedChange={() => toggleAttendance(member.id)}
                        />
	                        <span className="flex-1 cursor-pointer break-words leading-tight">
	                          <span className="flex items-center gap-1.5 flex-wrap">
	                            <span className="font-semibold text-sm text-foreground">{member.name}</span>
	                            {member.nickname && <span className="text-muted-foreground text-xs font-normal">({member.nickname})</span>}
	                          </span>
	                          <span className="mt-1 flex items-center gap-1.5 flex-wrap">
	                            <span className="text-[10px] uppercase tracking-wider font-bold opacity-70 bg-muted px-1.5 py-0.5 rounded">
	                              Trình độ: {member.skillLevel || 2}
	                            </span>
	                            <MemberTypeBadge type={member.membershipType} />
	                          </span>
	                        </span>
                      </Label>
                    ))}
                  </div>
                </div>

                {/* Right: Costs */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <h3 className="font-semibold text-lg">Chi phí</h3>

                    <div className="space-y-2">
                      <Label htmlFor="guests">Số khách (vãng lai)</Label>
                      <IntegerInput
                        id="guests"
                        value={activeSession.guestCount}
                        onChange={(val) => setActiveSession({ ...activeSession, guestCount: val })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="courtFee">Tiền sân (₫)</Label>
                      <CurrencyInput
                        id="courtFee"
                        value={activeSession.courtFee}
                        onChange={(val) => setActiveSession({ ...activeSession, courtFee: val })}
                        placeholder="VD: 200,000…"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shuttlecocksUsed">Số trái cầu sử dụng</Label>
                      <IntegerInput
                        id="shuttlecocksUsed"
                        value={activeSession.shuttlecocksUsed}
                        onChange={(val) => setActiveSession({ ...activeSession, shuttlecocksUsed: val })}
                        placeholder="VD: 3…"
                      />
                      <p className="text-xs text-muted-foreground">
                        Giá/trái: {formatVnd(pricePerBird)} → Tổng cầu: <span className="font-semibold text-foreground">{formatVnd(shuttlecockFee)}</span>
                      </p>
                    </div>

                    <div className="pt-4 border-t space-y-2.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tổng chi phí:</span>
                        <span className="font-semibold text-foreground">{formatVnd(shuttlecockFee + activeSession.courtFee)}</span>
                      </div>

                      <div className="bg-muted/50 p-3 rounded-md space-y-2 text-xs">
                        <div className="flex justify-between font-medium">
                          <span>1. Khách vãng lai ({calc.guestCountTotal} người):</span>
                          <span className="text-amber-600 font-bold">+{formatVnd(calc.guestFeeTotal)}</span>
                        </div>
                        <div className="pl-3 text-muted-foreground flex justify-between">
                          <span>(Mỗi người đóng cố định 35k)</span>
                        </div>

                        <div className="flex justify-between font-medium border-t pt-1.5">
                          <span>2. Thành viên thường ({calc.regularCount} người):</span>
                          <span className="text-sky-600 dark:text-sky-400 font-bold">-{formatVnd(calc.regularCount * calc.costPerPerson)}</span>
                        </div>
                        <div className="pl-3 text-muted-foreground flex justify-between">
                          <span>(Tiền cầu chia đều cho {calc.employeeCount + calc.regularCount + calc.guestCountTotal} người)</span>
                          <span className="font-medium text-foreground">{formatVnd(calc.costPerPerson)}/người</span>
                        </div>

                        <div className="flex justify-between font-medium border-t pt-1.5">
                          <span>3. Quỹ công ty chi trả:</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">-{formatVnd(calc.subsidyUsed)}</span>
                        </div>
                        <div className="pl-3 text-muted-foreground">
                          <span>(Chi trả tiền sân & tiền cầu chia đều của {calc.employeeCount} nhân viên)</span>
                        </div>
                      </div>

                      <div className="flex justify-between pt-1">
                        <span className="text-muted-foreground">Quỹ hỗ trợ còn lại:</span>
                        <span className={`font-semibold ${getRemainingFund(activeSession.id) <= 0 ? 'text-destructive' : 'text-primary'}`}>
                          {formatVnd(getRemainingFund(activeSession.id))}
                        </span>
                      </div>

                      <div className="pt-3 border-t space-y-2">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Giá gốc chia đều (không hỗ trợ):</span>
                          <span className="font-semibold text-foreground">{formatVnd(calc.costPerPersonNoSubsidy)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-primary text-base">
                          <span>Tiền cầu/Thành viên thường:</span>
                          <span className="text-lg">{formatVnd(calc.costPerPerson)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full" size="lg" onClick={saveAttendance}>
                    Lưu buổi đánh
                  </Button>
                </div>

              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
