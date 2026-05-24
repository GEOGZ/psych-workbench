import { describe, it, expect, vi, beforeEach } from 'vitest';
import { portalRouter } from '@/server/trpc/router/portal';
import { TRPCError } from '@trpc/server';

// ─── Fake DB builder ────────────────────────────────────────────────────────

const VALID_TOKEN = 'a'.repeat(64);
const FUTURE = new Date(Date.now() + 86_400_000); // +1 day
const PAST = new Date(Date.now() - 86_400_000);   // -1 day

type FakeTokenRow = {
  id: string;
  clientId: string;
  token: string;
  expiresAt: Date;
  revokedAt: Date | null;
  issuedAt: Date;
  issuedByUserId: string;
  lastUsedAt: Date | null;
};

type FakeProject = {
  id: string;
  clientId: string;
  name: string;
  state: string;
  updatedAt: Date;
};

function buildFakeDb(opts: {
  tokenRow?: FakeTokenRow | null;
  projects?: FakeProject[];
  clientExists?: boolean;
  insertTokenResult?: FakeTokenRow;
}) {
  const updateWhereFn = vi.fn().mockResolvedValue(undefined);
  const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
  const updateFn = vi.fn().mockReturnValue({ set: updateSetFn });

  const insertReturningFn = vi.fn().mockResolvedValue(
    opts.insertTokenResult ? [opts.insertTokenResult] : []
  );
  const insertValuesFn = vi.fn().mockReturnValue({ returning: insertReturningFn });
  const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });

  const db = {
    query: {
      clientPortalTokens: {
        findFirst: vi.fn().mockResolvedValue(opts.tokenRow ?? null),
        findMany: vi.fn().mockResolvedValue([])
      },
      projects: {
        findFirst: vi.fn().mockResolvedValue(opts.projects?.[0] ?? null),
        findMany: vi.fn().mockResolvedValue(opts.projects ?? [])
      },
      clients: {
        findFirst: vi.fn().mockResolvedValue(
          opts.clientExists !== false ? { id: 'client-1' } : null
        )
      }
    },
    update: updateFn,
    insert: insertFn,
    _updateSet: updateSetFn,
    _updateWhere: updateWhereFn,
    _insertValues: insertValuesFn,
    _insertReturning: insertReturningFn
  };

  return db;
}

function anonCtx(db: ReturnType<typeof buildFakeDb>) {
  return { db, user: null };
}

function ownerCtx(db: ReturnType<typeof buildFakeDb>) {
  return { db, user: { id: 'user-owner', role: 'owner' as const } };
}

const validTokenRow: FakeTokenRow = {
  id: 'tok-1',
  clientId: 'client-1',
  token: VALID_TOKEN,
  expiresAt: FUTURE,
  revokedAt: null,
  issuedAt: new Date(),
  issuedByUserId: 'user-owner',
  lastUsedAt: null
};

// ─── validate ────────────────────────────────────────────────────────────────

describe('portalRouter.validate', () => {
  it('returns clientId and expiresAt for valid token', async () => {
    const db = buildFakeDb({ tokenRow: validTokenRow });
    const result = await (portalRouter.validate as any)._def.resolver({
      ctx: anonCtx(db),
      input: { token: VALID_TOKEN }
    });
    expect(result.clientId).toBe('client-1');
    expect(result.expiresAt).toEqual(FUTURE);
  });

  it('throws UNAUTHORIZED for unknown token', async () => {
    const db = buildFakeDb({ tokenRow: null });
    await expect(
      (portalRouter.validate as any)._def.resolver({
        ctx: anonCtx(db),
        input: { token: VALID_TOKEN }
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED for expired token (findFirst returns null via DB filter)', async () => {
    // DB filter rejects expired tokens; findFirst returns null when token is expired
    const db = buildFakeDb({ tokenRow: null });
    await expect(
      (portalRouter.validate as any)._def.resolver({
        ctx: anonCtx(db),
        input: { token: VALID_TOKEN }
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('fires lastUsedAt update after validation', async () => {
    const db = buildFakeDb({ tokenRow: validTokenRow });
    await (portalRouter.validate as any)._def.resolver({
      ctx: anonCtx(db),
      input: { token: VALID_TOKEN }
    });
    // void update called — update fn was called
    expect(db.update).toHaveBeenCalled();
    expect(db._updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ lastUsedAt: expect.any(Date) })
    );
  });
});

// ─── listProjects ─────────────────────────────────────────────────────────────

describe('portalRouter.listProjects', () => {
  const fakeProjects: FakeProject[] = [
    { id: 'proj-1', clientId: 'client-1', name: 'Project A', state: 'execution', updatedAt: new Date() }
  ];

  it('returns client projects for valid token', async () => {
    const db = buildFakeDb({ tokenRow: validTokenRow, projects: fakeProjects });
    const result = await (portalRouter.listProjects as any)._def.resolver({
      ctx: anonCtx(db),
      input: { token: VALID_TOKEN }
    });
    expect(result).toEqual(fakeProjects);
    expect(db.query.projects.findMany).toHaveBeenCalledOnce();
  });

  it('throws UNAUTHORIZED if token is invalid', async () => {
    const db = buildFakeDb({ tokenRow: null });
    await expect(
      (portalRouter.listProjects as any)._def.resolver({
        ctx: anonCtx(db),
        input: { token: VALID_TOKEN }
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns empty array when client has no projects', async () => {
    const db = buildFakeDb({ tokenRow: validTokenRow, projects: [] });
    const result = await (portalRouter.listProjects as any)._def.resolver({
      ctx: anonCtx(db),
      input: { token: VALID_TOKEN }
    });
    expect(result).toEqual([]);
  });
});

// ─── getProject ───────────────────────────────────────────────────────────────

describe('portalRouter.getProject', () => {
  const fakeProject: FakeProject = {
    id: 'proj-1',
    clientId: 'client-1',
    name: 'Project A',
    state: 'execution',
    updatedAt: new Date()
  };

  it('returns project for valid token + matching clientId', async () => {
    const db = buildFakeDb({ tokenRow: validTokenRow, projects: [fakeProject] });
    const result = await (portalRouter.getProject as any)._def.resolver({
      ctx: anonCtx(db),
      input: { token: VALID_TOKEN, projectId: 'proj-1' }
    });
    expect(result).toEqual(fakeProject);
  });

  it('throws NOT_FOUND when project does not belong to token client', async () => {
    const db = buildFakeDb({ tokenRow: validTokenRow, projects: [] });
    db.query.projects.findFirst = vi.fn().mockResolvedValue(null);
    await expect(
      (portalRouter.getProject as any)._def.resolver({
        ctx: anonCtx(db),
        input: { token: VALID_TOKEN, projectId: 'proj-other' }
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws UNAUTHORIZED when token is invalid', async () => {
    const db = buildFakeDb({ tokenRow: null });
    await expect(
      (portalRouter.getProject as any)._def.resolver({
        ctx: anonCtx(db),
        input: { token: VALID_TOKEN, projectId: 'proj-1' }
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

// ─── issueToken ──────────────────────────────────────────────────────────────

describe('portalRouter.issueToken', () => {
  const insertedRow: FakeTokenRow = {
    id: 'tok-new',
    clientId: 'client-1',
    token: 'b'.repeat(64),
    expiresAt: FUTURE,
    revokedAt: null,
    issuedAt: new Date(),
    issuedByUserId: 'user-owner',
    lastUsedAt: null
  };

  it('creates and returns a new token', async () => {
    const db = buildFakeDb({ clientExists: true, insertTokenResult: insertedRow });
    const result = await (portalRouter.issueToken as any)._def.resolver({
      ctx: ownerCtx(db),
      input: { clientId: 'client-1', expiresAt: FUTURE.toISOString() }
    });
    expect(result).toEqual(insertedRow);
    expect(db.insert).toHaveBeenCalledOnce();
    expect(db._insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'client-1', issuedByUserId: 'user-owner' })
    );
  });

  it('throws NOT_FOUND when client does not exist', async () => {
    const db = buildFakeDb({ clientExists: false });
    await expect(
      (portalRouter.issueToken as any)._def.resolver({
        ctx: ownerCtx(db),
        input: { clientId: 'client-ghost', expiresAt: FUTURE.toISOString() }
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('generates a 64-char hex token', async () => {
    const db = buildFakeDb({ clientExists: true, insertTokenResult: insertedRow });
    await (portalRouter.issueToken as any)._def.resolver({
      ctx: ownerCtx(db),
      input: { clientId: 'client-1', expiresAt: FUTURE.toISOString() }
    });
    const callArg = db._insertValues.mock.calls[0][0];
    expect(callArg.token).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ─── revokeToken ─────────────────────────────────────────────────────────────

describe('portalRouter.revokeToken', () => {
  it('sets revokedAt and returns { ok: true }', async () => {
    const db = buildFakeDb({});
    const result = await (portalRouter.revokeToken as any)._def.resolver({
      ctx: ownerCtx(db),
      input: { tokenId: 'tok-1' }
    });
    expect(result).toEqual({ ok: true });
    expect(db.update).toHaveBeenCalledOnce();
    expect(db._updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ revokedAt: expect.any(Date) })
    );
  });
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe('portalRouter input validation', () => {
  it('rejects token shorter than 64 chars', () => {
    const schema = (portalRouter.validate as any)._def.inputs[0];
    const result = schema.safeParse({ token: 'a'.repeat(63) });
    expect(result.success).toBe(false);
  });

  it('rejects token longer than 64 chars', () => {
    const schema = (portalRouter.validate as any)._def.inputs[0];
    const result = schema.safeParse({ token: 'a'.repeat(65) });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 64-char token', () => {
    const schema = (portalRouter.validate as any)._def.inputs[0];
    const result = schema.safeParse({ token: 'a'.repeat(64) });
    expect(result.success).toBe(true);
  });
});
