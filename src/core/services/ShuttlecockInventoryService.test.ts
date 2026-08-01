import { describe, expect, it } from 'vitest';
import { ShuttlecockInventoryService } from './ShuttlecockInventoryService';
import type { ShuttlecockBatch } from '../models/types';

const batch = (id: string, purchaseDate: string, remainingShuttlecocks: number, unitCost: number, totalShuttlecocks = remainingShuttlecocks): ShuttlecockBatch => ({
  id,
  purchaseDate,
  tubes: 1,
  shuttlecocksPerTube: 12,
  totalShuttlecocks,
  remainingShuttlecocks,
  totalCost: unitCost * totalShuttlecocks,
  unitCost,
});

describe('ShuttlecockInventoryService', () => {
  describe('sortBatches', () => {
    it('sorts oldest purchase date first, then by id', () => {
      const sorted = ShuttlecockInventoryService.sortBatches([
        batch('b', '2026-01-10', 12, 20000),
        batch('a', '2026-01-01', 12, 25000),
      ]);
      expect(sorted.map(item => item.id)).toEqual(['a', 'b']);
    });
  });

  describe('consumeFIFO', () => {
    it('consumes oldest batches first', () => {
      const result = ShuttlecockInventoryService.consumeFIFO(
        [
          batch('a', '2026-01-01', 5, 25000),
          batch('b', '2026-01-10', 3, 20000),
        ],
        6
      );

      expect(result.isEnough).toBe(true);
      expect(result.totalCost).toBe(5 * 25000 + 1 * 20000);
      expect(result.usages).toEqual([
        { batchId: 'a', quantity: 5, unitCost: 25000, amount: 125000 },
        { batchId: 'b', quantity: 1, unitCost: 20000, amount: 20000 },
      ]);
      expect(result.batches.find(item => item.id === 'a')?.remainingShuttlecocks).toBe(0);
      expect(result.batches.find(item => item.id === 'b')?.remainingShuttlecocks).toBe(2);
    });

    it('reports insufficient stock without consuming', () => {
      const original = [
        batch('a', '2026-01-01', 2, 25000),
        batch('b', '2026-01-10', 1, 20000),
      ];
      const result = ShuttlecockInventoryService.consumeFIFO(original, 4);

      expect(result.isEnough).toBe(false);
      expect(result.available).toBe(3);
      expect(result.usages).toEqual([]);
      expect(result.batches).toEqual(original);
    });

    it('returns zero cost for zero quantity', () => {
      const result = ShuttlecockInventoryService.consumeFIFO(
        [batch('a', '2026-01-01', 5, 25000)],
        0
      );
      expect(result.isEnough).toBe(true);
      expect(result.totalCost).toBe(0);
      expect(result.usages).toEqual([]);
    });
  });

  describe('restoreUsage', () => {
    it('adds back consumed quantity without exceeding total', () => {
      const restored = ShuttlecockInventoryService.restoreUsage(
        [batch('a', '2026-01-01', 2, 25000, 12)],
        [{ batchId: 'a', quantity: 3, unitCost: 25000, amount: 75000 }]
      );
      expect(restored[0].remainingShuttlecocks).toBe(5);
    });

    it('clamps to total when usage is restored beyond original', () => {
      const restored = ShuttlecockInventoryService.restoreUsage(
        [batch('a', '2026-01-01', 2, 25000, 12)],
        [{ batchId: 'a', quantity: 50, unitCost: 25000, amount: 1250000 }]
      );
      expect(restored[0].remainingShuttlecocks).toBe(12);
    });
  });
});
