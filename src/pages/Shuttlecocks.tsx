import { useMemo, useState } from 'react';
import { Archive, Edit2, Package, Plus, ShoppingCart, Trash2, TrendingDown } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CurrencyInput, IntegerInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatCard } from '@/components/ui/stat-card';
import { toast } from '@/components/ui/toast';
import { formatFullDate, formatNumber, formatVnd } from '@/lib/format';
import { ShuttlecockInventoryService } from '@/core/services/ShuttlecockInventoryService';
import { CostCalculator } from '@/core/services/CostCalculator';
import { PageHeader } from '@/components/ui/page-header';
import type { Member, Session, ShuttlecockBatch, Transaction } from '@/core/models/types';

function dateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateInputToIso(date: string): string {
  return new Date(`${date}T12:00:00`).toISOString();
}

export default function Shuttlecocks() {
  const {
    shuttlecockBatches,
    addShuttlecockBatch,
    updateShuttlecockBatch,
    deleteShuttlecockBatch,
    addTransaction,
    saveTransactions,
    updateSession,
    updateMember,
    sessions,
    members,
    transactions,
    settings,
    globalMonth,
    globalYear,
  } = useAppStore();

  const [purchaseDate, setPurchaseDate] = useState(dateInputValue(new Date()));
  const [tubes, setTubes] = useState(1);
  const [perTube, setPerTube] = useState(settings.shuttlecocksPerTube || 12);
  const [totalCost, setTotalCost] = useState(settings.shuttlecockTubePrice || 300000);
  const [notes, setNotes] = useState('');
  const [editingBatch, setEditingBatch] = useState<ShuttlecockBatch | null>(null);
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editTubes, setEditTubes] = useState(1);
  const [editPerTube, setEditPerTube] = useState(settings.shuttlecocksPerTube || 12);
  const [editTotalCost, setEditTotalCost] = useState(settings.shuttlecockTubePrice || 300000);
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState('');
  const [batchToDelete, setBatchToDelete] = useState<ShuttlecockBatch | null>(null);

  const totalShuttlecocks = tubes * perTube;
  const unitCost = totalShuttlecocks > 0 ? totalCost / totalShuttlecocks : 0;
  const currentMonthStr = `${globalYear}-${String(globalMonth + 1).padStart(2, '0')}`;
  const monthStart = useMemo(() => new Date(globalYear, globalMonth, 1), [globalMonth, globalYear]);
  const monthEnd = useMemo(() => new Date(globalYear, globalMonth + 1, 1), [globalMonth, globalYear]);

  const summary = useMemo(() => {
    const sortedBatches = ShuttlecockInventoryService.sortBatches(shuttlecockBatches);
    const activeBatch = sortedBatches.find(batch => batch.remainingShuttlecocks > 0);
    const remainingShuttlecocks = shuttlecockBatches.reduce((sum, batch) => sum + batch.remainingShuttlecocks, 0);
    const inventoryValue = shuttlecockBatches.reduce(
      (sum, batch) => sum + Math.round(batch.remainingShuttlecocks * batch.unitCost),
      0
    );
    const purchasesThisMonth = shuttlecockBatches.filter(batch => batch.purchaseDate.startsWith(currentMonthStr));
    const purchasedThisMonth = purchasesThisMonth.reduce((sum, batch) => sum + batch.totalShuttlecocks, 0);
    const purchaseCostThisMonth = purchasesThisMonth.reduce((sum, batch) => sum + batch.totalCost, 0);
    const usageRowsForSessions = sessions
      .filter(session => session.status === 'completed')
      .flatMap((session) => {
        if (session.shuttlecockUsages?.length) {
          return [{
            id: session.id,
            date: session.date,
            quantity: session.shuttlecockUsages.reduce((sum, usage) => sum + usage.quantity, 0),
            amount: session.shuttlecockUsages.reduce((sum, usage) => sum + usage.amount, 0),
            batchCount: session.shuttlecockUsages.length,
          }];
        }
        if ((session.shuttlecocksUsed || 0) > 0) {
          return [{
            id: session.id,
            date: session.date,
            quantity: session.shuttlecocksUsed,
            amount: session.shuttlecockFee || 0,
            batchCount: 0,
          }];
        }
        return [];
      });
    const usedByBatch = new Map<string, number>();
    sessions.forEach((session) => {
      session.shuttlecockUsages?.forEach((usage) => {
        usedByBatch.set(usage.batchId, (usedByBatch.get(usage.batchId) ?? 0) + usage.quantity);
      });
    });
    const usageRows = usageRowsForSessions
      .filter(row => row.date.startsWith(currentMonthStr))
      .toSorted((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const usedThisMonth = usageRows.reduce((sum, row) => sum + row.quantity, 0);
    const usageCostThisMonth = usageRows.reduce((sum, row) => sum + row.amount, 0);
    const purchasedBeforeMonth = shuttlecockBatches
      .filter(batch => new Date(batch.purchaseDate) < monthStart)
      .reduce((sum, batch) => sum + batch.totalShuttlecocks, 0);
    const usedBeforeMonth = usageRowsForSessions
      .filter(row => new Date(row.date) < monthStart)
      .reduce((sum, row) => sum + row.quantity, 0);
    const purchasedUntilMonthEnd = shuttlecockBatches
      .filter(batch => new Date(batch.purchaseDate) < monthEnd)
      .reduce((sum, batch) => sum + batch.totalShuttlecocks, 0);
    const usedUntilMonthEnd = usageRowsForSessions
      .filter(row => new Date(row.date) < monthEnd)
      .reduce((sum, row) => sum + row.quantity, 0);
    const openingStock = Math.max(0, purchasedBeforeMonth - usedBeforeMonth);
    const endingStock = Math.max(0, purchasedUntilMonthEnd - usedUntilMonthEnd);

    return {
      activeBatch,
      sortedBatches,
      remainingShuttlecocks,
      inventoryValue,
      purchasedThisMonth,
      purchaseCostThisMonth,
      usedThisMonth,
      usageCostThisMonth,
      openingStock,
      endingStock,
      usedByBatch,
      usageRows,
    };
  }, [currentMonthStr, monthEnd, monthStart, sessions, shuttlecockBatches]);

  const handleAddBatch = async () => {
    if (tubes <= 0 || perTube <= 0 || totalCost <= 0) {
      toast('Nhập số ống, số trái và tổng tiền hợp lệ.', 'error');
      return;
    }

    const batch: ShuttlecockBatch = {
      id: crypto.randomUUID(),
      purchaseDate: dateInputToIso(purchaseDate),
      tubes,
      shuttlecocksPerTube: perTube,
      totalShuttlecocks,
      remainingShuttlecocks: totalShuttlecocks,
      totalCost,
      unitCost,
      notes: notes.trim(),
    };

    await addShuttlecockBatch(batch);
    await addTransaction({
      id: crypto.randomUUID(),
      date: batch.purchaseDate,
      type: 'expense',
      category: 'shuttlecock_purchase',
      amount: totalCost,
      description: `Mua cầu nhập kho (${formatNumber(totalShuttlecocks)} trái)${batch.notes ? ` - ${batch.notes}` : ''}`,
      relatedShuttlecockBatchId: batch.id,
    });

    toast('Đã nhập lô cầu mới vào kho.');
    setTubes(1);
    setPerTube(settings.shuttlecocksPerTube || 12);
    setTotalCost(settings.shuttlecockTubePrice || 300000);
    setNotes('');
  };

  const openEditBatch = (batch: ShuttlecockBatch) => {
    setEditingBatch(batch);
    setEditPurchaseDate(dateInputValue(new Date(batch.purchaseDate)));
    setEditTubes(batch.tubes);
    setEditPerTube(batch.shuttlecocksPerTube);
    setEditTotalCost(batch.totalCost);
    setEditNotes(batch.notes || '');
    setEditError('');
  };

  const updatePurchaseTransactions = (
    currentTransactions: Transaction[],
    batch: ShuttlecockBatch,
    previousBatch: ShuttlecockBatch = batch
  ) => {
    let matched = false;
    const updated = currentTransactions.map((transaction) => {
      const isRelatedTransaction = transaction.relatedShuttlecockBatchId === batch.id;
      const isLegacyLikelyMatch = !transaction.relatedShuttlecockBatchId
        && transaction.category === 'shuttlecock_purchase'
        && transaction.amount === previousBatch.totalCost
        && transaction.date === previousBatch.purchaseDate
        && transaction.description.startsWith('Mua cầu nhập kho');

      if (!isRelatedTransaction && !isLegacyLikelyMatch) return transaction;
      matched = true;
      return {
        ...transaction,
        date: batch.purchaseDate,
        amount: batch.totalCost,
        description: `Mua cầu nhập kho (${formatNumber(batch.totalShuttlecocks)} trái)${batch.notes ? ` - ${batch.notes}` : ''}`,
        relatedShuttlecockBatchId: batch.id,
      };
    });

    if (matched) return updated;

    return [
      ...updated,
      {
        id: crypto.randomUUID(),
        date: batch.purchaseDate,
        type: 'expense' as const,
        category: 'shuttlecock_purchase' as const,
        amount: batch.totalCost,
        description: `Mua cầu nhập kho (${formatNumber(batch.totalShuttlecocks)} trái)${batch.notes ? ` - ${batch.notes}` : ''}`,
        relatedShuttlecockBatchId: batch.id,
      },
    ];
  };

  const recalculateSessionsForEditedBatch = async (batch: ShuttlecockBatch, previousBatch: ShuttlecockBatch) => {
    const affectedSessions = sessions.filter((session) =>
      session.status === 'completed'
      && session.shuttlecockUsages?.some((usage) => usage.batchId === batch.id)
    );
    const memberUpdates = new Map<string, Member>(members.map(member => [member.id, { ...member }]));
    const transactionMap = new Map<string, Transaction>(
      updatePurchaseTransactions(transactions, batch, previousBatch).map(transaction => [transaction.id, { ...transaction }])
    );

    for (const session of affectedSessions) {
      const updatedUsages = (session.shuttlecockUsages ?? []).map((usage) => {
        if (usage.batchId !== batch.id) return usage;
        return {
          ...usage,
          unitCost: batch.unitCost,
          amount: Math.round(usage.quantity * batch.unitCost),
        };
      });
      const shuttlecockFee = updatedUsages.reduce((sum, usage) => sum + usage.amount, 0);
      const attendees = members.filter(member => session.attendeeIds.includes(member.id));
      const breakdown = CostCalculator.calculateDetailedSessionCost(
        session.courtFee,
        shuttlecockFee,
        attendees,
        session.guestCount,
        settings.guestFee
      );

      const oldCostPerPerson = session.costPerPerson || 0;
      const newCostPerPerson = breakdown.costPerPerson || 0;
      if (oldCostPerPerson !== newCostPerPerson) {
        attendees.forEach((attendee) => {
          const type = attendee.membershipType || 'regular';
          if (type !== 'regular') return;
          const current = memberUpdates.get(attendee.id) ?? { ...attendee };
          memberUpdates.set(attendee.id, {
            ...current,
            prepaidBalance: (current.prepaidBalance || 0) + oldCostPerPerson - newCostPerPerson,
          });
        });
      }

      const updatedSession: Session = {
        ...session,
        shuttlecockFee,
        shuttlecockUsages: updatedUsages,
        totalCost: breakdown.totalCost,
        fundSubsidyUsed: breakdown.subsidyUsed,
        costPerPerson: breakdown.costPerPerson,
        costPerPersonNoSubsidy: breakdown.costPerPersonNoSubsidy,
      };
      await updateSession(updatedSession);

      const dateLabel = formatFullDate(session.date);
      let hasShuttlecockTransaction = false;
      let hasSupportTransaction = false;
      transactionMap.forEach((transaction, id) => {
        if (transaction.relatedSessionId !== session.id) return;

        if (transaction.category === 'shuttlecock_fee') {
          hasShuttlecockTransaction = true;
          transactionMap.set(id, {
            ...transaction,
            amount: shuttlecockFee,
            description: `Tiền cầu buổi ${dateLabel} (${session.shuttlecocksUsed} trái từ kho)`,
          });
        }

        if (transaction.category === 'support_fund') {
          hasSupportTransaction = true;
          transactionMap.set(id, {
            ...transaction,
            amount: breakdown.subsidyUsed,
            description: `Quỹ hỗ trợ buổi ${dateLabel} (${breakdown.employeeCount} nhân viên)`,
          });
        }
      });

      if (!hasShuttlecockTransaction && shuttlecockFee > 0) {
        const id = crypto.randomUUID();
        transactionMap.set(id, {
          id,
          date: session.date,
          type: 'expense',
          category: 'shuttlecock_fee',
          amount: shuttlecockFee,
          description: `Tiền cầu buổi ${dateLabel} (${session.shuttlecocksUsed} trái từ kho)`,
          relatedSessionId: session.id,
        });
      }

      if (!hasSupportTransaction && breakdown.subsidyUsed > 0) {
        const id = crypto.randomUUID();
        transactionMap.set(id, {
          id,
          date: session.date,
          type: 'income',
          category: 'support_fund',
          amount: breakdown.subsidyUsed,
          description: `Quỹ hỗ trợ buổi ${dateLabel} (${breakdown.employeeCount} nhân viên)`,
          relatedSessionId: session.id,
        });
      }
    }

    for (const updatedMember of memberUpdates.values()) {
      const original = members.find(member => member.id === updatedMember.id);
      if (original && original.prepaidBalance !== updatedMember.prepaidBalance) {
        await updateMember(updatedMember);
      }
    }

    await saveTransactions(Array.from(transactionMap.values()).filter(transaction => transaction.amount > 0));
  };

  const handleSaveBatchEdit = async () => {
    if (!editingBatch) return;
    const usedQuantity = summary.usedByBatch.get(editingBatch.id) ?? 0;

    if (editTubes <= 0 || editPerTube <= 0 || editTotalCost <= 0) {
      setEditError('Nhập số ống, số trái và tổng tiền hợp lệ.');
      return;
    }

    const nextTotalShuttlecocks = editTubes * editPerTube;
    if (nextTotalShuttlecocks < usedQuantity) {
      setEditError(`Lô này đã dùng ${formatNumber(usedQuantity)} trái, không thể giảm tổng số trái thấp hơn mức đã dùng.`);
      return;
    }

    const nextUnitCost = editTotalCost / nextTotalShuttlecocks;
    const updatedBatch: ShuttlecockBatch = {
      ...editingBatch,
      purchaseDate: dateInputToIso(editPurchaseDate),
      tubes: editTubes,
      shuttlecocksPerTube: editPerTube,
      totalShuttlecocks: nextTotalShuttlecocks,
      remainingShuttlecocks: nextTotalShuttlecocks - usedQuantity,
      totalCost: editTotalCost,
      unitCost: nextUnitCost,
      notes: editNotes.trim(),
    };

    await updateShuttlecockBatch(updatedBatch);
    await recalculateSessionsForEditedBatch(updatedBatch, editingBatch);
    setEditingBatch(null);
    toast('Đã cập nhật lô cầu.');
  };

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    const usedQuantity = summary.usedByBatch.get(batchToDelete.id) ?? 0;
    if (usedQuantity > 0) {
      toast(`Không thể xóa lô đã dùng ${formatNumber(usedQuantity)} trái. Hãy sửa thông tin lô thay vì xóa.`, 'error');
      setBatchToDelete(null);
      return;
    }

    await deleteShuttlecockBatch(batchToDelete.id);
    setBatchToDelete(null);
    toast('Đã xóa lô cầu chưa sử dụng.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kho cầu"
        description="Quản lý lô cầu nhập kho, tồn kho và chi phí sử dụng FIFO cho mỗi buổi."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Tồn đầu tháng"
          value={`${formatNumber(summary.openingStock)} trái`}
          detail="Mang sang từ tháng trước"
          icon={Archive}
          tone="info"
          revealDelay={0}
        />
        <StatCard
          label="Mua trong tháng"
          value={`${formatNumber(summary.purchasedThisMonth)} trái`}
          detail={formatVnd(summary.purchaseCostThisMonth)}
          icon={ShoppingCart}
          revealDelay={80}
        />
        <StatCard
          label="Dùng trong tháng"
          value={`${formatNumber(summary.usedThisMonth)} trái`}
          detail={formatVnd(summary.usageCostThisMonth)}
          icon={TrendingDown}
          tone="danger"
          revealDelay={160}
        />
        <StatCard
          label="Tồn cuối tháng"
          value={`${formatNumber(summary.endingStock)} trái`}
          detail={`Hiện tại: ${formatNumber(summary.remainingShuttlecocks)} trái · ${formatVnd(summary.inventoryValue)}`}
          icon={Archive}
          tone="success"
          revealDelay={240}
        />
        <StatCard
          label="Lô đang dùng"
          value={summary.activeBatch ? `${formatNumber(summary.activeBatch.remainingShuttlecocks)} trái` : 'Hết cầu'}
          detail={summary.activeBatch ? `${formatVnd(summary.activeBatch.unitCost)} / trái` : 'Cần nhập thêm cầu'}
          icon={Package}
          tone={summary.activeBatch ? 'info' : 'danger'}
          revealDelay={320}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" aria-hidden="true" /> Nhập lô cầu
            </CardTitle>
            <CardDescription>
              Mỗi lần mua cầu tạo một lô riêng. Khi điểm danh, hệ thống tự trừ lô cũ trước.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Ngày mua</Label>
              <Input
                id="purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tubes">Số ống</Label>
                <IntegerInput id="tubes" value={tubes} onChange={setTubes} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perTube">Trái / ống</Label>
                <IntegerInput id="perTube" value={perTube} onChange={setPerTube} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalCost">Tổng tiền mua</Label>
              <CurrencyInput id="totalCost" value={totalCost} onChange={setTotalCost} placeholder="VD: 300,000…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Ghi chú</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="VD: Ống Victor xanh, mua shop A"
                autoComplete="off"
              />
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tổng số trái</span>
                <span className="font-semibold">{formatNumber(totalShuttlecocks)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Giá vốn / trái</span>
                <span className="font-semibold text-primary">{formatVnd(unitCost)}</span>
              </div>
            </div>
            <Button className="w-full" onClick={handleAddBatch}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Nhập kho
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lịch sử lô cầu</CardTitle>
            <CardDescription>
              Lô cũ hơn sẽ được dùng trước. Số dư ở đây là tồn có thể mang sang tháng sau.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày mua</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead className="text-right">Tồn</TableHead>
                  <TableHead className="text-right">Đã dùng</TableHead>
                  <TableHead className="text-right">Giá / trái</TableHead>
                  <TableHead className="text-right">Tổng tiền</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.sortedBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                      Chưa có lô cầu nào. Nhập lô cầu đầu tiên để bắt đầu tính tồn kho.
                    </TableCell>
                  </TableRow>
                ) : (
                  summary.sortedBatches.toReversed().map(batch => {
                    const usedQuantity = summary.usedByBatch.get(batch.id) ?? 0;
                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">{formatFullDate(batch.purchaseDate)}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{batch.notes || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="font-semibold tabular-nums">
                            {formatNumber(batch.remainingShuttlecocks)} / {formatNumber(batch.totalShuttlecocks)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatNumber(batch.tubes)} ống x {formatNumber(batch.shuttlecocksPerTube)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(usedQuantity)}</TableCell>
                        <TableCell className="text-right">{formatVnd(batch.unitCost)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatVnd(batch.totalCost)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" aria-label={`Sửa lô cầu ngày ${formatFullDate(batch.purchaseDate)}`} onClick={() => openEditBatch(batch)}>
                              <Edit2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Xóa lô cầu ngày ${formatFullDate(batch.purchaseDate)}`}
                              onClick={() => setBatchToDelete(batch)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cầu đã dùng trong tháng</CardTitle>
          <CardDescription>
            Dữ liệu lấy từ các buổi đã hoàn thành trong tháng đang chọn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead>Ngày chơi</TableHead>
                <TableHead className="text-right">Số trái</TableHead>
                <TableHead className="text-right">Số lô</TableHead>
                <TableHead className="text-right">Chi phí cầu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.usageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    Chưa có buổi nào dùng cầu trong tháng này.
                  </TableCell>
                </TableRow>
              ) : (
                summary.usageRows.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{formatFullDate(row.date)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.quantity)}</TableCell>
                    <TableCell className="text-right">{row.batchCount > 0 ? row.batchCount : 'Cũ'}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">{formatVnd(row.amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingBatch} onOpenChange={(open) => !open && setEditingBatch(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sửa lô cầu</DialogTitle>
            <DialogDescription>
              Nếu lô đã được dùng, các buổi liên quan sẽ tự tính lại tiền cầu theo giá mới.
            </DialogDescription>
          </DialogHeader>
          {editingBatch && (() => {
            const usedQuantity = summary.usedByBatch.get(editingBatch.id) ?? 0;
            const nextTotalShuttlecocks = editTubes * editPerTube;
            const nextRemaining = Math.max(0, nextTotalShuttlecocks - usedQuantity);
            const nextUnitCost = nextTotalShuttlecocks > 0 ? editTotalCost / nextTotalShuttlecocks : 0;

            return (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="editPurchaseDate">Ngày mua</Label>
                  <Input
                    id="editPurchaseDate"
                    type="date"
                    value={editPurchaseDate}
                    onChange={(event) => {
                      setEditPurchaseDate(event.target.value);
                      setEditError('');
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="editTubes">Số ống</Label>
	                    <IntegerInput
	                      id="editTubes"
	                      value={editTubes}
	                      onChange={(value) => {
                        setEditTubes(value);
                        setEditError('');
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editPerTube">Trái / ống</Label>
	                    <IntegerInput
	                      id="editPerTube"
	                      value={editPerTube}
	                      onChange={(value) => {
                        setEditPerTube(value);
                        setEditError('');
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editTotalCost">Tổng tiền mua</Label>
	                  <CurrencyInput
	                    id="editTotalCost"
	                    value={editTotalCost}
	                    onChange={(value) => {
                      setEditTotalCost(value);
                      setEditError('');
                    }}
                    placeholder="VD: 300,000…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editNotes">Ghi chú</Label>
                  <Input
                    id="editNotes"
                    value={editNotes}
                    onChange={(event) => setEditNotes(event.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Đã dùng</span>
                    <span className="font-semibold">{formatNumber(usedQuantity)} trái</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">Tồn sau sửa</span>
                    <span className="font-semibold">{formatNumber(nextRemaining)} trái</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">Giá vốn / trái</span>
                    <span className="font-semibold text-primary">{formatVnd(nextUnitCost)}</span>
                  </div>
                </div>
                {editError && <p className="text-sm font-medium text-destructive">{editError}</p>}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditingBatch(null)}>
                    Hủy
                  </Button>
                  <Button onClick={handleSaveBatchEdit}>
                    Lưu thay đổi
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!batchToDelete} onOpenChange={(open) => !open && setBatchToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa lô cầu?</DialogTitle>
            <DialogDescription>
              Chỉ có thể xóa lô chưa được dùng trong buổi đánh nào.
            </DialogDescription>
          </DialogHeader>
          {batchToDelete && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ngày mua</span>
                  <span className="font-semibold">{formatFullDate(batchToDelete.purchaseDate)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Đã dùng</span>
                  <span className="font-semibold">{formatNumber(summary.usedByBatch.get(batchToDelete.id) ?? 0)} trái</span>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBatchToDelete(null)}>
                  Hủy
                </Button>
                <Button variant="destructive" onClick={handleDeleteBatch}>
                  Xóa lô cầu
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
