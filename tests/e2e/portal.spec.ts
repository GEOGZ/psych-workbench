import { test, expect } from '@playwright/test';
import { seedClientAndProject, seedPortalToken, cleanupE2EData } from './_setup';

test.describe('portal: readonly client view', () => {
  test.afterAll(async () => {
    await cleanupE2EData();
  });

  test('valid token shows project list without sensitive fields', async ({ page }) => {
    const { client } = await seedClientAndProject();
    const token = await seedPortalToken(client.id);

    await page.goto(`/portal/${token}`);

    await expect(page.getByText('E2E Test Project')).toBeVisible();
    await expect(page.getByText(/¥|金额|amount_total|amountTotal/i)).toHaveCount(0);
    await expect(page.getByText(/scope|notes|备注/i)).toHaveCount(0);
  });

  test('project detail shows state and date but not fee or crisis contact', async ({ page }) => {
    const { client, project } = await seedClientAndProject();
    const token = await seedPortalToken(client.id);

    await page.goto(`/portal/${token}/project/${project.id}`);

    await expect(page.getByText('线索')).toBeVisible();
    await expect(page.getByText(/金额|¥|amount/i)).toHaveCount(0);
    await expect(page.getByText(/危机联系|crisis/i)).toHaveCount(0);
    await expect(page.getByText(/范围|scope/i)).toHaveCount(0);
  });

  test('invalid token redirects to /portal/expired', async ({ page }) => {
    const badToken = 'dead' + '0'.repeat(60); // 64 chars, not in DB
    await page.goto(`/portal/${badToken}`);

    await expect(page).toHaveURL(/\/portal\/expired/);
    await expect(page.getByText(/链接已失效|过期/)).toBeVisible();
  });

  test('portal page has no workbench navigation', async ({ page }) => {
    const { client } = await seedClientAndProject();
    const token = await seedPortalToken(client.id);

    await page.goto(`/portal/${token}`);

    await expect(page.getByText('工作台')).toHaveCount(0);
  });
});
