import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import {
  isCrudAcceptanceEnabled,
  loginViaCurrentPasswordChallenge,
} from './support/crud-acceptance';

function databaseRows(name: string): any[] {
  const script = fileURLToPath(
    new URL(
      '../../../../../../scripts/crud-acceptance/mail-relay-db-check.py',
      import.meta.url,
    ),
  );
  return JSON.parse(
    execFileSync('python3', [script, '--name', name], { encoding: 'utf8' }),
  );
}

test('邮件中转普通导航的只读请求审计', async ({ page, baseURL }, testInfo) => {
  test.setTimeout(180_000);
  expect(
    baseURL && ['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname),
  ).toBe(true);
  await loginViaCurrentPasswordChallenge(page, { timeout: 120_000 });
  await page.waitForLoadState('networkidle');
  let captured: Array<{ code?: string; path: string }> = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes('/V1/api/'))
      captured.push({
        path: url.pathname,
        code: url.searchParams.get('code') || undefined,
      });
  });
  await page.goto('/clob/V1/EmailRelayRoute', {
    waitUntil: 'domcontentloaded',
  });
  await expect(
    page.getByRole('columnheader', { name: '路由名称' }),
  ).toBeVisible();
  await page.waitForLoadState('networkidle');
  const reload = captured;
  await page.getByText('首页', { exact: true }).first().click();
  await page.waitForLoadState('networkidle');
  captured = [];
  const entries = page.getByText(/^邮件中转(?:路由)?$/);
  let entered = false;
  for (const entry of await entries.all()) {
    if (await entry.isVisible()) {
      await entry.click();
      entered = true;
      break;
    }
  }
  expect(entered, '从可见菜单或页签返回邮件中转').toBe(true);
  await expect(page).toHaveURL(/\/clob\/V1\/EmailRelayRoute$/);
  await page.waitForLoadState('networkidle');
  const spa = captured;
  await testInfo.attach('request-audit', {
    body: JSON.stringify({ reload, spa }),
    contentType: 'application/json',
  });
  console.log('MAIL_RELAY_REQUEST_AUDIT', JSON.stringify({ reload, spa }));
  expect(spa.length).toBeLessThanOrEqual(5);
  expect(
    spa.some(({ path }) =>
      /apiDataAttrPolicies|dataAttrPolicy|fieldGroupSnapshot/.test(path),
    ),
  ).toBe(false);
});

test('邮件中转实际新增、查询、编辑均逐动作查库', async ({
  page,
  baseURL,
}, testInfo) => {
  test.skip(!isCrudAcceptanceEnabled(), '仅显式启用本地CRUD验收时写入QA配置');
  test.setTimeout(240_000);
  expect(
    baseURL && ['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname),
  ).toBe(true);
  const suffix = Date.now().toString(36);
  const name = `qa-mail-relay-${suffix}`;
  const domain = `${name}.example.test`;
  const target = 'qa-destination@example.test';
  const editedTarget = 'qa-edited@example.test';
  const errors: string[] = [];
  const requests: string[] = [];
  const allApiRequests: string[] = [];
  const providerActions: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.includes('/V1/api/')) allApiRequests.push(path);
    if (path.includes('/api/EmailRelayRoute/')) requests.push(path);
    if (
      /\/EmailRelayRoute\/(?:sync(?:Dns)?|autoConfigure|removeProviderResource)/.test(
        path,
      )
    )
      providerActions.push(path);
  });
  await loginViaCurrentPasswordChallenge(page, { timeout: 120_000 });
  await page.waitForLoadState('networkidle');
  allApiRequests.length = 0;
  requests.length = 0;
  const listed = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith('/EmailRelayRoute/list'),
  );
  await page.goto('/clob/V1/EmailRelayRoute', {
    waitUntil: 'domcontentloaded',
  });
  const listedResponse = await listed;
  expect(listedResponse.ok()).toBe(true);
  const initRequests = [...requests];
  const initAllApiRequests = [...allApiRequests];
  expect(databaseRows(name)).toEqual([]);
  await page.getByRole('button', { name: '新增', exact: true }).click();
  let dialog = page.getByRole('dialog').filter({ hasText: '新增邮件中转' });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('请输入路由名称', { exact: true }).fill(name);
  const domainInput = dialog
    .locator('.ant-form-item')
    .filter({ hasText: '邮件域名' })
    .first()
    .locator('input[role="combobox"]');
  await domainInput.fill(domain);
  await domainInput.press('Enter');
  await domainInput.press('Tab');
  const providerInput = dialog
    .locator('.ant-form-item')
    .filter({ hasText: '提供商' })
    .first()
    .locator('input[role="combobox"]');
  await providerInput.click();
  await page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .last()
    .getByText('Forward Email', { exact: true })
    .click();
  const enabled = dialog
    .locator('.ant-form-item')
    .filter({ hasText: '是否启用' })
    .first()
    .getByRole('switch');
  if ((await enabled.getAttribute('aria-checked')) === 'true')
    await enabled.click();
  await dialog.locator('.ant-modal-footer button.ant-btn-primary').click();
  await expect(
    page.getByText('至少需要一个投递目标', { exact: true }),
  ).toBeVisible();
  await expect(dialog).toBeVisible();
  expect(databaseRows(name)).toEqual([]);
  expect(requests.filter((path) => path.endsWith('/create'))).toHaveLength(0);
  await dialog.getByRole('button', { name: '新增一项', exact: true }).click();
  const item = dialog.locator('.runtime-schema-collection__item').first();
  await item.getByRole('combobox').click();
  await page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .last()
    .getByText('邮箱', { exact: true })
    .click();
  await item.getByRole('textbox').fill(target);
  await page.screenshot({
    path: testInfo.outputPath('mail-relay-filled.png'),
    fullPage: false,
  });
  const created = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith('/EmailRelayRoute/create'),
  );
  await dialog.locator('.ant-modal-footer button.ant-btn-primary').click();
  const createdResponse = await created;
  expect(createdResponse.ok()).toBe(true);
  await expect(dialog).toBeHidden();
  const saved = databaseRows(name);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    name,
    mail_domain: domain,
    local_part: 'support',
    provider_code: 'forward-email',
    target_list: [`email:${target}`],
    sync_status: 'Pending',
    provider_route_id: null,
    enable: false,
  });
  await testInfo.attach('create-database', {
    body: JSON.stringify(saved),
    contentType: 'application/json',
  });
  const row = page.locator('.ant-table-row').filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: /编\s*辑/ }).click();
  dialog = page.getByRole('dialog').filter({ hasText: '编辑邮件中转' });
  await expect(dialog).toBeVisible();
  const address = dialog
    .locator('.runtime-schema-collection__item')
    .first()
    .getByRole('textbox');
  await expect(address).toHaveValue(target);
  await address.fill(editedTarget);
  const updated = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith('/EmailRelayRoute/update'),
  );
  await dialog.locator('.ant-modal-footer button.ant-btn-primary').click();
  const updatedResponse = await updated;
  expect(updatedResponse.ok()).toBe(true);
  await expect(dialog).toBeHidden();
  const edited = databaseRows(name);
  expect(edited).toHaveLength(1);
  expect(edited[0]).toMatchObject({
    id: saved[0].id,
    target_list: [`email:${editedTarget}`],
    sync_status: 'Pending',
    provider_route_id: null,
    enable: false,
  });
  expect(providerActions).toEqual([]);
  expect(errors).toEqual([]);
  await testInfo.attach('edit-database-and-requests', {
    body: JSON.stringify({
      edited,
      initRequests,
      initAllApiRequests,
      requests,
    }),
    contentType: 'application/json',
  });
  console.log(
    'MAIL_RELAY_E2E',
    JSON.stringify({
      name,
      id: saved[0].id,
      initRequests,
      initAllApiRequests,
      requests,
      providerActions,
    }),
  );
});
