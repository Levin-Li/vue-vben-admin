import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { loginViaCurrentPasswordChallenge } from './support/crud-acceptance';
import { captureFieldPolicyRequests } from './support/field-policy-requests';

test('共享目录一次初始化，角色按页面需求读取，十轮切页不重复加载', async ({
  page,
}) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(30_000);
  const requests: string[] = [];
  const policyRequests = captureFieldPolicyRequests(page.context());
  const failed: string[] = [];
  const observedResponses: { method: string; status: number; url: string }[] =
    [];
  page.on('request', (request) => {
    if (['fetch', 'xhr'].includes(request.resourceType()))
      requests.push(request.url());
  });
  page.on('response', (response) => {
    if (['fetch', 'xhr'].includes(response.request().resourceType()))
      observedResponses.push({
        method: response.request().method(),
        status: response.status(),
        url: response.url(),
      });
    if (response.status() >= 400 && response.url().includes('/api/'))
      failed.push(`${response.status()} ${response.url()}`);
  });
  // 校验真实 HTTP 返回，避免旧后端缺少登录许可时被前端默认值掩盖。
  const userInfoResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname.endsWith('/rbac/userInfo'),
    { timeout: 90_000 },
  );
  await loginViaCurrentPasswordChallenge(page, { timeout: 90_000 });
  const loadedUserInfo = await userInfoResponse;
  expect(loadedUserInfo.ok()).toBe(true);
  const envelope = await loadedUserInfo.json();
  const rawHeaders = loadedUserInfo.headers();
  // 原始 HTTP 仍沿用既有整响应加密，只记录协议和形状，不输出用户数据。
  expect(rawHeaders['x-urlacl-crypto-algorithm']).toBe('AES_GCM');
  expect(rawHeaders['cache-control']).toContain('no-store');
  expect(typeof envelope.data).toBe('string');
  await expect(page.locator('.header-user-dropdown')).toBeVisible();
  const storePath = fileURLToPath(
    new URL('../../../../packages/runtime/src/stores.ts', import.meta.url),
  );
  const grants = await page.evaluate(async (moduleUrl) => {
    const stores = await import(moduleUrl);
    const grants = stores.useUserStore().userInfo?.fieldGroupGrants;
    return {
      version: grants?.version,
      allowedIsArray: Array.isArray(grants?.allowed),
      allowedCount: grants?.allowed?.length,
    };
  }, `http://127.0.0.1:5666/@fs${storePath}`);
  expect(grants.version, '真实解密 userInfo 必须携带版本 1 字段许可').toBe(1);
  expect(grants.allowedIsArray, '真实字段许可 allowed 必须为数组').toBe(true);
  const routes = await page.evaluate(() => {
    const router = (document.querySelector('#app') as any).__vue_app__.config
      .globalProperties.$router;
    return router.getRoutes().map((route: any) => ({
      path: route.path,
      name: route.name,
      meta: route.meta,
      redirect:
        typeof route.redirect === 'string'
          ? route.redirect
          : Boolean(route.redirect),
      children: route.children.map((child: any) => child.path),
    }));
  });
  writeFileSync(
    '/tmp/levin-static-current-route-inventory.json',
    JSON.stringify({ routes }, null, 2),
  );
  expect(policyRequests, '登录不得加载字段策略或快照').toEqual([]);
  const navigate = async (path: string, first = false) => {
    const entity = path.split('/').at(-1);
    const response = first
      ? page.waitForResponse((item) =>
          new URL(item.url()).pathname.endsWith(`/api/${entity}/list`),
        )
      : undefined;
    await page.evaluate(async (target) => {
      const app = document.querySelector('#app') as any;
      await app.__vue_app__.config.globalProperties.$router.push(target);
    }, path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(
      page.locator('#__vben_main_content .ant-table:visible'),
    ).toBeVisible();
    if (response) {
      const loaded = await response;
      expect(loaded.ok()).toBe(true);
    }
  };
  const paths = [
    '/clob/V1/TenantCustomMenu',
    '/clob/V1/DomainSslCert',
    '/clob/V1/Tenant',
  ];
  for (const path of paths) await navigate(path, true);
  expect(policyRequests, '初次打开页面不得加载字段策略或快照').toEqual([]);
  const initial = requests.length;
  for (let round = 0; round < 10; round++) {
    for (const path of paths) await navigate(path);
  }
  await page.waitForTimeout(500);
  const count = (fragment: string) =>
    requests.filter((url) => url.includes(fragment)).length;
  expect(count('apiDataAttrPolicies')).toBe(0);
  expect(count('apiDataAttrPolicySnapshot')).toBe(0);
  expect(count('listUserRoleCode')).toBe(0);
  expect(count('workflow-runtime/business-types')).toBe(1);
  expect(
    requests
      .slice(initial)
      .filter((url) =>
        /apiDataAttrPolic|listUserRoleCode|business-types/.test(url),
      ),
  ).toEqual([]);
  expect(
    requests
      .slice(initial)
      .filter((url) =>
        paths.some((path) =>
          new URL(url).pathname.endsWith(`/api/${path.split('/').at(-1)}/list`),
        ),
      ),
  ).toEqual([]);
  const navigationRequests = requests.length - initial;
  await expect(page.locator('.ant-drawer:visible')).toHaveCount(0);
  await expect(page.locator('.ant-message-error')).toHaveCount(0);
  const firstSettingsStart = requests.length;
  await page.getByRole('button', { name: '页面展示设置', exact: true }).click();
  await expect(page.locator('.ant-drawer:visible')).toBeVisible();
  await expect.poll(() => count('listUserRoleCode')).toBe(1);
  await page.locator('.ant-drawer:visible .ant-drawer-close').click();
  await expect(page.locator('.ant-drawer:visible')).toHaveCount(0);
  const secondSettingsStart = requests.length;
  await page.getByRole('button', { name: '页面展示设置', exact: true }).click();
  await expect(page.locator('.ant-drawer:visible')).toBeVisible();
  expect(count('listUserRoleCode')).toBe(1);
  expect(policyRequests, '切页和打开 UI 设置均不得加载字段策略或快照').toEqual(
    [],
  );
  writeFileSync(
    '/tmp/levin-static-session-request-budget.json',
    JSON.stringify(
      {
        initialRequests: requests.slice(0, initial),
        navigationRequests: requests.slice(
          initial,
          initial + navigationRequests,
        ),
        settingsRequests: requests.slice(initial + navigationRequests),
        firstSettingsOpenRequests: requests.slice(
          firstSettingsStart,
          secondSettingsStart,
        ),
        secondSettingsOpenRequests: requests.slice(secondSettingsStart),
        policyRequests,
        observedResponses,
        userInfoRequests: count('/rbac/userInfo'),
        fieldGroupGrantsVersion: grants.version,
        fieldGroupGrantCount: grants.allowedCount,
        userInfoCryptoAlgorithm: rawHeaders['x-urlacl-crypto-algorithm'],
        userInfoCacheControl: rawHeaders['cache-control'],
        userInfoRawDataType: typeof envelope.data,
      },
      null,
      2,
    ),
  );
  expect(failed).toEqual([]);
  console.log(
    JSON.stringify({
      initialRequests: initial,
      additionalNavigationRequests: navigationRequests,
      settingsRequests: requests.length - initial - navigationRequests,
      policyRequests,
      userInfoRequests: count('/rbac/userInfo'),
      fieldGroupGrantsVersion: grants.version,
      fieldGroupGrantCount: grants.allowedCount,
      userInfoCryptoAlgorithm: rawHeaders['x-urlacl-crypto-algorithm'],
      userInfoCacheControl: rawHeaders['cache-control'],
      userInfoRawDataType: typeof envelope.data,
      snapshot: count('apiDataAttrPolicySnapshot'),
      roles: count('listUserRoleCode'),
      workflow: count('workflow-runtime/business-types'),
    }),
  );
});
