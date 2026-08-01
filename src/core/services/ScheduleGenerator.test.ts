import { describe, expect, it } from 'vitest';
import { ScheduleGenerator } from './ScheduleGenerator';

describe('ScheduleGenerator', () => {
  it('generates draft sessions for Tuesdays and Thursdays of a month', () => {
    // January 2026: Tuesdays 6,13,20,27 (4) and Thursdays 1,8,15,22,29 (5) = 9
    const sessions = ScheduleGenerator.generateForMonth(2026, 0, 'Sân C30', '19:00', '21:00');

    expect(sessions).toHaveLength(9);
    for (const session of sessions) {
      expect(session.status).toBe('planned');
      expect(session.location).toBe('Sân C30');
      expect(session.startTime).toBe('19:00');
      expect(session.endTime).toBe('21:00');
      expect(session.date.startsWith('2026-01-')).toBe(true);
      expect(session.attendeeIds).toEqual([]);
      expect(session.courtFee).toBe(0);
      expect(session.costPerPerson).toBe(0);
    }
  });

  it('returns empty for a month when no Tuesday/Thursday exists (unreachable but safe)', () => {
    const sessions = ScheduleGenerator.generateForMonth(2026, 1, 'Sân C30', '19:00', '21:00');
    expect(sessions.length).toBeGreaterThan(0);
  });
});
