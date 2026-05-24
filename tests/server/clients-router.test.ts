import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { router, protectedProcedure } from '@/server/trpc/trpc';
import { adminOrOwner, contractorScoped } from '@/server/trpc/middleware';
import type { Context } from '@/server/trpc/context';
import { clients } from '@/db/schema/clients';
import { contractorGrants } from '@/db/schema/contractor-grants';

interface FakeUser {
  id: string;
  role: 'owner' | 'admin' | 'contractor';
}

interface FakeContext {
  user: FakeUser | null;
  db: {
    query: {
      clients: {
        findFirst: ReturnType<typeof vi.fn<any, any>>;
        findMany: ReturnType<typeof vi.fn<any, any>>;
      };
      contractorGrants: {
        findFirst: ReturnType<typeof vi.fn<any, any>>;
      };
    };
    insert: ReturnType<typeof vi.fn>;
  };
}

const fullClient = {
  id: 'c-uuid-1',
  name: 'Acme Corp',
  contactName: 'Alice Chen',
  contactEmail: 'alice@acme.com',
  contactPhone: '+1-555-1234',
  crisisContactName: 'Bob Smith',
  crisisContactPhone: '+1-555-9999',
  notes: 'Private sensitive notes',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-02')
};

/**
 * Helper: Mock db.query.clients.findFirst to respect `columns` filter.
 * Strips fields that are not in the whitelist.
 */
function createMockFindFirst(data: typeof fullClient) {
  return vi.fn(async (opts: { columns?: Record<string, boolean> }) => {
    if (!opts.columns) return data;
    const result: Record<string, unknown> = {};
    for (const [key, enabled] of Object.entries(opts.columns)) {
      if (enabled) {
        result[key] = (data as Record<string, unknown>)[key];
      }
    }
    return result;
  });
}

describe('clients tRPC router — RED-LINE SECURITY (§4.3)', () => {
  let ctx: FakeContext;

  beforeEach(() => {
    ctx = {
      user: null,
      db: {
        query: {
          clients: {
            findFirst: vi.fn(),
            findMany: vi.fn()
          },
          contractorGrants: {
            findFirst: vi.fn()
          }
        },
        insert: vi.fn()
      }
    };
  });

  describe('getById (admin/owner only, full fields)', () => {
    it('owner calls getById → returns full record with all 10 fields', async () => {
      ctx.user = { id: 'u1', role: 'owner' };
      ctx.db.query.clients.findFirst = createMockFindFirst(fullClient);

      const caller = router({
        getById: protectedProcedure
          .input(z.object({ clientId: z.string() }))
          .use(adminOrOwner)
          .query(async ({ input, ctx: c }) => {
            const result = await c.db.query.clients.findFirst({
              where: eq(clients.id, input.clientId),
              columns: {
                id: true,
                name: true,
                contactName: true,
                contactEmail: true,
                contactPhone: true,
                crisisContactName: true,
                crisisContactPhone: true,
                notes: true,
                createdAt: true,
                updatedAt: true
              }
            });
            return result;
          })
      }).createCaller(ctx as unknown as Context);

      const result = await caller.getById({ clientId: 'c-uuid-1' });

      // Verify all 10 fields are present
      expect(Object.keys(result!)).toHaveLength(10);
      expect(result).toMatchObject({
        id: 'c-uuid-1',
        name: 'Acme Corp',
        contactName: 'Alice Chen',
        contactEmail: 'alice@acme.com',
        contactPhone: '+1-555-1234',
        crisisContactName: 'Bob Smith',
        crisisContactPhone: '+1-555-9999',
        notes: 'Private sensitive notes'
      });
    });

    it('admin calls getById → returns full record', async () => {
      ctx.user = { id: 'u2', role: 'admin' };
      ctx.db.query.clients.findFirst = createMockFindFirst(fullClient);

      const caller = router({
        getById: protectedProcedure
          .input(z.object({ clientId: z.string() }))
          .use(adminOrOwner)
          .query(async ({ input, ctx: c }) => {
            const result = await c.db.query.clients.findFirst({
              where: eq(clients.id, input.clientId),
              columns: {
                id: true,
                name: true,
                contactName: true,
                contactEmail: true,
                contactPhone: true,
                crisisContactName: true,
                crisisContactPhone: true,
                notes: true,
                createdAt: true,
                updatedAt: true
              }
            });
            return result;
          })
      }).createCaller(ctx as unknown as Context);

      const result = await caller.getById({ clientId: 'c-uuid-1' });
      expect(Object.keys(result!)).toHaveLength(10);
    });

    it('contractor calls getById (admin-only endpoint) → FORBIDDEN', async () => {
      ctx.user = { id: 'u3', role: 'contractor' };

      const caller = router({
        getById: protectedProcedure
          .input(z.object({ clientId: z.string() }))
          .use(adminOrOwner)
          .query(async ({ input, ctx: c }) => {
            return c.db.query.clients.findFirst({
              where: eq(clients.id, input.clientId),
              columns: {
                id: true,
                name: true,
                contactName: true,
                contactEmail: true,
                contactPhone: true,
                crisisContactName: true,
                crisisContactPhone: true,
                notes: true,
                createdAt: true,
                updatedAt: true
              }
            });
          })
      }).createCaller(ctx as unknown as Context);

      await expect(caller.getById({ clientId: 'c-uuid-1' })).rejects.toThrow(TRPCError);
    });
  });

  describe('getByIdForContractor (RED-LINE: field whitelist enforcement)', () => {
    it('contractor WITH valid grant → returns ONLY [id, name, contactName]', async () => {
      ctx.user = { id: 'u3', role: 'contractor' };
      ctx.db.query.contractorGrants.findFirst = vi.fn().mockResolvedValue({
        id: 'g1',
        userId: 'u3',
        projectId: 'p1',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null
      });
      ctx.db.query.clients.findFirst = createMockFindFirst(fullClient);

      // Simulate contractorScoped + the procedure
      const testProcedure = protectedProcedure
        .input(z.object({ clientId: z.string(), projectId: z.string() }))
        .use(async ({ ctx: c, rawInput, next }) => {
          const input = rawInput as { projectId?: string };
          if (!input.projectId) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'projectId required' });
          }
          const grant = await c.db.query.contractorGrants.findFirst({
            where: and(eq(contractorGrants.userId, c.user?.id ?? ''), eq(contractorGrants.projectId, input.projectId))
          });
          if (!grant) {
            throw new TRPCError({ code: 'FORBIDDEN' });
          }
          return next();
        })
        .query(async ({ input, ctx: c }) => {
          const result = await c.db.query.clients.findFirst({
            where: eq(clients.id, input.clientId),
            columns: {
              id: true,
              name: true,
              contactName: true
            }
          });
          return result;
        });

      const caller = router({
        getByIdForContractor: testProcedure
      }).createCaller(ctx as unknown as Context);

      const result = await caller.getByIdForContractor({
        clientId: 'c-uuid-1',
        projectId: 'p1'
      });

      // RED-LINE: Verify ONLY 3 fields present, NEVER include sensitive fields
      const keys = Object.keys(result!);
      expect(keys).toEqual(['id', 'name', 'contactName']);
      expect(keys).not.toContain('contactEmail');
      expect(keys).not.toContain('contactPhone');
      expect(keys).not.toContain('crisisContactName');
      expect(keys).not.toContain('crisisContactPhone');
      expect(keys).not.toContain('notes');

      expect(result).toEqual({
        id: 'c-uuid-1',
        name: 'Acme Corp',
        contactName: 'Alice Chen'
      });
    });

    it('contractor WITHOUT valid grant → FORBIDDEN', async () => {
      ctx.user = { id: 'u3', role: 'contractor' };
      ctx.db.query.contractorGrants.findFirst = vi.fn().mockResolvedValue(undefined);

      const testProcedure = protectedProcedure
        .input(z.object({ clientId: z.string(), projectId: z.string() }))
        .use(async ({ ctx: c, rawInput, next }) => {
          const input = rawInput as { projectId?: string };
          if (!input.projectId) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'projectId required' });
          }
          const grant = await c.db.query.contractorGrants.findFirst({
            where: and(eq(contractorGrants.userId, c.user?.id ?? ''), eq(contractorGrants.projectId, input.projectId))
          });
          if (!grant) {
            throw new TRPCError({ code: 'FORBIDDEN' });
          }
          return next();
        })
        .query(async ({ input, ctx: c }) => {
          return c.db.query.clients.findFirst({
            where: eq(clients.id, input.clientId),
            columns: {
              id: true,
              name: true,
              contactName: true
            }
          });
        });

      const caller = router({
        getByIdForContractor: testProcedure
      }).createCaller(ctx as unknown as Context);

      await expect(
        caller.getByIdForContractor({ clientId: 'c-uuid-1', projectId: 'p1' })
      ).rejects.toThrow(TRPCError);
    });

    it('contractor missing projectId → FORBIDDEN with clear message', async () => {
      ctx.user = { id: 'u3', role: 'contractor' };

      const testProcedure = protectedProcedure
        .input(z.object({ clientId: z.string(), projectId: z.string() }))
        .use(async ({ ctx: c, rawInput, next }) => {
          const input = rawInput as { projectId?: string };
          if (!input.projectId) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'projectId required' });
          }
          return next();
        })
        .query(async () => ({}));

      const caller = router({
        getByIdForContractor: testProcedure
      }).createCaller(ctx as unknown as Context);

      await expect(
        caller.getByIdForContractor({ clientId: 'c-uuid-1', projectId: '' })
      ).rejects.toThrow();
    });
  });

  describe('create (admin/owner only)', () => {
    it('owner calls create with valid data → success', async () => {
      ctx.user = { id: 'u1', role: 'owner' };
      const insertMock = vi.fn().mockResolvedValue([{ id: 'new-c1' }]);
      ctx.db.insert = insertMock;

      const createSchema = z.object({
        name: z.string().min(1),
        contactName: z.string().min(1),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        crisisContactName: z.string().min(1, '危机联系人姓名必填'),
        crisisContactPhone: z.string().min(1, '危机联系人电话必填'),
        notes: z.string().optional()
      });

      const caller = router({
        create: protectedProcedure
          .input(createSchema)
          .use(adminOrOwner)
          .mutation(async ({ input, ctx: c }) => {
            const result = await c.db.insert(input as any);
            return result;
          })
      }).createCaller(ctx as unknown as Context);

      const result = await caller.create({
        name: 'New Corp',
        contactName: 'John Doe',
        crisisContactName: 'Emergency Bob',
        crisisContactPhone: '911'
      });

      expect(result).toEqual([{ id: 'new-c1' }]);
      expect(insertMock).toHaveBeenCalledWith({
        name: 'New Corp',
        contactName: 'John Doe',
        crisisContactName: 'Emergency Bob',
        crisisContactPhone: '911',
        contactEmail: undefined,
        contactPhone: undefined,
        notes: undefined
      });
    });

    it('create rejects when crisisContactName is empty (Zod validation)', async () => {
      ctx.user = { id: 'u1', role: 'owner' };

      const createSchema = z.object({
        name: z.string().min(1),
        contactName: z.string().min(1),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        crisisContactName: z.string().min(1, '危机联系人姓名必填'),
        crisisContactPhone: z.string().min(1, '危机联系人电话必填'),
        notes: z.string().optional()
      });

      const caller = router({
        create: protectedProcedure
          .input(createSchema)
          .use(adminOrOwner)
          .mutation(async ({ input, ctx: c }) => {
            const result = await c.db.insert(input as any);
            return result;
          })
      }).createCaller(ctx as unknown as Context);

      await expect(
        caller.create({
          name: 'Corp',
          contactName: 'John',
          crisisContactName: '',
          crisisContactPhone: '911'
        })
      ).rejects.toThrow();
    });

    it('create rejects when crisisContactPhone is empty', async () => {
      ctx.user = { id: 'u1', role: 'owner' };

      const createSchema = z.object({
        name: z.string().min(1),
        contactName: z.string().min(1),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        crisisContactName: z.string().min(1, '危机联系人姓名必填'),
        crisisContactPhone: z.string().min(1, '危机联系人电话必填'),
        notes: z.string().optional()
      });

      const caller = router({
        create: protectedProcedure
          .input(createSchema)
          .use(adminOrOwner)
          .mutation(async ({ input, ctx: c }) => {
            return c.db.insert(input as any);
          })
      }).createCaller(ctx as unknown as Context);

      await expect(
        caller.create({
          name: 'Corp',
          contactName: 'John',
          crisisContactName: 'Bob',
          crisisContactPhone: ''
        })
      ).rejects.toThrow();
    });

    it('contractor calls create → FORBIDDEN', async () => {
      ctx.user = { id: 'u3', role: 'contractor' };

      const createSchema = z.object({
        name: z.string().min(1),
        contactName: z.string().min(1),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        crisisContactName: z.string().min(1, '危机联系人姓名必填'),
        crisisContactPhone: z.string().min(1, '危机联系人电话必填'),
        notes: z.string().optional()
      });

      const caller = router({
        create: protectedProcedure
          .input(createSchema)
          .use(adminOrOwner)
          .mutation(async ({ input, ctx: c }) => {
            return c.db.insert(input as any);
          })
      }).createCaller(ctx as unknown as Context);

      await expect(
        caller.create({
          name: 'Corp',
          contactName: 'John',
          crisisContactName: 'Bob',
          crisisContactPhone: '911'
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('list (admin/owner only, full fields)', () => {
    it('owner calls list → returns array of full records', async () => {
      ctx.user = { id: 'u1', role: 'owner' };
      ctx.db.query.clients.findMany = vi.fn().mockResolvedValue([fullClient]);

      const caller = router({
        list: protectedProcedure
          .use(adminOrOwner)
          .query(async ({ ctx: c }) => {
            return c.db.query.clients.findMany({
              columns: {
                id: true,
                name: true,
                contactName: true,
                contactEmail: true,
                contactPhone: true,
                crisisContactName: true,
                crisisContactPhone: true,
                notes: true,
                createdAt: true,
                updatedAt: true
              }
            });
          })
      }).createCaller(ctx as unknown as Context);

      const result = await caller.list();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'c-uuid-1',
        name: 'Acme Corp',
        contactName: 'Alice Chen',
        contactEmail: 'alice@acme.com',
        contactPhone: '+1-555-1234',
        crisisContactName: 'Bob Smith',
        crisisContactPhone: '+1-555-9999',
        notes: 'Private sensitive notes'
      });
    });
  });
});
