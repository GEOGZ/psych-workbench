import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transitions } from '@/server/state/transitions';
import { advanceProject } from '@/server/state/advance';
import type { ProjectState } from '@/db/schema/projects';

// ─── transitions table (pure data, no DB needed) ──────────────────────────

describe('transitions table — legal paths', () => {
  const legalCases: [ProjectState, ProjectState][] = [
    ['lead', 'qualifying'],
    ['lead', 'done'],
    ['qualifying', 'discovery'],
    ['qualifying', 'done'],
    ['discovery', 'contract'],
    ['discovery', 'done'],
    ['contract', 'execution'],
    ['contract', 'done'],
    ['execution', 'reporting'],
    ['reporting', 'closing'],
    ['closing', 'done'],
  ];

  it.each(legalCases)('%s → %s is allowed', (from, to) => {
    expect(transitions[from]).toContain(to);
  });
});

describe('transitions table — illegal paths (representative)', () => {
  const illegalCases: [ProjectState, ProjectState][] = [
    ['lead', 'execution'],    // skip multiple stages
    ['execution', 'done'],    // must go through reporting (red-line: no skipping delivery)
    ['execution', 'lead'],    // no backward moves
    ['done', 'lead'],         // terminal state
    ['done', 'qualifying'],   // terminal state
    ['reporting', 'execution'], // no backward
  ];

  it.each(illegalCases)('%s → %s is NOT allowed', (from, to) => {
    expect(transitions[from]).not.toContain(to);
  });
});

describe('transitions table — done is terminal', () => {
  it('done has no outgoing transitions', () => {
    expect(transitions['done']).toHaveLength(0);
  });
});

// ─── advanceProject (unit, mocked DB) ─────────────────────────────────────

function buildFakeDb(projectRow: { id: string; state: ProjectState } | null) {
  const whereFn = vi.fn();
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  const updateFn = vi.fn().mockReturnValue({ set: setFn });
  const valuesFn = vi.fn();
  const insertFn = vi.fn().mockReturnValue({ values: valuesFn });

  const tx = {
    execute: vi.fn().mockResolvedValue({ rows: projectRow ? [projectRow] : [] }),
    update: updateFn,
    insert: insertFn,
  };

  return {
    transaction: (fn: (tx: any) => Promise<unknown>) => fn(tx),
    _tx: tx,
  };
}

vi.mock('@/db', () => ({
  db: null // replaced per test via (dbModule as any).db = fakeDb
}));

import * as dbModule from '@/db';

describe('advanceProject — legal transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lead → qualifying succeeds and returns fromState/toState', async () => {
    const fakeDb = buildFakeDb({ id: 'proj-1', state: 'lead' });
    (dbModule as unknown as { db: unknown }).db = fakeDb;

    const result = await advanceProject('proj-1', 'qualifying', 'user-1');
    expect(result.fromState).toBe('lead');
    expect(result.toState).toBe('qualifying');
    expect(result.projectId).toBe('proj-1');
  });

  it('execution → reporting succeeds', async () => {
    const fakeDb = buildFakeDb({ id: 'proj-2', state: 'execution' });
    (dbModule as unknown as { db: unknown }).db = fakeDb;

    const result = await advanceProject('proj-2', 'reporting', 'user-1');
    expect(result.fromState).toBe('execution');
    expect(result.toState).toBe('reporting');
  });

  it('qualifying → done succeeds (early close)', async () => {
    const fakeDb = buildFakeDb({ id: 'proj-3', state: 'qualifying' });
    (dbModule as unknown as { db: unknown }).db = fakeDb;

    const result = await advanceProject('proj-3', 'done', 'user-1');
    expect(result.toState).toBe('done');
  });
});

describe('advanceProject — illegal transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('execution → done throws BAD_REQUEST (must go through reporting)', async () => {
    const fakeDb = buildFakeDb({ id: 'proj-4', state: 'execution' });
    (dbModule as unknown as { db: unknown }).db = fakeDb;

    await expect(
      advanceProject('proj-4', 'done', 'user-1')
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('lead → execution throws BAD_REQUEST (skipping stages)', async () => {
    const fakeDb = buildFakeDb({ id: 'proj-5', state: 'lead' });
    (dbModule as unknown as { db: unknown }).db = fakeDb;

    await expect(
      advanceProject('proj-5', 'execution', 'user-1')
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('error message contains both from and to state names', async () => {
    const fakeDb = buildFakeDb({ id: 'proj-6', state: 'execution' });
    (dbModule as unknown as { db: unknown }).db = fakeDb;

    try {
      await advanceProject('proj-6', 'done', 'user-1');
      throw new Error('should have thrown');
    } catch (err: unknown) {
      const trpcErr = err as { message?: string };
      expect(trpcErr.message).toMatch(/execution/);
      expect(trpcErr.message).toMatch(/done/);
    }
  });
});

describe('advanceProject — NOT_FOUND', () => {
  it('throws NOT_FOUND when project does not exist', async () => {
    const fakeDb = buildFakeDb(null);
    (dbModule as unknown as { db: unknown }).db = fakeDb;

    await expect(
      advanceProject('no-such-id', 'qualifying', 'user-1')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
