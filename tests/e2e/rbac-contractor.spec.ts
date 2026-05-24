import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { loginAs, seedClientAndProject, cleanupE2EData, testDb } from './_setup';
import { contractorGrants } from '../../src/db/schema';

test.describe('rbac: contractor field filtering and access control', () => {
  test.afterAll(async () => {
    await cleanupE2EData();
  });

  test('contractor without grant gets FORBIDDEN on clients.getById', async ({ request, context }) => {
    await loginAs(context, 'contractor');
    const { client } = await seedClientAndProject();

    const cookies = await context.cookies();
    const cookie = cookies.find(c => c.name === 'next-auth.session-token');

    const res = await request.post('/api/trpc/clients.getById', {
      data: { json: { clientId: client.id } },
      headers: { cookie: `next-auth.session-token=${cookie?.value}` },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('contractor with grant gets safe fields — no crisis contact or phone', async ({
    request,
    context,
  }) => {
    const contractor = await loginAs(context, 'contractor');
    const { client, project } = await seedClientAndProject();

    await testDb.insert(contractorGrants).values({
      userId: contractor.id,
      projectId: project.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const cookies = await context.cookies();
    const cookie = cookies.find(c => c.name === 'next-auth.session-token');

    const res = await request.post('/api/trpc/clients.getById', {
      data: { json: { clientId: client.id, projectId: project.id } },
      headers: { cookie: `next-auth.session-token=${cookie?.value}` },
    });

    const body = await res.json();
    const data = body?.result?.data?.json ?? body;

    expect(data).not.toHaveProperty('contactPhone');
    expect(data).not.toHaveProperty('crisisContactName');
    expect(data).not.toHaveProperty('crisisContactPhone');
    expect(data).not.toHaveProperty('notes');
    expect(data).toHaveProperty('name');

    await testDb.delete(contractorGrants).where(eq(contractorGrants.userId, contractor.id));
  });

  test('contractor cannot call portal.issueToken (adminOrOwner)', async ({ request, context }) => {
    await loginAs(context, 'contractor');
    const { client } = await seedClientAndProject();

    const cookies = await context.cookies();
    const cookie = cookies.find(c => c.name === 'next-auth.session-token');

    const res = await request.post('/api/trpc/portal.issueToken', {
      data: {
        json: {
          clientId: client.id,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      },
      headers: { cookie: `next-auth.session-token=${cookie?.value}` },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('projects list (adminOrOwner) returns error for contractor', async ({ request, context }) => {
    await loginAs(context, 'contractor');

    const cookies = await context.cookies();
    const cookie = cookies.find(c => c.name === 'next-auth.session-token');

    const res = await request.get('/api/trpc/projects.list', {
      headers: { cookie: `next-auth.session-token=${cookie?.value}` },
    });

    const body = await res.json();
    // tRPC returns error shape with code FORBIDDEN
    const errorCode =
      body?.error?.data?.code ??
      body?.[0]?.error?.data?.code;

    expect(errorCode).toBe('FORBIDDEN');
  });
});
