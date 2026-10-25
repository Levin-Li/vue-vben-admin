import { expect, test } from '@playwright/test';

import { loginViaCurrentPasswordChallenge } from './support/crud-acceptance';

test('移除通用模型目录，不展示选择表格或请求目录', async ({ page }) => {
  test.setTimeout(120_000);
  await loginViaCurrentPasswordChallenge(page, { timeout: 90_000 });
  const catalogRequests: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/api/DataModel/catalog')) {
      catalogRequests.push(request.url());
    }
  });
  await page.goto('/clob/V1/DataModelRecord', {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByRole('alert')).toContainText('通用模型目录入口已移除');
  await expect(page.getByRole('columnheader', { name: '模型标识' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '使用模型' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: '领域模型动态数据', exact: true })).toHaveCount(0);
  expect(catalogRequests).toEqual([]);
  expect(errors).toEqual([]);
});
