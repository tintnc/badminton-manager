import { create } from 'zustand';
import type { Member, Session, Transaction, AppState } from '../core/models/types';
import { DataRepository, type AppData } from '../core/repositories/DataRepository';

const dataRepo = new DataRepository();

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
  updateSettings: (settings: Partial<AppState['settings']>) => Promise<void>;
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

function toAppData(state: StoreState): AppData {
  return {
    version: state.version,
    lastUpdated: new Date().toISOString(),
    members: state.members,
    sessions: state.sessions,
    transactions: state.transactions,
    settings: state.settings,
  };
}

export const useAppStore = create<StoreState>((set, get) => ({
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  members: [],
  sessions: [],
  transactions: [],
  settings: { ...defaultSettings },
  globalMonth: new Date().getMonth(),
  globalYear: new Date().getFullYear(),

  initialize: async () => {
    const data = await dataRepo.load();
    set({
      version: data.version,
      lastUpdated: data.lastUpdated,
      members: data.members,
      sessions: data.sessions,
      transactions: data.transactions,
      settings: { ...defaultSettings, ...data.settings },
    });
  },

  addMember: async (member: Member) => {
    set((state: StoreState) => ({ members: [...state.members, member] }));
    await dataRepo.save(toAppData(get()));
  },

  updateMember: async (member: Member) => {
    set((state: StoreState) => ({
      members: state.members.map((m: Member) => (m.id === member.id ? member : m)),
    }));
    await dataRepo.save(toAppData(get()));
  },

  deleteMember: async (id: string) => {
    set((state: StoreState) => ({
      members: state.members.filter((m: Member) => m.id !== id),
    }));
    await dataRepo.save(toAppData(get()));
  },

  addSession: async (session: Session) => {
    set((state: StoreState) => ({ sessions: [...state.sessions, session] }));
    await dataRepo.save(toAppData(get()));
  },

  updateSession: async (session: Session) => {
    set((state: StoreState) => ({
      sessions: state.sessions.map((s: Session) => (s.id === session.id ? session : s)),
    }));
    await dataRepo.save(toAppData(get()));
  },

  deleteSession: async (id: string) => {
    set((state: StoreState) => ({
      sessions: state.sessions.filter((s: Session) => s.id !== id),
    }));
    await dataRepo.save(toAppData(get()));
  },

  saveSessions: async (sessions: Session[]) => {
    set((state: StoreState) => {
      const newSessions = [...state.sessions];
      sessions.forEach((newS: Session) => {
        const idx = newSessions.findIndex((s: Session) => s.id === newS.id);
        if(idx >= 0) newSessions[idx] = newS;
        else newSessions.push(newS);
      });
      return { sessions: newSessions };
    });
    await dataRepo.save(toAppData(get()));
  },

  addTransaction: async (transaction: Transaction) => {
    set((state: StoreState) => ({ transactions: [...state.transactions, transaction] }));
    await dataRepo.save(toAppData(get()));
  },

  deleteTransactionsBySession: async (sessionId: string) => {
    set((state: StoreState) => ({
      transactions: state.transactions.filter(t => t.relatedSessionId !== sessionId),
    }));
    await dataRepo.save(toAppData(get()));
  },

  deleteTransactionByMemberAndSession: async (memberId: string, sessionId: string) => {
    set((state: StoreState) => ({
      transactions: state.transactions.filter(t => !(t.relatedMemberId === memberId && t.relatedSessionId === sessionId)),
    }));
    await dataRepo.save(toAppData(get()));
  },

  updateSettings: async (newSettings: Partial<AppState['settings']>) => {
    set((state: StoreState) => {
      const updated = { ...state.settings, ...newSettings };
      return { settings: updated };
    });
    await dataRepo.save(toAppData(get()));
  },

  setGlobalDate: (month: number, year: number) => {
    set({ globalMonth: month, globalYear: year });
  },
}));
