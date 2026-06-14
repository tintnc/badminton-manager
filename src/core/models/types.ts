export interface Member {
  id: string; // UUID
  name: string;
  nickname?: string;
  phone?: string;
  joinDate: string; // ISO Date
  isActive: boolean;
  skillLevel: number; // 1 (yếu) to 4 (mạnh)
  debt: number; // Current unpaid amount
  notes?: string;
  membershipType?: 'employee' | 'guest' | 'regular'; // 'employee': Nhân viên công ty, 'guest': Vãng lai, 'regular': Thành viên thường
  prepaidBalance?: number; // Số dư quỹ nạp trước (áp dụng cho thành viên thường)
  paidSessionIds?: string[]; // Danh sách các ID buổi chơi đã thanh toán (áp dụng cho khách vãng lai)
}

export interface Session {
  id: string; // UUID
  date: string; // ISO Date
  startTime: string; // "19:00"
  endTime: string; // "21:00"
  location: string; // "Sân cầu lông C30"
  status: 'planned' | 'completed' | 'cancelled';
  courtFee: number;
  shuttlecocksUsed: number; // Number of shuttlecocks used this session
  shuttlecockFee: number;   // Calculated: shuttlecocksUsed * pricePerShuttlecock
  shuttlecockUsages?: ShuttlecockBatchUsage[]; // Inventory lots consumed for this session
  fundSubsidyUsed: number; // Amount of support fund used for this session
  totalCost: number;
  attendeeIds: string[]; // Array of Member IDs
  guestCount: number; // Number of non-registered guests
  costPerPerson: number; // Calculated field (after subsidy)
  costPerPersonNoSubsidy: number; // Cost per person WITHOUT fund subsidy (for stats)
  notes?: string;
}

export interface Transaction {
  id: string; // UUID
  date: string; // ISO Date
  type: 'income' | 'expense';
  category: 'support_fund' | 'member_payment' | 'court_fee' | 'shuttlecock_fee' | 'shuttlecock_purchase' | 'other';
  amount: number;
  description: string;
  relatedMemberId?: string;
  relatedSessionId?: string;
  relatedShuttlecockBatchId?: string;
}

export interface ShuttlecockBatch {
  id: string; // UUID
  purchaseDate: string; // ISO Date
  tubes: number;
  shuttlecocksPerTube: number;
  totalShuttlecocks: number;
  remainingShuttlecocks: number;
  totalCost: number;
  unitCost: number;
  notes?: string;
}

export interface ShuttlecockBatchUsage {
  batchId: string;
  quantity: number;
  unitCost: number;
  amount: number;
}

export interface AppState {
  version: string;
  lastUpdated: string;
  members: Member[];
  sessions: Session[];
  transactions: Transaction[];
  shuttlecockBatches: ShuttlecockBatch[];
  settings: {
    monthlySupportFund: number; // Default 3000000
    defaultLocation: string;
    defaultStartTime: string;
    defaultEndTime: string;
    shuttlecockTubePrice: number;  // Price per tube e.g. 300000
    shuttlecocksPerTube: number;   // Shuttlecocks per tube e.g. 12
  };
  globalMonth: number; // 0-indexed month (0 = January)
  globalYear: number;
}
