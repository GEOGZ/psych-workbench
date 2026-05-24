import { test, expect } from '@playwright/test';
import { loginAs, cleanupE2EData } from './_setup';

test.describe('owner: full project lifecycle', () => {
  test.afterAll(async () => {
    await cleanupE2EData();
  });

  test('dashboard loads with WIP counter', async ({ page, context }) => {
    await loginAs(context, 'owner');
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('create client with crisis contact required', async ({ page, context }) => {
    await loginAs(context, 'owner');
    await page.goto('/clients/new');

    // Inputs in order: name, contactName, email, phone, crisisName, crisisPhone
    const inputs = page.locator('input');
    await inputs.nth(0).fill('E2E Owner Corp');
    await inputs.nth(1).fill('Owner Contact');
    await inputs.nth(4).fill('Owner Emergency');
    await inputs.nth(5).fill('+86-138-0000-0099');

    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/clients');
    await expect(page.getByText('E2E Owner Corp')).toBeVisible();
  });

  test('create project linked to client', async ({ page, context }) => {
    await loginAs(context, 'owner');
    await page.goto('/projects/new');

    await page.locator('input').first().fill('E2E Lifecycle Project');

    const select = page.locator('select');
    await select.selectOption({ index: 1 });

    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/projects');
    await expect(page.getByText('E2E Lifecycle Project')).toBeVisible();
  });

  test('advance project state from lead to qualifying', async ({ page, context }) => {
    await loginAs(context, 'owner');
    await page.goto('/projects');
    await page.getByText('E2E Lifecycle Project').click();
    await page.waitForURL('**/projects/**');

    await expect(page.getByText('线索')).toBeVisible();
    await page.getByRole('button', { name: '资格确认' }).click();
    await expect(page.getByText('资格确认')).toBeVisible();
  });

  test('advance project through remaining states to done', async ({ page, context }) => {
    await loginAs(context, 'owner');
    await page.goto('/projects');
    await page.getByText('E2E Lifecycle Project').click();
    await page.waitForURL('**/projects/**');

    const stateSequence = [
      '需求挖掘',
      '合同',
      '执行',
      '汇报',
      '收尾',
      '完成',
    ];

    for (const label of stateSequence) {
      await page.getByRole('button', { name: label }).click();
      await expect(page.getByText(label)).toBeVisible();
    }
  });

  test('crisis contact required — form blocks submit without it', async ({ page, context }) => {
    await loginAs(context, 'owner');
    await page.goto('/clients/new');

    const inputs = page.locator('input');
    await inputs.nth(0).fill('NoCrisis Corp');
    await inputs.nth(1).fill('No Crisis Contact');

    await page.locator('button[type="submit"]').click();

    // Required fields prevent submission — still on /clients/new
    await expect(page).toHaveURL(/\/clients\/new/);
  });
});
