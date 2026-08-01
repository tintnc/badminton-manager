import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Member, Session } from '../core/models/types';
import { v4 as uuidv4 } from 'uuid';
import { CostCalculator } from '../core/services/CostCalculator';
import { MemberFinanceService } from '../core/services/MemberFinanceService';
import { Plus, Edit2, Trash2, Star, RefreshCw, Calendar, DollarSign, Search, Users, Wallet, AlertCircle, MinusCircle, Loader2, QrCode } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { StatCard } from '../components/ui/stat-card';
import { MemberTypeBadge, SkillBadge, skillLabels } from '../components/member-badges';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { CurrencyInput } from '../components/ui/currency-input';
import { formatFullDate, formatShortDate, formatVnd } from '../lib/format';
import { buildGuestPaymentDescription, buildSepayQrUrl, guestPaymentQrConfig } from '../lib/payment-qr';
import { PageHeader } from '../components/ui/page-header';

function AuditMetricCard({
  label,
  value,
  tone = 'default',
  detail,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'danger' | 'info';
  detail?: string;
}) {
  return (
    <StatCard variant="vertical" label={label} value={value} tone={tone} detail={detail} className="bg-muted/30" />
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

  const calculateMemberFinancials = (member: Member, endMonth: number, endYear: number, startMonth?: number, startYear?: number) =>
    MemberFinanceService.calculateMemberFinancials(
      member,
      sessions,
      transactions,
      settings.guestFee,
      endMonth,
      endYear,
      startMonth,
      startYear
    );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  
  const [selectedAuditMember, setSelectedAuditMember] = useState<Member | null>(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'regular' | 'employee' | 'guest'>('all');
  const [fundAdjustmentMode, setFundAdjustmentMode] = useState<'add' | 'subtract'>('add');
  const [fundAdjustmentAmount, setFundAdjustmentAmount] = useState(0);
  const [fundAdjustmentReason, setFundAdjustmentReason] = useState('');
  const [fundAdjustmentError, setFundAdjustmentError] = useState('');
  const [isApplyingFundAdjustment, setIsApplyingFundAdjustment] = useState(false);

  const memberRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return members
      .filter((member) => {
        const memberType = member.membershipType ?? 'regular';
        const matchesType = typeFilter === 'all' || memberType === typeFilter;
        const matchesSearch = !normalizedSearch
          || member.name.toLowerCase().includes(normalizedSearch)
          || member.nickname?.toLowerCase().includes(normalizedSearch)
          || member.phone?.toLowerCase().includes(normalizedSearch);
        return matchesType && matchesSearch;
      })
      .toSorted((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.name.localeCompare(b.name, 'vi');
      });
  }, [members, searchTerm, typeFilter]);

  const memberSummary = useMemo(() => {
    return members.reduce(
      (summary, member) => {
        const type = member.membershipType ?? 'regular';
        if (member.isActive) summary.active += 1;
        if (type === 'regular') summary.prepaid += member.prepaidBalance ?? 0;
        if (type === 'guest') summary.guests += 1;
        if (type === 'employee') summary.employees += 1;
        return summary;
      },
      { active: 0, prepaid: 0, guests: 0, employees: 0 }
    );
  }, [members]);

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
        const shuttlecockFee = s.shuttlecockUsages?.length
          ? s.shuttlecockUsages.reduce((sum, usage) => sum + usage.amount, 0)
          : (s.shuttlecockFee || CostCalculator.shuttlecockFee(
              s.shuttlecocksUsed || 0,
              settings.shuttlecockTubePrice,
              settings.shuttlecocksPerTube
            ));
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
        const totalFundDeductions = transactions
          .filter(t => t.relatedMemberId === member.id && t.type === 'expense' && t.category === 'member_payment')
          .reduce((sum, t) => sum + t.amount, 0);

        const totalPlayedCost = completedSessionsForSync
          .filter(s => s.attendeeIds.includes(member.id))
          .reduce((sum, s) => sum + (s.costPerPerson || 0), 0);

        const newBalance = totalDeposited - totalFundDeductions - totalPlayedCost;
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
        const unpaidDebt = MemberFinanceService.getGuestDebt(member, completedSessionsForSync, settings.guestFee);
        
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
    setFundAdjustmentMode('add');
    setFundAdjustmentAmount(0);
    setFundAdjustmentReason('');
    setFundAdjustmentError('');
    setIsApplyingFundAdjustment(false);
    setIsAuditOpen(true);
  };

  const syncSelectedRegularMemberBalance = async (member: Member, nextTransactions = transactions) => {
    const totalDeposited = nextTransactions
      .filter(t => t.relatedMemberId === member.id && t.type === 'income' && t.category === 'member_payment')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalFundDeductions = nextTransactions
      .filter(t => t.relatedMemberId === member.id && t.type === 'expense' && t.category === 'member_payment')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalPlayedCost = sessions
      .filter(s => s.status === 'completed' && s.attendeeIds.includes(member.id))
      .reduce((sum, s) => sum + (s.costPerPerson || 0), 0);
    const rawBalance = totalDeposited - totalFundDeductions - totalPlayedCost;
    const updatedMember = {
      ...member,
      prepaidBalance: rawBalance > 0 ? rawBalance : 0,
      debt: rawBalance < 0 ? -rawBalance : 0,
    };

    await updateMember(updatedMember);
    setSelectedAuditMember(updatedMember);
  };

  const handleApplyFundAdjustment = async (member: Member) => {
    if (isApplyingFundAdjustment) return;

    const reason = fundAdjustmentReason.trim();

    if (fundAdjustmentAmount <= 0) {
      setFundAdjustmentError('Nhập số tiền cần điều chỉnh.');
      return;
    }

    if (!reason) {
      setFundAdjustmentError('Nhập lý do điều chỉnh quỹ.');
      return;
    }

    const transaction = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      type: fundAdjustmentMode === 'add' ? 'income' as const : 'expense' as const,
      category: 'member_payment' as const,
      amount: fundAdjustmentAmount,
      description: `${fundAdjustmentMode === 'add' ? 'Nạp thêm quỹ' : 'Trừ quỹ'}: ${reason}`,
      relatedMemberId: member.id,
    };

    setIsApplyingFundAdjustment(true);
    try {
      await addTransaction(transaction);
      await syncSelectedRegularMemberBalance(member, [...transactions, transaction]);
      setFundAdjustmentAmount(0);
      setFundAdjustmentReason('');
      setFundAdjustmentError('');
    } finally {
      setIsApplyingFundAdjustment(false);
    }
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
          amount: settings.guestFee,
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
    const updatedMember = {
      ...member,
      paidSessionIds: newPaidIds,
      debt: MemberFinanceService.getGuestDebt({ ...member, paidSessionIds: newPaidIds }, completedSessions, settings.guestFee),
    };

    await updateMember(updatedMember);
    setSelectedAuditMember(updatedMember);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thành viên"
        description="Quản lý danh sách thành viên, trình độ và quỹ tài chính trong nhóm."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center lg:justify-end">
            <Button 
              variant="outline" 
              onClick={syncAllFinance} 
              disabled={isSyncing}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Đồng bộ số dư</span>
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <Button type="button" onClick={openAddDialog} className="w-full sm:w-auto">
                <Plus className="h-4 w-4" aria-hidden="true" /> Thêm thành viên
              </Button>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[1, 2, 3, 4].map(level => {
                      const info = skillLabels[level];
                      const isSelected = formData.skillLevel === level;
                      return (
                          <button
                            key={level}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setFormData({ ...formData, skillLevel: level })}
                            className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-[background-color,border-color,box-shadow] text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
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
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                            className={`flex flex-col items-center justify-center p-2.5 rounded-lg border-2 transition-[background-color,border-color,box-shadow] text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
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
                {!editingMember && ((formData.membershipType || 'regular') === 'regular') && (
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

                {editingMember && ((formData.membershipType || 'regular') === 'regular') && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Nạp hoặc trừ quỹ trong màn lịch sử tài chính của thành viên để lưu lý do.
                  </div>
                )}

                {/* Nhập nợ ban đầu nếu là thành viên thường hoặc khách vãng lai */}
                {!editingMember && ((formData.membershipType || 'regular') !== 'employee') && (
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
      }
    />

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard
            label="Đang hoạt động"
            value={memberSummary.active}
            icon={Users}
            revealDelay={0}
          />
          <StatCard
            label="Quỹ đã nạp"
            value={formatVnd(memberSummary.prepaid)}
            icon={Wallet}
            tone="success"
            revealDelay={80}
          />
          <StatCard
            label="Nhân viên"
            value={memberSummary.employees}
            icon={Users}
            tone="info"
            revealDelay={160}
          />
          <StatCard
            label="Khách vãng lai"
            value={memberSummary.guests}
            icon={AlertCircle}
            tone="warning"
            revealDelay={240}
          />
        </div>

        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle>Danh sách thành viên</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative sm:w-72">
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    name="member-search"
                    autoComplete="off"
                    placeholder="Tìm tên, biệt danh, số điện thoại…"
                    className="pl-8"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
                <div className="flex overflow-x-auto rounded-lg border bg-background p-0.5">
                  {([
                    { value: 'all', label: 'Tất cả' },
                    { value: 'regular', label: 'Thường' },
                    { value: 'employee', label: 'Nhân viên' },
                    { value: 'guest', label: 'Vãng lai' },
                  ] as const).map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      aria-pressed={typeFilter === filter.value}
                      onClick={() => setTypeFilter(filter.value)}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        typeFilter === filter.value
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
          <Table className="min-w-[760px]">
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
                {memberRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      {members.length === 0 ? 'Chưa có thành viên nào. Hãy thêm thành viên đầu tiên.' : 'Không tìm thấy thành viên phù hợp.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  memberRows.map((member) => (
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
        <DialogContent className="w-[95vw] max-h-[88vh] overflow-y-auto p-6 md:max-w-5xl">
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
                    <DialogTitle className="flex flex-wrap items-center gap-2 pr-8 text-2xl font-bold text-pretty">
                      <span>Lịch sử hoạt động & Tài chính: {member.name}</span>
                      <MemberTypeBadge type={type} />
                    </DialogTitle>
                </DialogHeader>

                {/* 1. THÀNH VIÊN THƯỜNG */}
                {type === 'regular' && (() => {
                  
                  const balance = cumulativeStats.balance;
                  const debt = cumulativeStats.debt;
                  const signedAdjustment = fundAdjustmentMode === 'add' ? fundAdjustmentAmount : -fundAdjustmentAmount;
                  const previewRawBalance = cumulativeStats.rawBalance + signedAdjustment;
                  const previewBalance = Math.max(0, previewRawBalance);
                  const previewDebt = Math.max(0, -previewRawBalance);
                  
                  return (
                    <div className="space-y-4">
                      {/* Thống kê nhanh */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                          <AuditMetricCard
                            label="Số dư quỹ hiện tại"
                            value={formatVnd(balance)}
                            tone="success"
                            detail={`Mang sang: ${formatVnd(prevStats.rawBalance)}`}
                          />
                          <AuditMetricCard label="Nợ hiện tại" value={formatVnd(debt)} tone="danger" />
                          <AuditMetricCard label="Nạp trong tháng" value={formatVnd(currentStats.totalDeposited)} tone="info" />
                          <AuditMetricCard label="Trừ thủ công trong tháng" value={formatVnd(currentStats.totalFundDeductions)} tone="danger" />
                          <AuditMetricCard label="Đã chơi trong tháng" value={formatVnd(currentStats.totalPlayedCost)} tone="danger" />
                        </div>

                      <Card>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                            <Wallet className="h-4 w-4 text-muted-foreground" /> Điều chỉnh quỹ
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 px-4 pb-4">
                          <div className="grid gap-3 lg:grid-cols-[280px_minmax(220px,1fr)]">
                            <div className="space-y-2 min-w-0">
                              <Label>Loại điều chỉnh</Label>
                              <div className="flex h-9 rounded-lg border bg-background p-0.5">
                                {([
                                  { value: 'add', label: 'Nạp', icon: Plus },
                                  { value: 'subtract', label: 'Trừ', icon: MinusCircle },
                                ] as const).map((mode) => {
                                  const Icon = mode.icon;
                                  const isSelected = fundAdjustmentMode === mode.value;
                                  const selectedClass = mode.value === 'add'
                                    ? 'bg-green-600 text-white shadow-sm'
                                    : 'bg-destructive text-destructive-foreground shadow-sm';
                                  return (
                                    <button
                                      key={mode.value}
                                      type="button"
                                      aria-pressed={isSelected}
                                      onClick={() => {
                                        setFundAdjustmentMode(mode.value);
                                        setFundAdjustmentError('');
                                      }}
                                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                        isSelected
                                          ? selectedClass
                                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                      }`}
                                    >
                                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                      <span>{mode.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="space-y-2 min-w-0">
                              <Label htmlFor="fundAdjustmentAmount">Số tiền</Label>
                              <CurrencyInput
                                id="fundAdjustmentAmount"
                                value={fundAdjustmentAmount}
                                onChange={(value) => {
                                  setFundAdjustmentAmount(value);
                                  setFundAdjustmentError('');
                                }}
                                placeholder="VD: 200,000…"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="fundAdjustmentReason">Lý do</Label>
                            <textarea
                              id="fundAdjustmentReason"
                              name="fundAdjustmentReason"
                              rows={2}
                              value={fundAdjustmentReason}
                              onChange={(event) => {
                                setFundAdjustmentReason(event.target.value);
                                setFundAdjustmentError('');
                              }}
                              placeholder={fundAdjustmentMode === 'add' ? 'VD: Nạp thêm quỹ tháng này' : 'VD: Dẫn thêm bạn đi chơi'}
                              autoComplete="off"
                              className="flex min-h-[64px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </div>
                          {fundAdjustmentError && (
                            <p className="text-xs font-medium text-destructive">{fundAdjustmentError}</p>
                          )}
                          <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="grid grid-cols-3 gap-2 text-xs sm:min-w-[360px]">
                              <div className="rounded-md bg-muted/50 p-2">
                                <div className="font-medium text-muted-foreground">Hiện tại</div>
                                <div className="mt-1 font-bold tabular-nums text-foreground">{formatVnd(cumulativeStats.rawBalance)}</div>
                              </div>
                              <div className="rounded-md bg-muted/50 p-2">
                                <div className="font-medium text-muted-foreground">Thay đổi</div>
                                <div className={`mt-1 font-bold tabular-nums ${fundAdjustmentMode === 'add' ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                                  {fundAdjustmentMode === 'add' ? '+' : '-'}{formatVnd(fundAdjustmentAmount)}
                                </div>
                              </div>
                              <div className="rounded-md bg-muted/50 p-2">
                                <div className="font-medium text-muted-foreground">Sau lưu</div>
                                <div className={`mt-1 font-bold tabular-nums ${previewDebt > 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                                  {previewDebt > 0 ? `Nợ ${formatVnd(previewDebt)}` : formatVnd(previewBalance)}
                                </div>
                              </div>
                            </div>
                            <Button
                              onClick={() => handleApplyFundAdjustment(member)}
                              disabled={isApplyingFundAdjustment}
                              className={fundAdjustmentMode === 'subtract' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                            >
                              {isApplyingFundAdjustment ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : fundAdjustmentMode === 'add' ? (
                                <Plus className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <MinusCircle className="h-4 w-4" aria-hidden="true" />
                              )}
                              <span>{fundAdjustmentMode === 'add' ? 'Nạp quỹ' : 'Trừ quỹ'}</span>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

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
                              <Table className="min-w-[520px]">
                                <TableHeader>
                                  <TableRow className="text-xs">
                                    <TableHead className="py-2">Ngày chơi</TableHead>
                                    <TableHead className="py-2">Sân</TableHead>
                                    <TableHead className="py-2 text-right">Phí tiền cầu</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentStats.attendedSessions
                                      .toSorted((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
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

                      {/* Lịch sử quỹ */}
                      <Card>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                            <DollarSign className="h-4 w-4 text-muted-foreground" /> Lịch sử quỹ trong tháng ({currentStats.fundTransactions.length} giao dịch)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="max-h-[220px] overflow-y-auto px-4 pb-4">
                            {currentStats.fundTransactions.length === 0 ? (
                              <div className="text-center py-6 text-xs text-muted-foreground">Chưa có giao dịch quỹ nào trong tháng này.</div>
                            ) : (
                              <Table className="min-w-[640px]">
                                <TableHeader>
                                  <TableRow className="text-xs">
                                    <TableHead className="py-2">Ngày</TableHead>
                                    <TableHead className="py-2">Loại</TableHead>
                                    <TableHead className="py-2">Mô tả</TableHead>
                                    <TableHead className="py-2 text-right">Số tiền</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentStats.fundTransactions
                                      .toSorted((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map(tx => (
                                      <TableRow key={tx.id} className="text-xs">
                                          <TableCell className="py-2 font-medium">{formatFullDate(tx.date)}</TableCell>
                                        <TableCell className="py-2">
                                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                            tx.type === 'income'
                                              ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                                              : 'bg-destructive/10 text-destructive'
                                          }`}>
                                            {tx.type === 'income' ? 'Nạp' : 'Trừ'}
                                          </span>
                                        </TableCell>
                                        <TableCell className="py-2 truncate max-w-[220px]">{tx.description}</TableCell>
                                        <TableCell className={`py-2 text-right font-bold ${
                                          tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-destructive'
                                        }`}>
                                            {tx.type === 'income' ? '+' : '-'}{formatVnd(tx.amount)}
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
                  const unpaidSessions = cumulativeStats.attendedSessions
                    .filter(session => !paidIds.includes(session.id))
                    .toSorted((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                  const unpaidAmount = unpaidSessions.length * settings.guestFee;
                  const paymentDescription = buildGuestPaymentDescription(member, unpaidSessions);
                  const paymentQrUrl = buildSepayQrUrl(unpaidAmount, paymentDescription);
                  
                  return (
                    <div className="space-y-4">
                      {/* Thống kê nhanh */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <AuditMetricCard
                            label="Tổng nợ đến hiện tại"
                            value={formatVnd(cumulativeStats.debt)}
                            tone="danger"
                            detail={`Mang sang: ${formatVnd(prevStats.debt)}`}
                          />
                          <AuditMetricCard label="Đi trong tháng" value={`${currentStats.attendedSessions.length} buổi`} />
                          <AuditMetricCard label="Đã đóng trong tháng" value={`${currentStats.deposits.length} lần`} tone="success" />
                          <AuditMetricCard label="Phát sinh nợ mới" value={formatVnd(currentStats.debt)} tone="danger" />
                        </div>

                      {unpaidSessions.length > 0 && (
                        <Card>
                          <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                              <QrCode className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> QR thanh toán vãng lai
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="px-4 pb-4">
                            <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                              <div className="flex aspect-square w-full max-w-[160px] items-center justify-center rounded-md border bg-white p-2">
                                <img
                                  src={paymentQrUrl}
                                  alt={`QR thanh toán ${formatVnd(unpaidAmount)} cho ${member.name}`}
                                  className="size-full object-contain"
                                  loading="lazy"
                                />
                              </div>
                              <div className="space-y-3">
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <div className="rounded-md bg-muted/50 p-3 text-xs">
                                    <div className="font-medium text-muted-foreground">Tổng thiếu</div>
                                    <div className="mt-1 text-lg font-bold text-destructive tabular-nums">{formatVnd(unpaidAmount)}</div>
                                  </div>
                                  <div className="rounded-md bg-muted/50 p-3 text-xs">
                                    <div className="font-medium text-muted-foreground">Buổi chưa đóng</div>
                                    <div className="mt-1 text-lg font-bold tabular-nums">{unpaidSessions.length}</div>
                                  </div>
                                  <div className="rounded-md bg-primary/10 p-3 text-xs">
                                    <div className="font-medium text-primary">Tài khoản</div>
                                    <div className="mt-1 font-bold">{guestPaymentQrConfig.bank} · {guestPaymentQrConfig.account}</div>
                                  </div>
                                </div>
                                <div className="rounded-md border bg-background p-3">
                                  <div className="mb-1 text-xs font-medium text-muted-foreground">Nội dung chuyển khoản</div>
                                  <div className="break-words text-sm font-semibold leading-relaxed">{paymentDescription}</div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Chi tiết đóng phí theo buổi */}
                      <Card>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm font-bold flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-muted-foreground" /> Quản lý đóng phí theo buổi chơi</span>
                              <span className="text-xs font-semibold text-primary">Tick đóng {formatVnd(settings.guestFee)}/buổi</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="max-h-[350px] overflow-y-auto px-4 pb-4">
                            {currentStats.attendedSessions.length === 0 ? (
                              <div className="text-center py-6 text-xs text-muted-foreground">Chưa tham gia buổi đánh nào trong tháng này.</div>
                            ) : (
                              <Table className="min-w-[620px]">
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
                                      .toSorted((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map(s => {
                                      const isPaid = paidIds.includes(s.id);
                                      return (
                                        <TableRow key={s.id} className="text-xs">
                                            <TableCell className="py-2 font-medium">{formatFullDate(s.date)}</TableCell>
                                          <TableCell className="py-2 truncate max-w-[120px]">{s.location}</TableCell>
                                            <TableCell className="py-2 font-bold text-amber-600 dark:text-amber-400">{formatVnd(settings.guestFee)}</TableCell>
                                          <TableCell className="py-2 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPaid ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-destructive/10 text-destructive'}`}>
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
                            <Table className="min-w-[560px]">
                              <TableHeader>
                                <TableRow className="text-xs">
                                  <TableHead className="py-2">Ngày chơi</TableHead>
                                  <TableHead className="py-2">Sân</TableHead>
                                  <TableHead className="py-2 text-right">Chi phí hỗ trợ</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {currentStats.attendedSessions
                                    .toSorted((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                  .map(s => (
                                    <TableRow key={s.id} className="text-xs">
                                        <TableCell className="py-2 font-medium">{formatFullDate(s.date)}</TableCell>
                                      <TableCell className="py-2 truncate max-w-[150px]">{s.location}</TableCell>
                                      <TableCell className="py-2 text-right font-medium text-emerald-600 dark:text-emerald-400">
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
