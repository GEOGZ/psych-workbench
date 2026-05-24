import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hatLogRouter } from '@/server/trpc/router/hat-log';
import { TRPCError } from '@trpc/server';

// ─── Fake DB builder ────────────────────────────────────────────────────────

type FakeLog = { id: string; userId: string; hat: string; startAt: Date; endAt: Date | null };

function buildFakeDb(opts: {
  queryResult?: FakeLog | null;
  queryManyResult?: FakeLog[];
  insertResult?: FakeLog;
}) {
  const updateWhereFn = vi.fn().mockResolvedValue(undefined);
  const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
  const updateFn = vi.fn().mockReturnValue({ set: updateSetFn });

  const insertReturningFn = vi.fn().mockResolvedValue(opts.insertResult ? [opts.insertResult] : []);
  const insertValuesFn = vi.fn().mockReturnValue({ returning: insertReturningFn });
  const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });

  const tx = { update: updateFn, insert: insertFn };

  const db = {
    query: {
      hatLogs: {
        findFirst: vi.fn().mockResolvedValue(opts.queryResult ?? null),
        findMany: vi.fn().mockResolvedValue(opts.queryManyResult ?? [])
      }
    },
    update: updateFn,
    insert: insertFn,
    transaction: vi.fn().mockImplementation((fn: (tx: any) => Promise<unknown>) => fn(tx)),
    _tx: tx,
    _updateSet: updateSetFn,
    _updateWhere: updateWhereFn,
    _insertValues: insertValuesFn,
    _insertReturning: insertReturningFn
  };

  return db;
}

// ─── Caller helpers ─────────────────────────────────────────────────────────

function authedCtx(db: ReturnType<typeof buildFakeDb>) {
  return { db, user: { id: 'user-1', role: 'owner' as const } };
}

function anonCtx(db: ReturnType<typeof buildFakeDb>) {
  return { db, user: null };
}

async function callQuery(
  proc: unknown,
  ctx: ReturnType<typeof authedCtx> | ReturnType<typeof anonCtx>
) {
  // Direct call through the tRPC resolver
  return (hatLogRouter.current as any)._def.resolver({ ctx, input: undefined });
}

// ─── current ────────────────────────────────────────────────────────────────

describe('hatLogRouter.current', () => {
  it('returns the open hat log for the authed user', async () => {
    const log: FakeLog = { id: 'log-1', userId: 'user-1', hat: '🎩', startAt: new Date(), endAt: null };
    const db = buildFakeDb({ queryResult: log });
    const result = await (hatLogRouter.current as any)._def.resolver({ ctx: authedCtx(db), input: undefined });
    expect(result).toEqual(log);
    expect(db.query.hatLogs.findFirst).toHaveBeenCalledOnce();
  });

  it('returns null when no hat is worn', async () => {
    const db = buildFakeDb({ queryResult: null });
    const result = await (hatLogRouter.current as any)._def.resolver({ ctx: authedCtx(db), input: undefined });
    expect(result).toBeNull();
  });
});

// ─── forDate ────────────────────────────────────────────────────────────────

describe('hatLogRouter.forDate', () => {
  it('queries logs for the given date range', async () => {
    const logs: FakeLog[] = [
      { id: 'log-1', userId: 'user-1', hat: '🧠', startAt: new Date('2026-05-20T10:00:00Z'), endAt: new Date('2026-05-20T11:00:00Z') }
    ];
    const db = buildFakeDb({ queryManyResult: logs });
    const result = await (hatLogRouter.forDate as any)._def.resolver({
      ctx: authedCtx(db),
      input: { date: '2026-05-20' }
    });
    expect(result).toEqual(logs);
    expect(db.query.hatLogs.findMany).toHaveBeenCalledOnce();
  });

  it('returns empty array when no logs exist for the date', async () => {
    const db = buildFakeDb({ queryManyResult: [] });
    const result = await (hatLogRouter.forDate as any)._def.resolver({
      ctx: authedCtx(db),
      input: { date: '2026-05-20' }
    });
    expect(result).toEqual([]);
  });
});

// ─── switchHat ───────────────────────────────────────────────────────────────

describe('hatLogRouter.switchHat', () => {
  it('closes current hat and opens new one in a transaction', async () => {
    const newLog: FakeLog = { id: 'log-2', userId: 'user-1', hat: '🧠', startAt: new Date(), endAt: null };
    const db = buildFakeDb({ insertResult: newLog });

    const result = await (hatLogRouter.switchHat as any)._def.resolver({
      ctx: authedCtx(db),
      input: { hat: '🧠' as const }
    });

    // transaction was called
    expect(db.transaction).toHaveBeenCalledOnce();

    // update (close current hat) was called inside tx
    expect(db._tx.update).toHaveBeenCalledOnce();
    expect(db._updateSet).toHaveBeenCalledWith(expect.objectContaining({ endAt: expect.any(Date) }));

    // insert (open new hat) was called inside tx
    expect(db._tx.insert).toHaveBeenCalledOnce();
    expect(db._insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ hat: '🧠', userId: 'user-1', source: 'manual', endAt: null })
    );

    expect(result).toEqual(newLog);
  });

  it('passes projectId through to the insert when provided', async () => {
    const newLog: FakeLog = { id: 'log-3', userId: 'user-1', hat: '📊', startAt: new Date(), endAt: null };
    const db = buildFakeDb({ insertResult: newLog });

    await (hatLogRouter.switchHat as any)._def.resolver({
      ctx: authedCtx(db),
      input: { hat: '📊' as const, projectId: 'proj-abc' }
    });

    expect(db._insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj-abc' })
    );
  });

  it('sets projectId to null when not provided', async () => {
    const newLog: FakeLog = { id: 'log-4', userId: 'user-1', hat: '🛠', startAt: new Date(), endAt: null };
    const db = buildFakeDb({ insertResult: newLog });

    await (hatLogRouter.switchHat as any)._def.resolver({
      ctx: authedCtx(db),
      input: { hat: '🛠' as const }
    });

    expect(db._insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: null })
    );
  });
});

// ─── removeHat ───────────────────────────────────────────────────────────────

describe('hatLogRouter.removeHat', () => {
  it('closes open hat and returns { ok: true }', async () => {
    const db = buildFakeDb({});

    const result = await (hatLogRouter.removeHat as any)._def.resolver({
      ctx: authedCtx(db),
      input: undefined
    });

    expect(db.update).toHaveBeenCalledOnce();
    expect(db._updateSet).toHaveBeenCalledWith(expect.objectContaining({ endAt: expect.any(Date) }));
    expect(result).toEqual({ ok: true });
  });
});

// ─── backfill ────────────────────────────────────────────────────────────────

describe('hatLogRouter.backfill', () => {
  const validInput = {
    hat: '🎩' as const,
    startAt: '2026-05-20T09:00:00.000Z',
    endAt: '2026-05-20T10:00:00.000Z'
  };

  it('inserts a completed log with source=backfill', async () => {
    const inserted: FakeLog = {
      id: 'log-5',
      userId: 'user-1',
      hat: '🎩',
      startAt: new Date(validInput.startAt),
      endAt: new Date(validInput.endAt)
    };
    const db = buildFakeDb({ insertResult: inserted });

    const result = await (hatLogRouter.backfill as any)._def.resolver({
      ctx: authedCtx(db),
      input: validInput
    });

    expect(db.insert).toHaveBeenCalledOnce();
    expect(db._insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'backfill', userId: 'user-1' })
    );
    expect(result).toEqual(inserted);
  });

  it('rejects when endAt is before startAt', async () => {
    const db = buildFakeDb({});
    const parse = (hatLogRouter.backfill as any)._def.inputs[0];

    const result = parse.safeParse({
      hat: '🎩',
      startAt: '2026-05-20T10:00:00.000Z',
      endAt: '2026-05-20T09:00:00.000Z'
    });
    expect(result.success).toBe(false);
  });

  it('rejects when endAt equals startAt', async () => {
    const parse = (hatLogRouter.backfill as any)._def.inputs[0];

    const result = parse.safeParse({
      hat: '🎩',
      startAt: '2026-05-20T10:00:00.000Z',
      endAt: '2026-05-20T10:00:00.000Z'
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid past time block', () => {
    const parse = (hatLogRouter.backfill as any)._def.inputs[0];

    const result = parse.safeParse(validInput);
    expect(result.success).toBe(true);
  });
});
