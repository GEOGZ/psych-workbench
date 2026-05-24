import { test, expect } from '@playwright/test';
import { loginAs } from './_setup';

test.describe('hat: switch, remove, backfill', () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, 'owner');
  });

  test('dashboard shows hat widget', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('🎩')).toBeVisible();
    await expect(page.getByText('🧠')).toBeVisible();
    await expect(page.getByText('🛠')).toBeVisible();
    await expect(page.getByText('📊')).toBeVisible();
  });

  test('switch hat to 🎩 then to 🧠', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: '🎩' }).click();
    await expect(page.getByText('统筹')).toBeVisible();

    await page.getByRole('button', { name: '🧠' }).click();
    await expect(page.getByText('深度工作')).toBeVisible();
  });

  test('remove hat clears current hat label', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: '🛠' }).click();
    await expect(page.getByText('执行')).toBeVisible();

    await page.getByRole('button', { name: '摘下帽子' }).click();
    await expect(page.getByText('执行')).not.toBeVisible();
  });

  test('open backfill form and submit valid entry', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: '事后补记' }).click();
    await expect(page.locator('input[type="datetime-local"]').first()).toBeVisible();

    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 16);
    const start = fmt(new Date(now.getTime() - 60 * 60 * 1000));
    const end = fmt(new Date(now.getTime() - 30 * 60 * 1000));

    const dateInputs = page.locator('input[type="datetime-local"]');
    await dateInputs.nth(0).fill(start);
    await dateInputs.nth(1).fill(end);
    await page.getByRole('button', { name: '记录' }).click();

    await expect(page.getByText(/冲突/)).not.toBeVisible();
  });

  test('backfill shows conflict error on overlapping range', async ({ page }) => {
    await page.goto('/');

    // Submit a backfill for a fixed past window
    await page.getByRole('button', { name: '事后补记' }).click();
    const dateInputs = page.locator('input[type="datetime-local"]');
    await dateInputs.nth(0).fill('2020-01-01T10:00');
    await dateInputs.nth(1).fill('2020-01-01T11:00');
    await page.getByRole('button', { name: '记录' }).click();

    // Submit the same window again — triggers overlap conflict
    await page.getByRole('button', { name: '事后补记' }).click();
    await dateInputs.nth(0).fill('2020-01-01T10:00');
    await dateInputs.nth(1).fill('2020-01-01T11:00');
    await page.getByRole('button', { name: '记录' }).click();

    await expect(page.getByText(/冲突/)).toBeVisible();
  });
});
