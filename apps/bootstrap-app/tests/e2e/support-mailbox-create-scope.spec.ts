import { expect, test } from '@playwright/test';

import { loginViaCurrentPasswordChallenge } from './support/crud-acceptance';

test('支持邮箱可先打开创建弹窗再选择受理组织', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await loginViaCurrentPasswordChallenge(page, { timeout: 90_000 });
  await page.goto('/clob/V1/SupportMailboxRule', {
    waitUntil: 'domcontentloaded',
  });

  const create = page.getByRole('button', { name: '创建受理邮箱' });
  await expect(create).toBeEnabled();
  await create.click();
  const dialog = page.getByRole('dialog', { name: '创建受理邮箱' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('受理组织', { exact: true })).toBeVisible();
  await expect(dialog.getByText('支持邮箱地址', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
