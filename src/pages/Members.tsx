import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Member, Session } from '../core/models/types';
import { v4 as uuidv4 } from 'uuid';
import { CostCalculator } from '../core/services/CostCalculator';
import { Plus, Edit2, Trash2, Star, RefreshCw, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { CurrencyInput } from '../components/ui/currency-input';
import { formatFullDate, formatShortDate, formatVnd } from '../lib/format';

const skillLabels: Record<number, { label: string; color: string }> = {
  1: { label: 'Mới chơi', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  2: { label: 'Trung bình', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  3: { label: 'Khá', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  4: { label: 'Mạnh', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

function SkillBadge({ level }: { level: number }) {
  const info = skillLabels[level] || skillLabels[1];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${info.color}`}>
      <Star className="h-3 w-3" /> {info.label}
    </span>
  );
}

function MemberTypeBadge({ type }: { type?: 'employee' | 'guest' | 'regular' }) {
  const t = type || 'regular';
  if (t === 'employee') {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
        Nhân viên
      </span>
    );
  }
  if (t === 'guest') {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
        Vãng lai
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
      Thường
    </span>
  );
}

export default function Members() {
  const { 
    members, 
    addMember, 
    updateMember, 
    deleteMember, 
    addTransaction,
    sessions,
    transactions,
    settings,
    deleteTransactionByMemberAndSession,
    globalMonth,
    globalYear
  } = useAppStore();

  const calculateMemberFinancials = (member: Member, endMonth: number, endYear: number, startMonth?: number, startYear?: number) => {
    const type = member.membershipType || 'regular';
    
    // Upper limit (exclusive)
    const endLimitDate = new Date(endYear, endMonth + 1, 1).toISOString();
    // Lower limit (inclusive), if provided
    const startLimitDate = (startMonth !== undefined && startYear !== undefined) 
      ? new Date(startYear, startMonth, 1).toISOString() 
      : null;

    const isWithinRange = (dateStr: string) => {
      if (dateStr >= endLimitDate) return false;
      if (startLimitDate && dateStr < startLimitDate) return false;
      return true;
    };

    if (type === 'regular') {
      const deposits = transactions.filter(t => t.relatedMemberId === member.id && t.type === 'income' && t.category === 'member_payment' && isWithinRange(t.date));
      const totalDeposited = deposits.reduce((sum, t) => sum + t.amount, 0);

      const attendedSessions = sessions.filter(s => s.status === 'completed' && s.attendeeIds.includes(member.id) && isWithinRange(s.date));
      const totalPlayedCost = attendedSessions.reduce((sum, s) => sum + (s.costPerPerson || 0), 0);

      const balance = totalDeposited - totalPlayedCost;
      return {
        balance: balance > 0 ? balance : 0,
        debt: balance < 0 ? -balance : 0,
        rawBalance: balance,
        totalDeposited,
        totalPlayedCost,
        deposits,
        attendedSessions
      };
    }
    
    if (type === 'guest') {
      const attendedSessions = sessions.filter(s => s.status === 'completed' && s.attendeeIds.includes(member.id) && isWithinRange(s.date));
      const totalDebtIncurred = attendedSessions.length * 35000;
        
      const deposits = transactions.filter(t => t.relatedMemberId === member.id && t.type === 'income' && t.category === 'member_payment' && isWithinRange(t.date));
      const totalPaid = deposits.reduce((sum, t) => sum + t.amount, 0);
        
      return {
        balance: 0,
        debt: Math.max(0, totalDebtIncurred - totalPaid),
        rawBalance: totalPaid - totalDebtIncurred,
        totalDeposited: totalPaid,
        totalPlayedCost: totalDebtIncurred,
        deposits,
        attendedSessions
      };
    }

    return { balance: 0, debt: 0, rawBalance: 0, totalDeposited: 0, totalPlayedCost: 0, deposits: [], attendedSessions: [] };
  };

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  
  const [selectedAuditMember, setSelectedAuditMember] = useState<Member | null>(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);

  const syncAllFinance = async () => {
    setIsSyncing(true);
    
    // 1. Recalculate and update all completed sessions using the new detailed cost logic
    let updatedSessions = false;
    const newSessions = [...sessions];
    const completedSessionsForSync: Session[] = [];

    for (let i = 0; i < newSessions.length; i++) {
      const s = newSessions[i];
      if (s.status === 'completed') {
        const attendees = members.filter(m => s.attendeeIds.includes(m.id));
        const shuttlecockFee = CostCalculator.shuttlecockFee(
          s.shuttlecocksUsed || 0,
          settings.shuttlecockTubePrice,
          settings.shuttlecocksPerTube
        );
        const breakdown = CostCalculator.calculateDetailedSessionCost(
          s.courtFee || 0,
          shuttlecockFee,
          attendees,
          s.guestCount || 0
        );

        // If the stored costPerPerson is different from the newly calculated one, update it
        if (s.costPerPerson !== breakdown.costPerPerson || s.fundSubsidyUsed !== breakdown.subsidyUsed) {
          newSessions[i] = {
            ...s,
            costPerPerson: breakdown.costPerPerson,
            fundSubsidyUsed: breakdown.subsidyUsed,
            shuttlecockFee,
            totalCost: breakdown.totalCost
          };
          updatedSessions = true;
        }
        completedSessionsForSync.push(newSessions[i]);
      }
    }

    if (updatedSessions) {
      const { saveSessions } = useAppStore.getState();
      await saveSessions(newSessions);
    }

    // 2. Sync members' balances based on the newly calculated sessions
    for (const member of members) {
      const type = member.membershipType || 'regular';
      
      if (type === 'regular') {
        const totalDeposited = transactions
          .filter(t => t.relatedMemberId === member.id && t.type === 'income' && t.category === 'member_payment')
          .reduce((sum, t) => sum + t.amount, 0);

        const totalPlayedCost = completedSessionsForSync
          .filter(s => s.attendeeIds.includes(member.id))
          .reduce((sum, s) => sum + (s.costPerPerson || 0), 0);

        const newBalance = totalDeposited - totalPlayedCost;
        let newPrepaidBalance = 0;
        let newDebt = 0;
        if (newBalance < 0) {
          newDebt = -newBalance;
        } else {
          newPrepaidBalance = newBalance;
        }

        if (member.prepaidBalance !== newPrepaidBalance || member.debt !== newDebt) {
          await updateMember({
            ...member,
            prepaidBalance: newPrepaidBalance,
            debt: newDebt
          });
        }
      } else if (type === 'guest') {
        const sessionsAttended = completedSessionsForSync.filter(s => s.attendeeIds.includes(member.id));
        const paidIds = member.paidSessionIds || [];
        const unpaidSessions = sessionsAttended.filter(s => !paidIds.includes(s.id));
        const unpaidDebt = unpaidSessions.length * 35000;
        
        if (member.debt !== unpaidDebt) {
          await updateMember({
            ...member,
            debt: unpaidDebt
          });
        }
      } else if (type === 'employee') {
        if (member.debt !== 0 || member.prepaidBalance !== 0) {
          await updateMember({
            ...member,
            debt: 0,
            prepaidBalance: 0
          });
        }
      }
    }
    setIsSyncing(false);
  };

  const defaultMember: Partial<Member> = {
    name: '',
    nickname: '',
    phone: '',
    isActive: true,
    skillLevel: 2,
    debt: 0,
    notes: '',
    membershipType: 'regular',
    prepaidBalance: 0,
  };

  const [formData, setFormData] = useState<Partial<Member>>(defaultMember);

  const openAddDialog = () => {
    setEditingMember(null);
    setFormData(defaultMember);
    setIsDialogOpen(true);
  };

  const openEditDialog = (member: Member) => {
    setEditingMember(member);
    setFormData(member);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) return;

    const membershipType = formData.membershipType ?? 'regular';
    const prepaidBalance = membershipType === 'regular' ? (formData.prepaidBalance ?? 0) : 0;
    const debt = membershipType === 'employee' ? 0 : (formData.debt ?? 0);

    if (editingMember) {
      const oldBalance = editingMember.prepaidBalance || 0;
      if (membershipType === 'regular' && prepaidBalance > oldBalance) {
        const depositAmount = prepaidBalance - oldBalance;
        await addTransaction({
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          type: 'income',
          category: 'member_payment',
          amount: depositAmount,
          description: `Thành viên ${formData.name} nạp quỹ (+${formatVnd(depositAmount)})`,
          relatedMemberId: editingMember.id,
        });
      }
      await updateMember({ 
        ...editingMember, 
        ...formData, 
        membershipType, 
        prepaidBalance,
        debt
      } as Member);
    } else {
      const newId = uuidv4();
      const newMember: Member = {
        id: newId,
        name: formData.name,
        nickname: formData.nickname || '',
        phone: formData.phone || '',
        joinDate: new Date().toISOString(),
        isActive: formData.isActive ?? true,
        skillLevel: formData.skillLevel ?? 2,
        debt: debt,
        notes: formData.notes || '',
        membershipType,
        prepaidBalance,
      };
      await addMember(newMember);

      if (membershipType === 'regular' && prepaidBalance > 0) {
        await addTransaction({
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          type: 'income',
          category: 'member_payment',
          amount: prepaidBalance,
          description: `Quỹ ban đầu thành viên ${newMember.name} (+${formatVnd(prepaidBalance)})`,
          relatedMemberId: newId,
        });
      }
    }
    setIsDialogOpen(false);
  };

  const openAuditDialog = (member: Member) => {
    setSelectedAuditMember(member);
    setIsAuditOpen(true);
  };

  const handleToggleGuestSessionPayment = async (member: Member, session: Session, isPaid: boolean) => {
    const paidIds = member.paidSessionIds || [];
    let newPaidIds = [...paidIds];
    
    if (isPaid) {
      if (!newPaidIds.includes(session.id)) {
        newPaidIds.push(session.id);
        const dateLabel = formatShortDate(session.date);
        await addTransaction({
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          type: 'income',
          category: 'member_payment',
          amount: 35000,
          description: `Thu tiền vãng lai ${member.name} buổi ${dateLabel}`,
          relatedMemberId: member.id,
          relatedSessionId: session.id,
        });
      }
    } else {
      newPaidIds = newPaidIds.filter(id => id !== session.id);
      await deleteTransactionByMemberAndSession(member.id, session.id);
    }

    const completedSessions = sessions.filter(s => s.status === 'completed' && s.attendeeIds.includes(member.id));
    const unpaidSessionsCount = completedSessions.filter(s => !newPaidIds.includes(s.id)).length;
    const unpaidDebt = unpaidSessionsCount * 35000;

    const updatedMember = {
      ...member,
      paidSessionIds: newPaidIds,
      debt: unpaidDebt
    };

    await updateMember(updatedMember);
    setSelectedAuditMember(updatedMember);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Thành viên</h1>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={syncAllFinance} 
            disabled={isSyncing}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            <span>Đồng bộ số dư</span>
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2" onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" /> Thêm thành viên
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingMember ? 'Sửa thành viên' : 'Thêm thành viên mới'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Họ và tên</Label>
	                  <Input 
	                    id="name" 
	                    name="name"
	                    autoComplete="name"
	                    value={formData.name} 
	                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
	                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nickname">Biệt danh (Tùy chọn)</Label>
	                  <Input 
	                    id="nickname" 
	                    name="nickname"
	                    autoComplete="off"
	                    value={formData.nickname} 
	                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} 
	                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Số điện thoại (Tùy chọn)</Label>
	                  <Input 
	                    id="phone" 
	                    name="phone"
	                    type="tel"
	                    inputMode="tel"
	                    autoComplete="tel"
	                    value={formData.phone} 
	                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
	                  />
                </div>

                {/* Skill Level */}
                <div className="space-y-2">
                  <Label>Trình độ</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map(level => {
                      const info = skillLabels[level];
                      const isSelected = formData.skillLevel === level;
                      return (
	                        <button
	                          key={level}
	                          type="button"
	                          aria-pressed={isSelected}
	                          onClick={() => setFormData({ ...formData, skillLevel: level })}
	                          className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            isSelected
                              ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                              : 'border-input hover:border-primary/50 hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: level }).map((_, i) => (
                              <Star key={i} className={`h-3.5 w-3.5 ${isSelected ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                            ))}
                          </div>
                          <span>{info.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Loại thành viên */}
                <div className="space-y-2">
                  <Label>Loại thành viên</Label>
                  <div className="grid grid-cols-3 gap-2">
	                    {([
	                      { value: 'regular', label: 'Thường' },
	                      { value: 'employee', label: 'Nhân viên công ty' },
	                      { value: 'guest', label: 'Vãng lai' },
	                    ] as const).map((type) => {
                      const isSelected = (formData.membershipType || 'regular') === type.value;
                      return (
	                        <button
	                          key={type.value}
	                          type="button"
	                          aria-pressed={isSelected}
	                          onClick={() => setFormData({ 
	                            ...formData, 
	                            membershipType: type.value,
                            prepaidBalance: type.value === 'regular' ? (formData.prepaidBalance ?? 0) : 0,
                            debt: type.value === 'employee' ? 0 : (formData.debt ?? 0)
                          })}
	                          className={`flex flex-col items-center justify-center p-2.5 rounded-lg border-2 transition-all text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            isSelected
                              ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                              : 'border-input hover:border-primary/50 hover:bg-muted'
                          }`}
                        >
                          <span>{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Nhập quỹ ban đầu nếu là thành viên thường */}
                {((formData.membershipType || 'regular') === 'regular') && (
                  <div className="space-y-2">
                    <Label htmlFor="prepaidBalance">Quỹ ban đầu nạp trước (₫)</Label>
                    <CurrencyInput 
                      id="prepaidBalance" 
                      value={formData.prepaidBalance ?? 0} 
                      onChange={(val) => setFormData({ ...formData, prepaidBalance: val })} 
	                      placeholder="VD: 500,000…"
                    />
                    <p className="text-[11px] text-muted-foreground text-primary">
                      Tiền chơi mỗi buổi sẽ tự động trừ vào quỹ này.
                    </p>
                  </div>
                )}

                {/* Nhập nợ ban đầu nếu là thành viên thường hoặc khách vãng lai */}
                {((formData.membershipType || 'regular') !== 'employee') && (
                  <div className="space-y-2">
                    <Label htmlFor="debt">Nợ ban đầu (₫)</Label>
                    <CurrencyInput 
                      id="debt" 
                      value={formData.debt ?? 0} 
                      onChange={(val) => setFormData({ ...formData, debt: val })} 
	                      placeholder="VD: 0…"
                    />
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="isActive" 
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
                  />
                  <Label htmlFor="isActive">Đang tham gia</Label>
                </div>
                <Button onClick={handleSave} className="w-full">Lưu</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách thành viên</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Trình độ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Số dư / Nợ</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Chưa có thành viên nào. Hãy thêm thành viên đầu tiên!
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id}>
	                    <TableCell className="font-medium">
	                      <button
	                        type="button"
	                        className="flex flex-col gap-1 text-left cursor-pointer group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
	                        onClick={() => openAuditDialog(member)}
	                      >
	                        <div className="flex items-center gap-1.5 flex-wrap group-hover:underline text-primary">
	                          <span>{member.name}</span>
	                          {member.nickname && <span className="text-muted-foreground text-xs font-normal">({member.nickname})</span>}
                        </div>
	                        <div>
	                          <MemberTypeBadge type={member.membershipType} />
	                        </div>
	                      </button>
                    </TableCell>
                    <TableCell>
                      <SkillBadge level={member.skillLevel || 2} />
                    </TableCell>
                    <TableCell>
                      {member.isActive ? (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                          Nghỉ
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const type = member.membershipType || 'regular';
                        const stats = calculateMemberFinancials(member, globalMonth, globalYear);
                        const balance = stats.balance;
                        const debt = stats.debt;

                        if (type === 'regular') {
                          if (debt > 0) {
                            return (
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-destructive font-bold">
	                                  Nợ: {formatVnd(debt)}
                                </span>
                                {balance > 0 && (
                                  <span className="text-green-600 dark:text-green-400 font-semibold text-xs">
	                                    Quỹ: {formatVnd(balance)}
                                  </span>
                                )}
                              </div>
                            );
                          }
                          
                          return (
                            <span className="font-semibold text-green-600 dark:text-green-400">
	                              Quỹ: {formatVnd(balance)}
                            </span>
                          );
                        }
                        if (type === 'employee') {
                          return <span className="text-muted-foreground text-xs italic">Quỹ chi trả</span>;
                        }
                        // Vãng lai
                        return (
                          <span className={debt > 0 ? 'text-destructive font-bold' : 'text-muted-foreground'}>
	                            Nợ: {formatVnd(debt)}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
	                      <Button variant="ghost" size="icon" aria-label={`Sửa ${member.name}`} onClick={() => openEditDialog(member)}>
	                        <Edit2 className="h-4 w-4" aria-hidden="true" />
	                      </Button>
	                      <Button variant="ghost" size="icon" aria-label={`Xóa ${member.name}`} onClick={() => setMemberToDelete(member)}>
	                        <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
	                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
	      </Card>

	      <Dialog open={!!memberToDelete} onOpenChange={(open) => !open && setMemberToDelete(null)}>
	        <DialogContent>
	          <DialogHeader>
	            <DialogTitle>Xóa thành viên?</DialogTitle>
	            <DialogDescription>
	              Thành viên {memberToDelete?.name} sẽ bị xóa khỏi danh sách. Hành động này không thể hoàn tác.
	            </DialogDescription>
	          </DialogHeader>
	          <div className="flex justify-end gap-2">
	            <Button variant="outline" onClick={() => setMemberToDelete(null)}>
	              Hủy
	            </Button>
	            <Button
	              variant="destructive"
	              onClick={async () => {
	                if (!memberToDelete) return;
	                await deleteMember(memberToDelete.id);
	                setMemberToDelete(null);
	              }}
	            >
	              Xóa thành viên
	            </Button>
	          </div>
	        </DialogContent>
	      </Dialog>

	      {/* Audit & Finance Dialog */}
      <Dialog open={isAuditOpen} onOpenChange={setIsAuditOpen}>
        <DialogContent className="w-[95vw] md:max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedAuditMember && (() => {
            const member = selectedAuditMember;
            const type = member.membershipType || 'regular';
            
            const prevMonth = globalMonth === 0 ? 11 : globalMonth - 1;
            const prevYear = globalMonth === 0 ? globalYear - 1 : globalYear;
            
            const prevStats = calculateMemberFinancials(member, prevMonth, prevYear);
            const currentStats = calculateMemberFinancials(member, globalMonth, globalYear, globalMonth, globalYear);
            const cumulativeStats = calculateMemberFinancials(member, globalMonth, globalYear);
            
            return (
              <div className="space-y-6 py-2">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <span>Lịch sử hoạt động & Tài chính: {member.name}</span>
                    <MemberTypeBadge type={type} />
                  </DialogTitle>
                </DialogHeader>

                {/* 1. THÀNH VIÊN THƯỜNG */}
                {type === 'regular' && (() => {
                  
                  const balance = cumulativeStats.balance;
                  const debt = cumulativeStats.debt;
                  
                  return (
                    <div className="space-y-4">
                      {/* Thống kê nhanh */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="bg-muted/30">
                          <CardContent className="p-3 text-center space-y-1 relative">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Số dư Quỹ tháng này</span>
                            <div className="text-base font-bold text-green-600 dark:text-green-400">
	                              {formatVnd(balance)}
                            </div>
                            <div className="text-[10px] text-muted-foreground absolute bottom-1 right-2">
	                              Mang sang: <span className="font-semibold text-foreground">{formatVnd(prevStats.rawBalance)}</span>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/30">
                          <CardContent className="p-3 text-center space-y-1 relative">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Nợ tháng này</span>
                            <div className="text-base font-bold text-destructive">
	                              {formatVnd(debt)}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/30">
                          <CardContent className="p-3 text-center space-y-1">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Đã nạp trong tháng</span>
                            <div className="text-base font-bold text-sky-600 dark:text-sky-400">
	                              {formatVnd(currentStats.totalDeposited)}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/30">
                          <CardContent className="p-3 text-center space-y-1">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Đã chơi trong tháng</span>
                            <div className="text-base font-bold text-destructive">
	                              {formatVnd(currentStats.totalPlayedCost)}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Lịch sử chơi & Trừ quỹ */}
                      <Card>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-muted-foreground" /> Lịch sử đi chơi trong tháng ({currentStats.attendedSessions.length} buổi)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="max-h-[220px] overflow-y-auto px-4 pb-4">
                            {currentStats.attendedSessions.length === 0 ? (
                              <div className="text-center py-6 text-xs text-muted-foreground">Chưa tham gia buổi đánh nào trong tháng này.</div>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow className="text-xs">
                                    <TableHead className="py-2">Ngày chơi</TableHead>
                                    <TableHead className="py-2">Sân</TableHead>
                                    <TableHead className="py-2 text-right">Phí tiền cầu</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {currentStats.attendedSessions
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map(s => (
                                      <TableRow key={s.id} className="text-xs">
	                                        <TableCell className="py-2 font-medium">{formatFullDate(s.date)}</TableCell>
                                        <TableCell className="py-2 truncate max-w-[120px]">{s.location}</TableCell>
                                        <TableCell className="py-2 text-right font-semibold text-destructive">
	                                          -{formatVnd(s.costPerPerson)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Lịch sử nạp tiền */}
                      <Card>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                            <DollarSign className="h-4 w-4 text-muted-foreground" /> Lịch sử nạp quỹ trong tháng ({currentStats.deposits.length} lần)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="max-h-[220px] overflow-y-auto px-4 pb-4">
                            {currentStats.deposits.length === 0 ? (
                              <div className="text-center py-6 text-xs text-muted-foreground">Chưa có giao dịch nạp tiền nào trong tháng này.</div>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow className="text-xs">
                                    <TableHead className="py-2">Ngày nạp</TableHead>
                                    <TableHead className="py-2">Mô tả</TableHead>
                                    <TableHead className="py-2 text-right">Số tiền nạp</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {currentStats.deposits
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map(d => (
                                      <TableRow key={d.id} className="text-xs">
	                                        <TableCell className="py-2 font-medium">{formatFullDate(d.date)}</TableCell>
                                        <TableCell className="py-2 truncate max-w-[160px]">{d.description}</TableCell>
                                        <TableCell className="py-2 text-right font-bold text-green-600 dark:text-green-400">
	                                          +{formatVnd(d.amount)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}

                {/* 2. KHÁCH VÃNG LAI */}
                {type === 'guest' && (() => {
                  const paidIds = member.paidSessionIds || [];
                  
                  return (
                    <div className="space-y-4">
                      {/* Thống kê nhanh */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="bg-muted/30">
                          <CardContent className="p-3 text-center space-y-1 relative">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Tổng nợ đến hiện tại</span>
                            <div className="text-base font-extrabold text-destructive">
	                              {formatVnd(cumulativeStats.debt)}
                            </div>
                            <div className="text-[10px] text-muted-foreground absolute bottom-1 right-2">
	                              Mang sang: <span className="font-semibold text-foreground">{formatVnd(prevStats.debt)}</span>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/30">
                          <CardContent className="p-3 text-center space-y-1">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Đi trong tháng</span>
                            <div className="text-base font-bold">{currentStats.attendedSessions.length} buổi</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/30">
                          <CardContent className="p-3 text-center space-y-1">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Đã đóng trong tháng</span>
                            <div className="text-base font-bold text-green-600 dark:text-green-400">
                              {currentStats.deposits.length} lần
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/30">
                          <CardContent className="p-3 text-center space-y-1">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Phát sinh nợ mới</span>
                            <div className="text-base font-bold text-destructive">
	                              {formatVnd(currentStats.debt)}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Chi tiết đóng phí theo buổi */}
                      <Card>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm font-bold flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-muted-foreground" /> Quản lý đóng phí theo buổi chơi</span>
	                            <span className="text-xs font-semibold text-primary">Tick đóng 35k/buổi</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="max-h-[350px] overflow-y-auto px-4 pb-4">
                            {currentStats.attendedSessions.length === 0 ? (
                              <div className="text-center py-6 text-xs text-muted-foreground">Chưa tham gia buổi đánh nào trong tháng này.</div>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow className="text-xs">
                                    <TableHead className="py-2">Ngày chơi</TableHead>
                                    <TableHead className="py-2">Sân</TableHead>
                                    <TableHead className="py-2">Phí đóng</TableHead>
                                    <TableHead className="py-2 text-right">Trạng thái đóng</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {currentStats.attendedSessions
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map(s => {
                                      const isPaid = paidIds.includes(s.id);
                                      return (
                                        <TableRow key={s.id} className="text-xs">
	                                          <TableCell className="py-2 font-medium">{formatFullDate(s.date)}</TableCell>
                                          <TableCell className="py-2 truncate max-w-[120px]">{s.location}</TableCell>
	                                          <TableCell className="py-2 font-bold text-amber-600">{formatVnd(35000)}</TableCell>
                                          <TableCell className="py-2 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPaid ? 'bg-green-100 text-green-800' : 'bg-destructive/10 text-destructive'}`}>
                                                {isPaid ? 'Đã đóng' : 'Chưa đóng (Nợ)'}
                                              </span>
	                                              <Checkbox 
	                                                aria-label={`Đánh dấu ${member.name} đã đóng phí buổi ${formatFullDate(s.date)}`}
	                                                checked={isPaid}
                                                onCheckedChange={(checked) => handleToggleGuestSessionPayment(member, s, checked as boolean)}
                                              />
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}

                {/* 3. NHÂN VIÊN CÔNG TY */}
                {type === 'employee' && (
                  <div className="space-y-4">
                    <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
                      <CardContent className="p-4 text-xs text-emerald-800 dark:text-emerald-300 space-y-1 leading-relaxed">
	                        <p className="font-bold">Hỗ trợ đặc biệt cho Nhân viên công ty:</p>
	                        <p>Thành viên này được phân loại là Nhân viên công ty. Do đó, toàn bộ tiền sân và tiền cầu của họ đi chơi tại tất cả các buổi đều được Quỹ hỗ trợ của công ty chi trả 100%.</p>
                        <p>Tài khoản của nhân viên công ty không phát sinh nợ nần cá nhân cũng như không cần phải nạp quỹ ban đầu.</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-muted-foreground" /> Danh sách buổi chơi tham gia trong tháng ({currentStats.attendedSessions.length} buổi)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="max-h-[280px] overflow-y-auto px-4 pb-4">
                          {currentStats.attendedSessions.length === 0 ? (
                            <div className="text-center py-6 text-xs text-muted-foreground">Chưa tham gia buổi đánh nào trong tháng này.</div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow className="text-xs">
                                  <TableHead className="py-2">Ngày chơi</TableHead>
                                  <TableHead className="py-2">Sân</TableHead>
                                  <TableHead className="py-2 text-right">Chi phí hỗ trợ</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {currentStats.attendedSessions
                                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                  .map(s => (
                                    <TableRow key={s.id} className="text-xs">
	                                      <TableCell className="py-2 font-medium">{formatFullDate(s.date)}</TableCell>
                                      <TableCell className="py-2 truncate max-w-[150px]">{s.location}</TableCell>
                                      <TableCell className="py-2 text-right font-medium text-emerald-600">
                                        Đã chi trả (100% Quỹ)
                                      </TableCell>
                                    </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
