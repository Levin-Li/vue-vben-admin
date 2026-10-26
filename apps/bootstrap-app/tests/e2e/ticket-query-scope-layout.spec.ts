import { expect, test } from '@playwright/test';

import { loginViaCurrentPasswordChallenge } from './support/crud-acceptance';

test('客服工单只在标准查询字段提示选择受理组织', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await loginViaCurrentPasswordChallenge(page, { timeout: 90_000 });
  await page.goto('/clob/V1/Ticket', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('业务范围', { exact: true })).toBeVisible();
  await expect(
    page.getByText('工单状态', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText('请选择受理组织后查询客服工单')).toHaveCount(0);
  expect(errors).toEqual([]);
});
