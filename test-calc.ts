import { CostCalculator } from './src/core/services/CostCalculator';
import type { Member } from './src/core/models/types';

const attendees: Member[] = [
  { id: '1', name: 'A', joinDate: '2026-01-01', isActive: true, skillLevel: 2, debt: 0, membershipType: 'regular' },
  { id: '2', name: 'B', joinDate: '2026-01-01', isActive: true, skillLevel: 2, debt: 0, membershipType: 'regular' },
  { id: '3', name: 'C', joinDate: '2026-01-01', isActive: true, skillLevel: 2, debt: 0, membershipType: 'employee' },
  { id: '4', name: 'D', joinDate: '2026-01-01', isActive: true, skillLevel: 2, debt: 0, membershipType: 'employee' },
];

const res = CostCalculator.calculateDetailedSessionCost(0, 24000, attendees, 0);
console.log(res);
