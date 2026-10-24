import { expect, test } from '@playwright/test';

import { loginViaCurrentPasswordChallenge } from './support/crud-acceptance';

test('用户与组织用户十轮切换不重查角色元数据', async ({ page }) => {
  test.setTimeout(90_000);
  const urls: string[] = [];
  page.on('request', (request) => {
    if (['fetch', 'xhr'].includes(request.resourceType()))
      urls.push(request.url());
  });
  await loginViaCurrentPasswordChallenge(page);
  const group = page.getByRole('menu').getByText('用户&权限', { exact: true });
  if (!(await group.isVisible()))
    await page.getByRole('menu').getByText('基础框架', { exact: true }).click();
  await group.click();
  let loadedPages = 0;
  for (const [title, path] of [
    ['用户管理', '/clob/V1/User'],
    ['组织与用户', '/clob/V1/OrgUser'],
  ] as const) {
    await page.getByRole('menuitem', { name: title, exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(path);
    await expect(
      page.getByRole('navigation', { name: 'breadcrumb' }),
    ).toContainText(title);
    loadedPages++;
    await expect
      .poll(
        () =>
          urls.filter((url) =>
            new URL(url).pathname.endsWith('/Role/listUserRoleCode'),
          ).length,
      )
      .toBe(loadedPages);
    await page.waitForTimeout(500);
  }
  const count = (suffix: string) =>
    urls.filter((url) => new URL(url).pathname.endsWith(suffix)).length;
  await expect.poll(() => count('/Role/list')).toBe(2);
  await expect.poll(() => count('/Role/listUserRoleCode')).toBe(2);
  const start = urls.length;
  for (let round = 0; round < 10; round++) {
    for (const title of ['用户管理', '组织与用户']) {
      await page.getByRole('menuitem', { name: title, exact: true }).click();
      await expect(
        page.getByRole('navigation', { name: 'breadcrumb' }),
      ).toContainText(title);
    }
  }
  await page.waitForTimeout(500);
  expect(count('/Role/list')).toBe(2);
  expect(count('/Role/listUserRoleCode')).toBe(2);
  expect(urls.slice(start)).toEqual([]);
  console.log(
    JSON.stringify({
      roleMetadata: count('/Role/list'),
      roleOptions: count('/Role/listUserRoleCode'),
      repeatedNavigationRequests: urls.length - start,
    }),
  );
});
