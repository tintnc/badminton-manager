import type { AppState } from '../models/types';

export const APP_VERSION = '1.0.0';

export const defaultSettings: AppState['settings'] = {
  monthlySupportFund: 3000000,
  defaultLocation: 'Sân cầu lông C30',
  defaultStartTime: '19:00',
  defaultEndTime: '21:00',
  shuttlecockTubePrice: 300000,
  shuttlecocksPerTube: 12,
  guestFee: 35000,
};

export function emptyData(): AppState {
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
  };
}
