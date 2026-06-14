import type { ShuttlecockBatch, ShuttlecockBatchUsage } from '../models/types';

export class ShuttlecockInventoryService {
  static sortBatches(batches: ShuttlecockBatch[]): ShuttlecockBatch[] {
    return batches.toSorted((a, b) => {
      const dateDiff = new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.id.localeCompare(b.id);
    });
  }

  static restoreUsage(
    batches: ShuttlecockBatch[],
    usages: ShuttlecockBatchUsage[] | undefined
  ): ShuttlecockBatch[] {
    if (!usages?.length) return batches.map(batch => ({ ...batch }));

    const usageByBatch = new Map<string, number>();
    usages.forEach((usage) => {
      usageByBatch.set(usage.batchId, (usageByBatch.get(usage.batchId) ?? 0) + usage.quantity);
    });

    return batches.map((batch) => {
      const restoredQuantity = usageByBatch.get(batch.id) ?? 0;
      if (restoredQuantity <= 0) return { ...batch };
      return {
        ...batch,
        remainingShuttlecocks: Math.min(
          batch.totalShuttlecocks,
          batch.remainingShuttlecocks + restoredQuantity
        ),
      };
    });
  }

  static consumeFIFO(
    batches: ShuttlecockBatch[],
    quantity: number
  ): {
    isEnough: boolean;
    available: number;
    batches: ShuttlecockBatch[];
    usages: ShuttlecockBatchUsage[];
    totalCost: number;
  } {
    const normalizedQuantity = Math.max(0, Math.floor(quantity));
    const available = batches.reduce((sum, batch) => sum + batch.remainingShuttlecocks, 0);
    const workingBatches = batches.map(batch => ({ ...batch }));

    if (normalizedQuantity === 0) {
      return { isEnough: true, available, batches: workingBatches, usages: [], totalCost: 0 };
    }

    if (available < normalizedQuantity) {
      return { isEnough: false, available, batches: workingBatches, usages: [], totalCost: 0 };
    }

    let remainingToConsume = normalizedQuantity;
    const usages: ShuttlecockBatchUsage[] = [];
    const sortedBatchIds = this.sortBatches(workingBatches).map(batch => batch.id);

    sortedBatchIds.forEach((batchId) => {
      if (remainingToConsume <= 0) return;
      const batch = workingBatches.find(item => item.id === batchId);
      if (!batch || batch.remainingShuttlecocks <= 0) return;

      const quantityFromBatch = Math.min(batch.remainingShuttlecocks, remainingToConsume);
      const amount = Math.round(quantityFromBatch * batch.unitCost);
      batch.remainingShuttlecocks -= quantityFromBatch;
      remainingToConsume -= quantityFromBatch;
      usages.push({
        batchId,
        quantity: quantityFromBatch,
        unitCost: batch.unitCost,
        amount,
      });
    });

    return {
      isEnough: true,
      available,
      batches: workingBatches,
      usages,
      totalCost: usages.reduce((sum, usage) => sum + usage.amount, 0),
    };
  }
}
