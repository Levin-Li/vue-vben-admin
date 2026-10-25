import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { loginViaCurrentPasswordChallenge } from './support/crud-acceptance';

test('实体名页面使用公共CRUD查询和新增表单', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await loginViaCurrentPasswordChallenge(page, { timeout: 120_000 });
  // 通过现有客户端完成菜单解密；仅替换浏览器导航，模拟已迁移菜单，不写数据库。
  const serviceUrl = `/@fs${fileURLToPath(
    new URL(
      '../../../../packages/business/admin-framework/src/framework-commons/app/api/rbac-service.ts',
      import.meta.url,
    ),
  )}`;
  const menus = await page.evaluate(async (url) => {
    const { rbacService } = await import(url);
    return rbacService.getAuthorizedMenuList();
  }, serviceUrl);
  expect(Array.isArray(menus)).toBe(true);
  let migrated = false;
  function migrate(items: any[]) {
    for (const item of items) {
      if (item.path === '/clob/V1/DataModel') {
        item.path = '/clob/V1/DomainDataDynamicModel';
        item.label = '领域数据动态模型';
        item.viewPath =
          '/system/com_levin_oak_base/domain-data-dynamic-model/index.vue';
        migrated = true;
      }
      if (Array.isArray(item.children)) migrate(item.children);
    }
  }
  migrate(menus);
  if (!migrated)
    menus.push({
      id: 'entity-model-entry',
      label: '领域数据动态模型',
      path: '/clob/V1/DomainDataDynamicModel',
      pageType: 'LocalPage',
      actionType: 'TabPanel',
      viewPath:
        '/system/com_levin_oak_base/domain-data-dynamic-model/index.vue',
    });
  await page.route('**/rbac/authorizedMenuList**', async (route) => {
    await route.fulfill({ json: { code: 0, data: menus } });
  });
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.includes('/V1/api/')) requests.push(path);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  const queried = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith('/api/DataModel/queryModels'),
    { timeout: 20_000 },
  );
  await page.goto('/clob/V1/DomainDataDynamicModel', {
    waitUntil: 'domcontentloaded',
  });
  await expect(page).toHaveURL(/\/clob\/V1\/DomainDataDynamicModel$/);
  const response = await queried;
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(result.code).toBe(0);
  await expect(
    page.getByRole('columnheader', { name: '模型标识' }),
  ).toBeVisible();
  await testInfo.attach('page-api-requests', {
    body: JSON.stringify(requests),
    contentType: 'application/json',
  });
  console.log('PAGE_API_REQUESTS', JSON.stringify(requests));
  await page.getByRole('button', { name: '新增', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('领域数据动态模型');
  await expect(dialog).toContainText('模型标识');
  await expect(dialog).toContainText('归属范围');
  await dialog.getByRole('button', { name: /取\s*消|Cancel/ }).click();
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});
