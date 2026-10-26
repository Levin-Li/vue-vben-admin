import { expect, test } from '@playwright/test';

import { loginViaCurrentPasswordChallenge } from './support/crud-acceptance';

test('用户管理只使用标准 CRUD 查询面板和列表', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await loginViaCurrentPasswordChallenge(page, { timeout: 90_000 });
  const listResponse = page.waitForResponse((item) =>
    new URL(item.url()).pathname.endsWith('/api/User/list'),
  );
  await page.goto('/clob/V1/User', { waitUntil: 'domcontentloaded' });
  const response = await listResponse;
  expect(response.ok()).toBe(true);

  await expect(page.getByText('用户查询组织', { exact: true })).toHaveCount(0);
  await expect(
    page.getByText('当前默认组织，可选择一个已授权组织'),
  ).toBeVisible();
  await expect(
    page.getByText('所属组织', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText('登录名', { exact: true }).last()).toBeVisible();
  expect(errors).toEqual([]);
});
