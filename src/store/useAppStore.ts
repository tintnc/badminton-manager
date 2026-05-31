import { create } from 'zustand';
import type { Member, Session, Transaction, AppState } from '../core/models/types';
import { LocalRepository } from '../core/repositories/LocalRepository';

const memberRepo = new LocalRepository<Member>('badminton_members');
const sessionRepo = new LocalRepository<Session>('badminton_sessions');
const transactionRepo = new LocalRepository<Transaction>('badminton_transactions');

interface StoreState extends AppState {
  initialize: () => Promise<void>;
  addMember: (member: Member) => Promise<void>;
  updateMember: (member: Member) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  addSession: (session: Session) => Promise<void>;
  updateSession: (session: Session) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  saveSessions: (sessions: Session[]) => Promise<void>;
  addTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransactionsBySession: (sessionId: string) => Promise<void>;
  deleteTransactionByMemberAndSession: (memberId: string, sessionId: string) => Promise<void>;
  updateSettings: (settings: Partial<AppState['settings']>) => void;
  setGlobalDate: (month: number, year: number) => void;
}

const defaultSettings = {
  monthlySupportFund: 3000000,
  defaultLocation: 'Sân cầu lông C30',
  defaultStartTime: '19:00',
  defaultEndTime: '21:00',
  shuttlecockTubePrice: 300000,
  shuttlecocksPerTube: 12,
};

export const useAppStore = create<StoreState>((set) => ({
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  members: [],
  sessions: [],
  transactions: [],
  settings: { ...defaultSettings },
  globalMonth: new Date().getMonth(),
  globalYear: new Date().getFullYear(),

  initialize: async () => {
    const [members, sessions, transactions] = await Promise.all([
      memberRepo.getAll(),
      sessionRepo.getAll(),
      transactionRepo.getAll(),
    ]);
    const settingsRaw = localStorage.getItem('badminton_settings');
    let settings = defaultSettings;
    if (settingsRaw) {
      try {
        const parsed = JSON.parse(settingsRaw);
        if (parsed && typeof parsed === 'object') {
          settings = { ...defaultSettings, ...parsed };
        }
      } catch {
        settings = defaultSettings;
      }
    }
    set({ members, sessions, transactions, settings });
  },

  addMember: async (member: Member) => {
    await memberRepo.save(member);
    set((state: StoreState) => ({ members: [...state.members, member] }));
  },

  updateMember: async (member: Member) => {
    await memberRepo.save(member);
    set((state: StoreState) => ({
      members: state.members.map((m: Member) => (m.id === member.id ? member : m)),
    }));
  },

  deleteMember: async (id: string) => {
    await memberRepo.delete(id);
    set((state: StoreState) => ({
      members: state.members.filter((m: Member) => m.id !== id),
    }));
  },

  addSession: async (session: Session) => {
    await sessionRepo.save(session);
    set((state: StoreState) => ({ sessions: [...state.sessions, session] }));
  },

  updateSession: async (session: Session) => {
    await sessionRepo.save(session);
    set((state: StoreState) => ({
      sessions: state.sessions.map((s: Session) => (s.id === session.id ? session : s)),
    }));
  },

  deleteSession: async (id: string) => {
    await sessionRepo.delete(id);
    set((state: StoreState) => ({
      sessions: state.sessions.filter((s: Session) => s.id !== id),
    }));
  },

  saveSessions: async (sessions: Session[]) => {
    await sessionRepo.saveAll(sessions);
    set((state: StoreState) => {
      const newSessions = [...state.sessions];
      sessions.forEach((newS: Session) => {
        const idx = newSessions.findIndex((s: Session) => s.id === newS.id);
        if(idx >= 0) newSessions[idx] = newS;
        else newSessions.push(newS);
      });
      return { sessions: newSessions };
    });
  },

  addTransaction: async (transaction: Transaction) => {
    await transactionRepo.save(transaction);
    set((state: StoreState) => ({ transactions: [...state.transactions, transaction] }));
  },

  deleteTransactionsBySession: async (sessionId: string) => {
    const all = await transactionRepo.getAll();
    const filtered = all.filter(t => t.relatedSessionId !== sessionId);
    await transactionRepo.saveAll(filtered);
    set({ transactions: filtered });
  },

  deleteTransactionByMemberAndSession: async (memberId: string, sessionId: string) => {
    const all = await transactionRepo.getAll();
    const filtered = all.filter(t => !(t.relatedMemberId === memberId && t.relatedSessionId === sessionId));
    await transactionRepo.saveAll(filtered);
    set({ transactions: filtered });
  },

  updateSettings: (newSettings: Partial<AppState['settings']>) => {
    set((state: StoreState) => {
      const updated = { ...state.settings, ...newSettings };
      localStorage.setItem('badminton_settings', JSON.stringify(updated));
      return { settings: updated };
    });
  },

  setGlobalDate: (month: number, year: number) => {
    set({ globalMonth: month, globalYear: year });
  },
}));
