import { describe, expect, it } from 'vitest';
import { MemberFinanceService } from './MemberFinanceService';
import type { Member, Session, Transaction } from '../models/types';

const member = (id: string, membershipType: Member['membershipType'], extra: Partial<Member> = {}): Member => ({
  id,
  name: id,
  joinDate: '2026-01-01',
  isActive: true,
  skillLevel: 2,
  debt: 0,
  membershipType,
  ...extra,
});

const session = (id: string, date: string, attendeeIds: string[], costPerPerson = 19000): Session => ({
  id,
  date,
  startTime: '19:00',
  endTime: '21:00',
  location: 'Sân C30',
  status: 'completed',
  courtFee: 200000,
  shuttlecocksUsed: 3,
  shuttlecockFee: 75000,
  fundSubsidyUsed: 0,
  totalCost: 275000,
  attendeeIds,
  guestCount: 0,
  costPerPerson,
  costPerPersonNoSubsidy: 69000,
});

const tx = (id: string, date: string, type: Transaction['type'], amount: number, relatedMemberId?: string): Transaction => ({
  id,
  date,
  type,
  category: 'member_payment',
  amount,
  description: '',
  relatedMemberId,
});

describe('MemberFinanceService', () => {
  describe('isWithinRange', () => {
    it('includes all history up to the end month when no start is given', () => {
      expect(MemberFinanceService.isWithinRange('2026-07-15', 6, 2026)).toBe(true);
      expect(MemberFinanceService.isWithinRange('2026-06-30', 6, 2026)).toBe(true);
      expect(MemberFinanceService.isWithinRange('2026-08-01', 6, 2026)).toBe(false);
    });

    it('respects an explicit start boundary', () => {
      expect(MemberFinanceService.isWithinRange('2026-06-30', 6, 2026, 6, 2026)).toBe(false);
      expect(MemberFinanceService.isWithinRange('2026-07-01', 6, 2026, 6, 2026)).toBe(true);
    });
  });

  describe('calculateMemberFinancials', () => {
    it('computes regular member balance from deposits minus play cost', () => {
      const regular = member('m1', 'regular');
      const stats = MemberFinanceService.calculateMemberFinancials(
        regular,
        [session('s1', '2026-07-10', ['m1'])],
        [tx('t1', '2026-07-01', 'income', 100000, 'm1')],
        35000,
        6, // July
        2026
      );
      expect(stats.balance).toBe(100000 - 19000);
      expect(stats.debt).toBe(0);
      expect(stats.attendedSessions).toHaveLength(1);
    });

    it('computes guest debt from attended sessions minus payments', () => {
      const guest = member('g1', 'guest');
      const stats = MemberFinanceService.calculateMemberFinancials(
        guest,
        [session('s1', '2026-07-10', ['g1']), session('s2', '2026-07-14', ['g1'])],
        [tx('t1', '2026-07-12', 'income', 35000, 'g1')],
        35000,
        6,
        2026
      );
      expect(stats.totalPlayedCost).toBe(70000);
      expect(stats.debt).toBe(35000);
    });
  });

  describe('getGuestDebt', () => {
    it('derives debt purely from paidSessionIds', () => {
      const guest = member('g1', 'guest', { paidSessionIds: ['s1'] });
      const debt = MemberFinanceService.getGuestDebt(
        guest,
        [session('s1', '2026-07-10', ['g1']), session('s2', '2026-07-14', ['g1'])],
        35000
      );
      expect(debt).toBe(35000);
    });

    it('returns zero when everything is paid', () => {
      const guest = member('g1', 'guest', { paidSessionIds: ['s1', 's2'] });
      const debt = MemberFinanceService.getGuestDebt(
        guest,
        [session('s1', '2026-07-10', ['g1']), session('s2', '2026-07-14', ['g1'])],
        35000
      );
      expect(debt).toBe(0);
    });
  });
});
