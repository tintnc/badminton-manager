import { describe, expect, it } from 'vitest';
import { CostCalculator } from './CostCalculator';
import type { Member } from '../models/types';

const member = (id: string, membershipType: Member['membershipType']): Member => ({
  id,
  name: id,
  joinDate: '2026-01-01',
  isActive: true,
  skillLevel: 2,
  debt: 0,
  membershipType,
});

describe('CostCalculator', () => {
  describe('pricePerShuttlecock', () => {
    it('divides tube price by shuttlecocks per tube', () => {
      expect(CostCalculator.pricePerShuttlecock(300000, 12)).toBe(25000);
    });

    it('returns 0 when per-tube count is zero', () => {
      expect(CostCalculator.pricePerShuttlecock(300000, 0)).toBe(0);
    });
  });

  describe('shuttlecockFee', () => {
    it('multiplies used shuttlecocks by unit price', () => {
      expect(CostCalculator.shuttlecockFee(3, 300000, 12)).toBe(75000);
    });
  });

  describe('calculateDetailedSessionCost', () => {
    const courtFee = 200000;
    const shuttlecockFee = 75000;

    it('charges guests a flat fee and splits shuttlecock fee among everyone', () => {
      const breakdown = CostCalculator.calculateDetailedSessionCost(
        courtFee,
        shuttlecockFee,
        [member('1', 'regular'), member('2', 'employee'), member('3', 'guest')],
        1, // one free guest
        35000
      );

      expect(breakdown.totalCost).toBe(275000);
      expect(breakdown.guestCountTotal).toBe(2);
      expect(breakdown.guestFeeTotal).toBe(70000);
      // 75000 / 4 people = 18750 -> rounded to 19000
      expect(breakdown.costPerPerson).toBe(19000);
      // Employee share of full cost: 275000 / 4 = 68750 -> 69000
      expect(breakdown.subsidyUsed).toBe(69000);
      expect(breakdown.costPerPersonNoSubsidy).toBe(69000);
    });

    it('uses the default guest fee when not provided', () => {
      const breakdown = CostCalculator.calculateDetailedSessionCost(
        0,
        24000,
        [member('1', 'regular'), member('2', 'regular'), member('3', 'employee'), member('4', 'employee')],
        0
      );
      expect(breakdown.guestCountTotal).toBe(0);
      expect(breakdown.guestFeeTotal).toBe(0);
      // 24000 / 4 = 6000 -> rounded to 6000
      expect(breakdown.costPerPerson).toBe(6000);
    });

    it('returns zeros when nobody attends', () => {
      const breakdown = CostCalculator.calculateDetailedSessionCost(courtFee, shuttlecockFee, [], 0, 35000);
      expect(breakdown.costPerPerson).toBe(0);
      expect(breakdown.subsidyUsed).toBe(0);
      expect(breakdown.guestFeeTotal).toBe(0);
    });
  });
});
