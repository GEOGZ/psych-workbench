import { describe, it, expect, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { ownerOnly, adminOrOwner, contractorScoped } from '@/server/trpc/middleware';

interface FakeUser {
  id: string;
  role: 'owner' | 'admin' | 'contractor';
}

interface MwOpts {
  ctx: { user: FakeUser | null; db?: unknown };
  rawInput?: unknown;
  next: () => Promise<unknown>;
  type?: 'query' | 'mutation';
  path?: string;
  meta?: undefined;
  input?: unknown;
}

// tRPC v10 middleware objects expose the fn via `._middlewares[0]`
// Wrap in try/catch so synchronous throws become rejected promises (needed for `.rejects`)
function runMw(mw: { _middlewares: Array<(opts: any) => any> }, opts: MwOpts): Promise<unknown> {
  const fn = mw._middlewares[0];
  try {
    return Promise.resolve(fn!({
      path: '',
      type: 'query',
      meta: undefined,
      input: undefined,
      ...opts
    }));
  } catch (err) {
    return Promise.reject(err);
  }
}

const passThrough = async () => ({ ok: true } as unknown);

describe('ownerOnly', () => {
  it('passes through for owner', async () => {
    const ctx = { user: { id: 'u1', role: 'owner' } as FakeUser };
    const result = await runMw(ownerOnly, { ctx, next: passThrough });
    expect(result).toEqual({ ok: true });
  });

  it('throws FORBIDDEN for admin', async () => {
    const ctx = { user: { id: 'u1', role: 'admin' } as FakeUser };
    await expect(runMw(ownerOnly, { ctx, next: passThrough })).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });

  it('throws FORBIDDEN for contractor', async () => {
    const ctx = { user: { id: 'u1', role: 'contractor' } as FakeUser };
    await expect(runMw(ownerOnly, { ctx, next: passThrough })).rejects.toBeInstanceOf(TRPCError);
  });
});

describe('adminOrOwner', () => {
  it('passes for owner', async () => {
    const ctx = { user: { id: 'u1', role: 'owner' } as FakeUser };
    const result = await runMw(adminOrOwner, { ctx, next: passThrough });
    expect(result).toEqual({ ok: true });
  });

  it('passes for admin', async () => {
    const ctx = { user: { id: 'u1', role: 'admin' } as FakeUser };
    const result = await runMw(adminOrOwner, { ctx, next: passThrough });
    expect(result).toEqual({ ok: true });
  });

  it('throws FORBIDDEN for contractor', async () => {
    const ctx = { user: { id: 'u1', role: 'contractor' } as FakeUser };
    await expect(runMw(adminOrOwner, { ctx, next: passThrough })).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });
});

describe('contractorScoped — explicit projectId guard (red-line)', () => {
  it('FORBIDDEN when contractor calls with empty input', async () => {
    const findFirst = vi.fn();
    const ctx = {
      user: { id: 'u1', role: 'contractor' } as FakeUser,
      db: { query: { contractorGrants: { findFirst } } }
    };
    await expect(
      runMw(contractorScoped, { ctx, rawInput: {}, next: passThrough })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('FORBIDDEN when contractor calls with missing projectId field', async () => {
    const findFirst = vi.fn();
    const ctx = {
      user: { id: 'u1', role: 'contractor' } as FakeUser,
      db: { query: { contractorGrants: { findFirst } } }
    };
    await expect(
      runMw(contractorScoped, { ctx, rawInput: { other: 'x' }, next: passThrough })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('error message mentions projectId', async () => {
    const ctx = {
      user: { id: 'u1', role: 'contractor' } as FakeUser,
      db: { query: { contractorGrants: { findFirst: vi.fn() } } }
    };
    try {
      await runMw(contractorScoped, { ctx, rawInput: {}, next: passThrough });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).message).toMatch(/projectId/i);
    }
  });
});

describe('contractorScoped — grant lookup', () => {
  it('FORBIDDEN when no grant exists', async () => {
    const findFirst = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      user: { id: 'u1', role: 'contractor' } as FakeUser,
      db: { query: { contractorGrants: { findFirst } } }
    };
    await expect(
      runMw(contractorScoped, { ctx, rawInput: { projectId: 'p1' }, next: passThrough })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(findFirst).toHaveBeenCalledOnce();
  });

  it('passes when contractor has valid grant', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'g1', userId: 'u1', projectId: 'p1' });
    const ctx = {
      user: { id: 'u1', role: 'contractor' } as FakeUser,
      db: { query: { contractorGrants: { findFirst } } }
    };
    const result = await runMw(contractorScoped, {
      ctx,
      rawInput: { projectId: 'p1' },
      next: passThrough
    });
    expect(result).toEqual({ ok: true });
  });
});

describe('contractorScoped — owner/admin bypass', () => {
  it('owner passes without projectId or grant lookup', async () => {
    const findFirst = vi.fn();
    const ctx = {
      user: { id: 'u1', role: 'owner' } as FakeUser,
      db: { query: { contractorGrants: { findFirst } } }
    };
    const result = await runMw(contractorScoped, { ctx, rawInput: {}, next: passThrough });
    expect(result).toEqual({ ok: true });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('admin passes without projectId or grant lookup', async () => {
    const findFirst = vi.fn();
    const ctx = {
      user: { id: 'u1', role: 'admin' } as FakeUser,
      db: { query: { contractorGrants: { findFirst } } }
    };
    const result = await runMw(contractorScoped, { ctx, rawInput: {}, next: passThrough });
    expect(result).toEqual({ ok: true });
    expect(findFirst).not.toHaveBeenCalled();
  });
});
