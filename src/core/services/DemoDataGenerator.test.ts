import { describe, expect, it } from 'vitest';
import { DemoDataGenerator } from './DemoDataGenerator';

describe('DemoDataGenerator', () => {
  it('produces a self-consistent dataset for the given month', () => {
    const data = DemoDataGenerator.generate(2026, 6); // July (0-indexed)

    expect(data.members.length).toBeGreaterThan(0);

    const memberIds = new Set(data.members.map((m) => m.id));
    const sessionIds = new Set(data.sessions.map((s) => s.id));
    const batchIds = new Set(data.shuttlecockBatches.map((b) => b.id));

    // Every session/finance reference must resolve to a real entity.
    for (const s of data.sessions) {
      for (const id of s.attendeeIds) expect(memberIds.has(id)).toBe(true);
      for (const u of s.shuttlecockUsages ?? []) expect(batchIds.has(u.batchId)).toBe(true);
    }
    for (const t of data.transactions) {
      if (t.relatedMemberId) expect(memberIds.has(t.relatedMemberId)).toBe(true);
      if (t.relatedSessionId) expect(sessionIds.has(t.relatedSessionId)).toBe(true);
      if (t.relatedShuttlecockBatchId) expect(batchIds.has(t.relatedShuttlecockBatchId)).toBe(true);
    }

    // July has Tuesdays & Thursdays — expect some sessions.
    expect(data.sessions.length).toBeGreaterThan(0);
    // At least one completed + one planned for a fuller demo.
    expect(data.sessions.some((s) => s.status === 'completed')).toBe(true);
    expect(data.sessions.some((s) => s.status === 'planned')).toBe(true);
  });

  it('generates sessions only within the requested month', () => {
    const data = DemoDataGenerator.generate(2026, 0); // January
    for (const s of data.sessions) {
      const d = new Date(`${s.date}T00:00:00`);
      expect(d.getMonth()).toBe(0);
      expect(d.getFullYear()).toBe(2026);
    }
  });

  it('keeps guests debt-free in a way the UI can read', () => {
    const data = DemoDataGenerator.generate(2026, 6);
    const guest = data.members.find((m) => m.membershipType === 'guest');
    expect(guest).toBeDefined();
    expect(Array.isArray(guest?.paidSessionIds)).toBe(true);
  });
});
