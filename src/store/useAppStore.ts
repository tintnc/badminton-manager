import { create } from 'zustand';
import type { Member, Session, ShuttlecockBatch, Transaction, AppState } from '../core/models/types';
import { DataRepository, type AppData } from '../core/repositories/DataRepository';
import { APP_VERSION, defaultSettings } from '../core/config/defaults';
import { toast } from '../components/ui/toast';
import { DemoDataGenerator } from '../core/services/DemoDataGenerator';

const dataRepo = new DataRepository();

/** Debounce window (ms) before a batched write flushes to disk. */
const PERSIST_DEBOUNCE_MS = 300;

interface StoreState extends AppState {
  /** Set when the last batched persist failed; null when clean. */
  persistError?: string | null;
  initialize: () => Promise<void>;
  /** Forces any pending changes to be persisted now and awaits completion. */
  flush: () => Promise<void>;
  /** Replaces the workspace with fabricated demo data for the given month. */
  generateDemoData: (month: number, year: number) => Promise<void>;
  addMember: (member: Member) => Promise<void>;
  updateMember: (member: Member) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  addSession: (session: Session) => Promise<void>;
  updateSession: (session: Session) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  saveSessions: (sessions: Session[]) => Promise<void>;
  addShuttlecockBatch: (batch: ShuttlecockBatch) => Promise<void>;
  updateShuttlecockBatch: (batch: ShuttlecockBatch) => Promise<void>;
  deleteShuttlecockBatch: (id: string) => Promise<void>;
  saveShuttlecockBatches: (batches: ShuttlecockBatch[]) => Promise<void>;
  addTransaction: (transaction: Transaction) => Promise<void>;
  saveTransactions: (transactions: Transaction[]) => Promise<void>;
  deleteTransactionsBySession: (sessionId: string) => Promise<void>;
  deleteTransactionByMemberAndSession: (memberId: string, sessionId: string) => Promise<void>;
  updateSettings: (settings: Partial<AppState['settings']>) => Promise<void>;
  setGlobalDate: (month: number, year: number) => void;
}

function toAppData(state: StoreState): AppData {
  return {
    version: state.version,
    lastUpdated: new Date().toISOString(),
    members: state.members,
    sessions: state.sessions,
    transactions: state.transactions,
    shuttlecockBatches: state.shuttlecockBatches,
    settings: state.settings,
  };
}

export const useAppStore = create<StoreState>((set, get) => {
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  const doPersist = async () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    try {
      await dataRepo.save(toAppData(get()));
      set({ persistError: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không xác định.';
      set({ persistError: message });
      toast(`Không thể lưu dữ liệu: ${message}`, 'error');
    }
  };

  const schedulePersist = () => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      void doPersist();
    }, PERSIST_DEBOUNCE_MS);
  };

  const flush = async () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
      await doPersist();
    }
  };

  return {
    version: APP_VERSION,
    lastUpdated: new Date().toISOString(),
    members: [],
    sessions: [],
    transactions: [],
    shuttlecockBatches: [],
    settings: { ...defaultSettings },
    globalMonth: new Date().getMonth(),
    globalYear: new Date().getFullYear(),
    persistError: null,
    flush,

    initialize: async () => {
      const data = await dataRepo.load();
      set({
        version: data.version,
        lastUpdated: data.lastUpdated,
        members: data.members,
        sessions: data.sessions,
        transactions: data.transactions,
        shuttlecockBatches: data.shuttlecockBatches,
        settings: { ...defaultSettings, ...data.settings },
      });
    },

  addMember: async (member: Member) => {
    set((state: StoreState) => ({ members: [...state.members, member] }));
    schedulePersist();
  },

  updateMember: async (member: Member) => {
    set((state: StoreState) => ({
      members: state.members.map((m: Member) => (m.id === member.id ? member : m)),
    }));
    schedulePersist();
  },

  deleteMember: async (id: string) => {
    set((state: StoreState) => ({
      members: state.members.filter((m: Member) => m.id !== id),
    }));
    schedulePersist();
  },

  addSession: async (session: Session) => {
    set((state: StoreState) => ({ sessions: [...state.sessions, session] }));
    schedulePersist();
  },

  updateSession: async (session: Session) => {
    set((state: StoreState) => ({
      sessions: state.sessions.map((s: Session) => (s.id === session.id ? session : s)),
    }));
    schedulePersist();
  },

  deleteSession: async (id: string) => {
    set((state: StoreState) => ({
      sessions: state.sessions.filter((s: Session) => s.id !== id),
    }));
    schedulePersist();
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
    schedulePersist();
  },

  addShuttlecockBatch: async (batch: ShuttlecockBatch) => {
    set((state: StoreState) => ({ shuttlecockBatches: [...state.shuttlecockBatches, batch] }));
    schedulePersist();
  },

  updateShuttlecockBatch: async (batch: ShuttlecockBatch) => {
    set((state: StoreState) => ({
      shuttlecockBatches: state.shuttlecockBatches.map((item) => (item.id === batch.id ? batch : item)),
    }));
    schedulePersist();
  },

  deleteShuttlecockBatch: async (id: string) => {
    set((state: StoreState) => ({
      shuttlecockBatches: state.shuttlecockBatches.filter((batch) => batch.id !== id),
    }));
    schedulePersist();
  },

  saveShuttlecockBatches: async (batches: ShuttlecockBatch[]) => {
    set({ shuttlecockBatches: batches });
    schedulePersist();
  },

  addTransaction: async (transaction: Transaction) => {
    set((state: StoreState) => ({ transactions: [...state.transactions, transaction] }));
    schedulePersist();
  },

  saveTransactions: async (transactions: Transaction[]) => {
    set({ transactions });
    schedulePersist();
  },

  deleteTransactionsBySession: async (sessionId: string) => {
    set((state: StoreState) => ({
      transactions: state.transactions.filter(t => t.relatedSessionId !== sessionId),
    }));
    schedulePersist();
  },

  deleteTransactionByMemberAndSession: async (memberId: string, sessionId: string) => {
    set((state: StoreState) => ({
      transactions: state.transactions.filter(t => !(t.relatedMemberId === memberId && t.relatedSessionId === sessionId)),
    }));
    schedulePersist();
  },

  updateSettings: async (newSettings: Partial<AppState['settings']>) => {
    set((state: StoreState) => {
      const updated = { ...state.settings, ...newSettings };
      return { settings: updated };
    });
    schedulePersist();
  },

  setGlobalDate: (month: number, year: number) => {
    set({ globalMonth: month, globalYear: year });
  },
  generateDemoData: async (month: number, year: number) => {
    const demo = DemoDataGenerator.generate(year, month);
    set({
      version: APP_VERSION,
      lastUpdated: new Date().toISOString(),
      members: demo.members,
      sessions: demo.sessions,
      transactions: demo.transactions,
      shuttlecockBatches: demo.shuttlecockBatches,
      globalMonth: month,
      globalYear: year,
    });
    schedulePersist();
    toast(`Đã tạo dữ liệu demo cho tháng ${month + 1}/${year}.`);
  },
  };
});
