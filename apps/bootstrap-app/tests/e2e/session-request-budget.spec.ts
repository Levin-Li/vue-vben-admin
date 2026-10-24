import { expect, test } from '@playwright/test';

import { loginViaCurrentPasswordChallenge } from './support/crud-acceptance';

test('共享目录一次初始化，角色按页面需求读取，十轮切页不重复加载', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const requests: string[] = [];
  const failed: string[] = [];
  page.on('request', (request) => {
    if (['fetch', 'xhr'].includes(request.resourceType()))
      requests.push(request.url());
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().includes('/api/'))
      failed.push(`${response.status()} ${response.url()}`);
  });
  const snapshotResponse = page.waitForResponse((response) =>
    response.url().includes('apiDataAttrPolicySnapshot'),
  );
  await loginViaCurrentPasswordChallenge(page, { timeout: 90_000 });
  const snapshotLoaded = await snapshotResponse;
  const snapshotBytes = (await snapshotLoaded.body()).length;
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
  await expect
    .poll(
      () =>
        requests.filter((url) => url.includes('apiDataAttrPolicySnapshot'))
          .length,
    )
    .toBe(1);
  const initial = requests.length;
  for (let round = 0; round < 10; round++) {
    for (const path of paths) await navigate(path);
  }
  await page.waitForTimeout(500);
  const count = (fragment: string) =>
    requests.filter((url) => url.includes(fragment)).length;
  expect(count('apiDataAttrPolicies')).toBe(0);
  expect(count('apiDataAttrPolicySnapshot')).toBe(1);
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
  await page.getByRole('button', { name: '页面展示设置', exact: true }).click();
  await expect(page.locator('.ant-drawer:visible')).toBeVisible();
  await expect.poll(() => count('listUserRoleCode')).toBe(1);
  await page.locator('.ant-drawer:visible .ant-drawer-close').click();
  await expect(page.locator('.ant-drawer:visible')).toHaveCount(0);
  await page.getByRole('button', { name: '页面展示设置', exact: true }).click();
  await expect(page.locator('.ant-drawer:visible')).toBeVisible();
  expect(count('listUserRoleCode')).toBe(1);
  expect(failed).toEqual([]);
  console.log(
    JSON.stringify({
      initialRequests: initial,
      additionalNavigationRequests: navigationRequests,
      settingsRequests: requests.length - initial - navigationRequests,
      snapshotBytes,
      snapshot: count('apiDataAttrPolicySnapshot'),
      roles: count('listUserRoleCode'),
      workflow: count('workflow-runtime/business-types'),
    }),
  );
});
