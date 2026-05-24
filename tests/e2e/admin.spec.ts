import { test, expect } from '@playwright/test';
import { loginAs, seedClientAndProject, cleanupE2EData } from './_setup';

test.describe('admin: business access + ownerOnly guard', () => {
  test.afterAll(async () => {
    await cleanupE2EData();
  });

  test('admin can view client list', async ({ page, context }) => {
    await loginAs(context, 'admin');
    await page.goto('/clients');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('admin can view project list', async ({ page, context }) => {
    await loginAs(context, 'admin');
    await page.goto('/projects');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('admin can create a client', async ({ page, context }) => {
    await loginAs(context, 'admin');
    await page.goto('/clients/new');

    const inputs = page.locator('input');
    await inputs.nth(0).fill('E2E Admin Corp');
    await inputs.nth(1).fill('Admin Contact');
    await inputs.nth(4).fill('Admin Emergency');
    await inputs.nth(5).fill('+86-138-0000-0088');

    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/clients');
    await expect(page.getByText('E2E Admin Corp')).toBeVisible();
  });

  test('admin gets FORBIDDEN on ownerOnly endpoint (user management)', async ({
    request,
    context,
  }) => {
    await loginAs(context, 'admin');

    const cookies = await context.cookies();
    const cookie = cookies.find(c => c.name === 'next-auth.session-token');

    const res = await request.post('/api/trpc/users.list', {
      data: { json: {} },
      headers: { cookie: `next-auth.session-token=${cookie?.value}` },
    });

    const body = await res.json();
    const errorCode =
      body?.error?.data?.code ??
      body?.[0]?.error?.data?.code;

    expect(errorCode).toBe('FORBIDDEN');
  });

  test('admin can advance project state', async ({ page, context }) => {
    const admin = await loginAs(context, 'admin');
    const { project } = await seedClientAndProject(admin.id);

    await page.goto(`/projects/${project.id}`);
    await expect(page.getByText('线索')).toBeVisible();

    await page.getByRole('button', { name: '资格确认' }).click();
    await expect(page.getByText('资格确认')).toBeVisible();
  });

  test('admin cannot reach ownerOnly settings page', async ({ page, context }) => {
    await loginAs(context, 'admin');
    await page.goto('/settings');

    const url = page.url();
    const redirectedAway = !url.includes('/settings');
    const hasForbiddenText = await page.getByText(/forbidden|403|权限/i).isVisible().catch(() => false);

    expect(redirectedAway || hasForbiddenText).toBeTruthy();
  });
});
