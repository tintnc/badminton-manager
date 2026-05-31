import type { AppState, Member, Session, Transaction } from '../models/types';

export interface AppData {
  version: string;
  lastUpdated: string;
  members: Member[];
  sessions: Session[];
  transactions: Transaction[];
  settings: AppState['settings'];
}

const defaultSettings: AppState['settings'] = {
  monthlySupportFund: 3000000,
  defaultLocation: 'Sân cầu lông C30',
  defaultStartTime: '19:00',
  defaultEndTime: '21:00',
  shuttlecockTubePrice: 300000,
  shuttlecocksPerTube: 12,
};

const emptyData = (): AppData => ({
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  members: [],
  sessions: [],
  transactions: [],
  settings: { ...defaultSettings },
});

function normalizeData(data: Partial<AppData> | null | undefined): AppData {
  return {
    ...emptyData(),
    ...data,
    members: Array.isArray(data?.members) ? data.members : [],
    sessions: Array.isArray(data?.sessions) ? data.sessions : [],
    transactions: Array.isArray(data?.transactions) ? data.transactions : [],
    settings: { ...defaultSettings, ...(data?.settings ?? {}) },
  };
}

function readJsonFromLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readLegacyRosterData(): Pick<AppData, 'members' | 'transactions' | 'settings'> | null {
  const members = readJsonFromLocalStorage<Member[]>('badminton_members', []);
  const transactions = readJsonFromLocalStorage<Transaction[]>('badminton_transactions', []);
  const settings = readJsonFromLocalStorage<Partial<AppData['settings']> | null>('badminton_settings', null);

  if (!Array.isArray(members) || members.length === 0) return null;

  return {
    members: members.map((member) => {
      const membershipType = member.membershipType ?? 'regular';
      return {
        ...member,
        membershipType,
        debt: 0,
        paidSessionIds: [],
        prepaidBalance: membershipType === 'regular' ? (member.prepaidBalance ?? 0) : 0,
      };
    }),
    transactions: Array.isArray(transactions)
      ? transactions.filter((transaction) =>
          transaction.type === 'income'
          && transaction.category === 'member_payment'
          && Boolean(transaction.relatedMemberId)
          && !transaction.relatedSessionId
        )
      : [],
    settings: { ...defaultSettings, ...(settings ?? {}) },
  };
}

function restoreLegacyRosterIfEmpty(fileData: AppData): AppData {
  if (fileData.members.length > 0 || fileData.sessions.length > 0 || fileData.transactions.length > 0) {
    return fileData;
  }

  const legacy = readLegacyRosterData();
  if (!legacy) return fileData;

  return {
    ...fileData,
    lastUpdated: new Date().toISOString(),
    members: legacy.members,
    transactions: legacy.transactions,
    settings: legacy.settings,
  };
}

async function readFileData(): Promise<AppData | null> {
  try {
    const response = await fetch('/api/data', { cache: 'no-store' });
    if (!response.ok) return null;
    return normalizeData(await response.json());
  } catch {
    return null;
  }
}

async function writeFileData(data: AppData): Promise<boolean> {
  try {
    const response = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, lastUpdated: new Date().toISOString() }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export class DataRepository {
  async load(): Promise<AppData> {
    const data = restoreLegacyRosterIfEmpty(normalizeData(await readFileData()));
    if (data.members.length > 0) {
      await this.save(data);
    }
    return data;
  }

  async save(data: AppData): Promise<void> {
    const savedToFile = await writeFileData(data);
    if (!savedToFile) {
      throw new Error('Không thể ghi dữ liệu vào data/badminton-data.json');
    }
  }
}
