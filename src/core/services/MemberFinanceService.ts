import type { Member, Session, Transaction } from '../models/types';

export interface MemberFinancialStats {
  balance: number;
  debt: number;
  rawBalance: number;
  totalDeposited: number;
  totalFundDeductions: number;
  totalPlayedCost: number;
  deposits: Transaction[];
  fundDeductions: Transaction[];
  fundTransactions: Transaction[];
  attendedSessions: Session[];
}

export class MemberFinanceService {
  /**
   * Checks whether a date string falls inside [start of startMonth, start of endMonth+1).
   * Uses real Date objects instead of string comparison so month boundaries are
   * timezone-correct.
   *
   * NOTE: When `startMonth`/`startYear` are omitted the range is cumulative — it
   * includes everything up to the end of `endMonth` (with no lower bound). Pass an
   * explicit start to scope to a single month (e.g. the audit dialog's per-month view).
   */
  static isWithinRange(
    dateStr: string,
    endMonth: number,
    endYear: number,
    startMonth?: number,
    startYear?: number
  ): boolean {
    const endLimit = new Date(endYear, endMonth + 1, 1).getTime();
    const startLimit =
      startMonth !== undefined && startYear !== undefined
        ? new Date(startYear, startMonth, 1).getTime()
        : -Infinity;
    const time = new Date(dateStr).getTime();
    return time >= startLimit && time < endLimit;
  }

  /**
   * Computes a member's financial position from transactions + completed sessions.
   * This is the single source of truth for balances and debts.
   */
  static calculateMemberFinancials(
    member: Member,
    sessions: Session[],
    transactions: Transaction[],
    guestFee: number,
    endMonth: number,
    endYear: number,
    startMonth?: number,
    startYear?: number
  ): MemberFinancialStats {
    const type = member.membershipType || 'regular';
    const isWithinRange = (dateStr: string) =>
      MemberFinanceService.isWithinRange(dateStr, endMonth, endYear, startMonth, startYear);

    if (type === 'regular') {
      const fundTransactions = transactions.filter(
        t => t.relatedMemberId === member.id && t.category === 'member_payment' && isWithinRange(t.date)
      );
      const deposits = fundTransactions.filter(t => t.type === 'income');
      const fundDeductions = fundTransactions.filter(t => t.type === 'expense');
      const totalDeposited = deposits.reduce((sum, t) => sum + t.amount, 0);
      const totalFundDeductions = fundDeductions.reduce((sum, t) => sum + t.amount, 0);

      const attendedSessions = sessions.filter(
        s => s.status === 'completed' && s.attendeeIds.includes(member.id) && isWithinRange(s.date)
      );
      const totalPlayedCost = attendedSessions.reduce((sum, s) => sum + (s.costPerPerson || 0), 0);

      const balance = totalDeposited - totalFundDeductions - totalPlayedCost;
      return {
        balance: balance > 0 ? balance : 0,
        debt: balance < 0 ? -balance : 0,
        rawBalance: balance,
        totalDeposited,
        totalFundDeductions,
        totalPlayedCost,
        deposits,
        fundDeductions,
        fundTransactions,
        attendedSessions,
      };
    }

    if (type === 'guest') {
      const attendedSessions = sessions.filter(
        s => s.status === 'completed' && s.attendeeIds.includes(member.id) && isWithinRange(s.date)
      );
      const totalDebtIncurred = attendedSessions.length * guestFee;

      const deposits = transactions.filter(
        t =>
          t.relatedMemberId === member.id &&
          t.type === 'income' &&
          t.category === 'member_payment' &&
          isWithinRange(t.date)
      );
      const totalPaid = deposits.reduce((sum, t) => sum + t.amount, 0);

      return {
        balance: 0,
        debt: Math.max(0, totalDebtIncurred - totalPaid),
        rawBalance: totalPaid - totalDebtIncurred,
        totalDeposited: totalPaid,
        totalFundDeductions: 0,
        totalPlayedCost: totalDebtIncurred,
        deposits,
        fundDeductions: [],
        fundTransactions: deposits,
        attendedSessions,
      };
    }

    return {
      balance: 0,
      debt: 0,
      rawBalance: 0,
      totalDeposited: 0,
      totalFundDeductions: 0,
      totalPlayedCost: 0,
      deposits: [],
      fundDeductions: [],
      fundTransactions: [],
      attendedSessions: [],
    };
  }

  /**
   * A guest's debt is derived purely from paidSessionIds:
   * unpaid completed sessions × guest fee. Keeps stored debt in sync with the
   * per-session payment checkboxes.
   */
  static getGuestDebt(member: Member, sessions: Session[], guestFee: number): number {
    const paidIds = new Set(member.paidSessionIds || []);
    const unpaidSessionsCount = sessions.filter(
      s => s.status === 'completed' && s.attendeeIds.includes(member.id) && !paidIds.has(s.id)
    ).length;
    return unpaidSessionsCount * guestFee;
  }
}
