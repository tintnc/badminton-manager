import { eachDayOfInterval, endOfMonth, isThursday, isTuesday, format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { Member, Session, ShuttlecockBatch, Transaction } from '../models/types';

/**
 * Builds a self-consistent, fully fabricated dataset for a given month, used to
 * demo the app when there is no real data yet. All names, balances and figures
 * are fictional.
 */
export interface DemoData {
  members: Member[];
  sessions: Session[];
  transactions: Transaction[];
  shuttlecockBatches: ShuttlecockBatch[];
}

interface DemoPerson {
  name: string;
  nickname: string;
  phone: string;
  skillLevel: number;
  membershipType: 'employee' | 'regular' | 'guest';
  prepaidBalance: number;
}

// Fictional roster — fixed ids so sessions/transactions can reference them.
const DEMO_PEOPLE: { id: string; person: DemoPerson }[] = [
  { id: 'm1', person: { name: 'Minh Nguyễn', nickname: 'Bboy', phone: '0901 000 001', skillLevel: 4, membershipType: 'employee', prepaidBalance: 0 } },
  { id: 'm2', person: { name: 'Thu Trần', nickname: '', phone: '0901 000 002', skillLevel: 3, membershipType: 'regular', prepaidBalance: 150000 } },
  { id: 'm3', person: { name: 'Huy Lê', nickname: 'Nhỏ', phone: '', skillLevel: 2, membershipType: 'regular', prepaidBalance: 320000 } },
  { id: 'm4', person: { name: 'Lan Phạm', nickname: '', phone: '', skillLevel: 2, membershipType: 'employee', prepaidBalance: 0 } },
  { id: 'm5', person: { name: 'Nam Đỗ', nickname: '', phone: '0901 000 005', skillLevel: 3, membershipType: 'guest', prepaidBalance: 0 } },
  { id: 'm6', person: { name: 'Trang Võ', nickname: '', phone: '', skillLevel: 3, membershipType: 'employee', prepaidBalance: 0 } },
  { id: 'm7', person: { name: 'Quân Hoàng', nickname: '', phone: '', skillLevel: 2, membershipType: 'regular', prepaidBalance: 95000 } },
  { id: 'm8', person: { name: 'Mai Bùi', nickname: '', phone: '', skillLevel: 2, membershipType: 'guest', prepaidBalance: 0 } },
  { id: 'm9', person: { name: 'Bảo Đặng', nickname: 'Dế', phone: '', skillLevel: 4, membershipType: 'regular', prepaidBalance: 200000 } },
  { id: 'm10', person: { name: 'Linh Ngô', nickname: '', phone: '0901 000 010', skillLevel: 1, membershipType: 'guest', prepaidBalance: 0 } },
];

// Completed-session templates to cycle through (fictional figures).
const COST_PATTERNS: {
  courtFee: number;
  birds: number;
  shuttlecockFee: number;
  subsidyUsed: number;
  totalCost: number;
  costPerPerson: number;
  costPerPersonNoSubsidy: number;
  attendees: string[];
  guestCount: number;
}[] = [
  {
    courtFee: 300000, birds: 3, shuttlecockFee: 75000, subsidyUsed: 187500, totalCost: 375000,
    costPerPerson: 15000, costPerPersonNoSubsidy: 75000,
    attendees: ['m1', 'm2', 'm3', 'm4', 'm5'], guestCount: 0,
  },
  {
    courtFee: 300000, birds: 4, shuttlecockFee: 100000, subsidyUsed: 160000, totalCost: 400000,
    costPerPerson: 17000, costPerPersonNoSubsidy: 67000,
    attendees: ['m1', 'm2', 'm3', 'm6', 'm7', 'm8'], guestCount: 0,
  },
  {
    courtFee: 300000, birds: 2, shuttlecockFee: 50000, subsidyUsed: 175000, totalCost: 350000,
    costPerPerson: 13000, costPerPersonNoSubsidy: 88000,
    attendees: ['m1', 'm4', 'm6', 'm7'], guestCount: 0,
  },
  {
    courtFee: 300000, birds: 3, shuttlecockFee: 75000, subsidyUsed: 150000, totalCost: 375000,
    costPerPerson: 15000, costPerPersonNoSubsidy: 75000,
    attendees: ['m2', 'm3', 'm5', 'm8', 'm1'], guestCount: 1,
  },
];

function daysInMonth(year: number, month: number): Date[] {
  return eachDayOfInterval({
    start: new Date(year, month, 1),
    end: endOfMonth(new Date(year, month, 1)),
  });
}

function daysOfPlay(year: number, month: number): Date[] {
  return daysInMonth(year, month).filter((day) => isTuesday(day) || isThursday(day));
}

export class DemoDataGenerator {
  static generate(year: number, month: number): DemoData {
    const members: Member[] = DEMO_PEOPLE.map(({ id, person }) => ({
      id,
      name: person.name,
      nickname: person.nickname || '',
      phone: person.phone || '',
      joinDate: new Date(year, month, 1).toISOString(),
      isActive: true,
      skillLevel: person.skillLevel,
      debt: 0,
      notes: 'Dữ liệu demo',
      membershipType: person.membershipType,
      prepaidBalance: person.membershipType === 'regular' ? person.prepaidBalance : 0,
      paidSessionIds: person.membershipType === 'guest' ? [] : undefined,
    }));

    const playDays = daysOfPlay(year, month);
    const completedCount = Math.min(COST_PATTERNS.length, Math.max(0, playDays.length - 2));
    const completedDays = playDays.slice(0, completedCount);
    const plannedDays = playDays.slice(completedCount);

    const hour = new Date();
    hour.setHours(19, 0, 0, 0);

    const sessions: Session[] = [
      ...completedDays.map((day, i) => {
        const p = COST_PATTERNS[i % COST_PATTERNS.length];
        const id = `demo-s${i + 1}`;
        return {
          id,
          date: format(day, 'yyyy-MM-dd'),
          startTime: '19:00',
          endTime: '21:00',
          location: 'Sân cầu lông C30',
          status: 'completed' as const,
          courtFee: p.courtFee,
          shuttlecocksUsed: p.birds,
          shuttlecockFee: p.shuttlecockFee,
          fundSubsidyUsed: p.subsidyUsed,
          totalCost: p.totalCost,
          attendeeIds: p.attendees,
          guestCount: p.guestCount,
          costPerPerson: p.costPerPerson,
          costPerPersonNoSubsidy: p.costPerPersonNoSubsidy,
          shuttlecockUsages: [
            { batchId: 'demo-b1', quantity: p.birds, unitCost: 25000, amount: p.shuttlecockFee },
          ],
        };
      }),
      ...plannedDays.map((day, i) => ({
        id: `demo-plan-${i + 1}`,
        date: format(day, 'yyyy-MM-dd'),
        startTime: '19:00',
        endTime: '21:00',
        location: 'Sân cầu lông C30',
        status: 'planned' as const,
        courtFee: 0,
        shuttlecocksUsed: 0,
        shuttlecockFee: 0,
        fundSubsidyUsed: 0,
        totalCost: 0,
        attendeeIds: [],
        guestCount: 0,
        costPerPerson: 0,
        costPerPersonNoSubsidy: 0,
      })),
    ];

    const shuttlecockBatches: ShuttlecockBatch[] = [
      {
        id: 'demo-b1',
        purchaseDate: new Date(year, month, 1).toISOString(),
        tubes: 1,
        shuttlecocksPerTube: 12,
        totalShuttlecocks: 12,
        remainingShuttlecocks: 12 - completedDays.reduce((sum, _d, i) => sum + COST_PATTERNS[i % COST_PATTERNS.length].birds, 0),
        totalCost: 300000,
        unitCost: 25000,
        notes: 'Lô demo',
      },
      {
        id: 'demo-b2',
        purchaseDate: new Date(year, month, 15).toISOString(),
        tubes: 1,
        shuttlecocksPerTube: 12,
        totalShuttlecocks: 12,
        remainingShuttlecocks: 12,
        totalCost: 300000,
        unitCost: 25000,
        notes: 'Lô demo tháng',
      },
    ];

    const transactions: Transaction[] = [];
    const monthStart = new Date(year, month, 1).toISOString();

    // Fixed member deposits for regular members with a starting balance.
    for (const { id, person } of DEMO_PEOPLE) {
      if (person.membershipType === 'regular' && person.prepaidBalance > 0) {
        transactions.push({
          id: uuidv4(),
          date: monthStart,
          type: 'income',
          category: 'member_payment',
          amount: person.prepaidBalance,
          description: `Thành viên ${person.name} nạp quỹ (+${person.prepaidBalance.toLocaleString('vi-VN')} ₫)`,
          relatedMemberId: id,
        });
      }
    }

    // Shuttlecock batch purchase.
    transactions.push({
      id: uuidv4(),
      date: monthStart,
      type: 'expense',
      category: 'shuttlecock_purchase',
      amount: 300000,
      description: 'Mua cầu nhập kho (12 trái) - lô demo',
      relatedShuttlecockBatchId: 'demo-b1',
    });

    // Per completed session: court fee + shuttlecock fee + support fund + guest collection.
    completedDays.forEach((day, i) => {
      const p = COST_PATTERNS[i % COST_PATTERNS.length];
      const sessionId = `demo-s${i + 1}`;
      const dateLabel = format(day, 'dd-MM');

      transactions.push({
        id: uuidv4(), date: format(day, 'yyyy-MM-dd'), type: 'expense', category: 'court_fee',
        amount: p.courtFee, description: `Tiền sân buổi ${dateLabel}`, relatedSessionId: sessionId,
      });
      transactions.push({
        id: uuidv4(), date: format(day, 'yyyy-MM-dd'), type: 'expense', category: 'shuttlecock_fee',
        amount: p.shuttlecockFee, description: `Tiền cầu buổi ${dateLabel} (${p.birds} trái từ kho)`, relatedSessionId: sessionId,
      });
      const employeeCount = p.attendees.filter((id) => DEMO_PEOPLE.find((m) => m.id === id)?.person.membershipType === 'employee').length;
      transactions.push({
        id: uuidv4(), date: format(day, 'yyyy-MM-dd'), type: 'income', category: 'support_fund',
        amount: p.subsidyUsed, description: `Quỹ hỗ trợ buổi ${dateLabel} (${Math.max(1, employeeCount)} nhân viên)`, relatedSessionId: sessionId,
      });

      const guestIds = p.attendees.filter((id) => DEMO_PEOPLE.find((m) => m.id === id)?.person.membershipType === 'guest');
      for (const gid of guestIds) {
        const g = DEMO_PEOPLE.find((m) => m.id === gid)!;
        transactions.push({
          id: uuidv4(), date: new Date(year, month, Math.min(28, day.getDate() + 1)).toISOString(),
          type: 'income', category: 'member_payment', amount: 35000,
          description: `Thu tiền vãng lai ${g.person.name} buổi ${format(day, 'dd/MM/yyyy')}`,
          relatedMemberId: gid, relatedSessionId: sessionId,
        });
      }
    });

    return { members, sessions, transactions, shuttlecockBatches };
  }
}
