import type { Page } from '@playwright/test';

import { writeFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { loginViaCurrentPasswordChallenge } from './support/crud-acceptance';

const report: Record<string, unknown>[] = [];

/** 补充菜单审计以外的真实入口；不提交表单或触发通知。 */
async function inspect(page: Page, path: string, open?: () => Promise<void>) {
  const requests: { method: string; path: string; status?: number }[] = [];
  const errors: string[] = [];
  const onRequest = (request: any) => {
    if (['fetch', 'xhr'].includes(request.resourceType())) {
      const url = new URL(request.url());
      if (url.origin === 'http://127.0.0.1:5666')
        requests.push({
          method: request.method(),
          path: `${url.pathname}${url.search}`,
        });
    }
  };
  const onResponse = (response: any) => {
    const url = new URL(response.url());
    const row = requests.findLast(
      (item) =>
        item.path === `${url.pathname}${url.search}` &&
        item.status === undefined,
    );
    if (row) row.status = response.status();
  };
  const onError = (error: Error) => errors.push(error.message);
  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('pageerror', onError);
  let failure: string | undefined;
  try {
    await (open ? open() : page.goto(path, { waitUntil: 'domcontentloaded' }));
    await expect(page.locator('#app')).not.toBeEmpty({ timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
    await expect(page.locator('body')).not.toHaveText('', { timeout: 30_000 });
    expect(errors).toEqual([]);
    expect(requests.filter((item) => (item.status || 0) >= 400)).toEqual([]);
  } catch (error) {
    failure = String(error);
  }
  const visibleText = await page.locator('body').innerText();
  const row = {
    path,
    navigation: open ? 'dropdown-click' : 'deep-link',
    finalPath: new URL(page.url()).pathname,
    requestCount: requests.length,
    overFive: requests.length > 5,
    requests,
    errors,
    failure,
    text: visibleText.slice(-1800),
  };
  report.push(row);
  writeFileSync(
    '/tmp/levin-hidden-page-audit.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ path, count: requests.length, failure }));
  page.off('request', onRequest);
  page.off('response', onResponse);
  page.off('pageerror', onError);
  expect(failure, path).toBeUndefined();
}

test('补查隐藏功能、兼容入口与公开认证页面', async ({ page, browser }) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(30_000);
  console.log('开始登录隐藏入口审计');
  await loginViaCurrentPasswordChallenge(page, { timeout: 90_000 });
  console.log('登录完成');
  await expect(page.locator('.header-user-dropdown')).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForLoadState('networkidle', { timeout: 30_000 });
  console.log('开始检查个人中心');
  await inspect(page, '个人中心下拉入口', async () => {
    await page.locator('.header-user-dropdown').click();
    await page.getByRole('menuitem', { name: '个人中心', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('基本设置', {
      timeout: 30_000,
    });
  });
  for (const path of [
    '/profile',
    '/clob/V1/index',
    '/demos/public-components/user-org-selector',
    '/demos/public-components/permissions',
    '/clob/V1/Partner',
    '/clob/V1/SettlementStatement',
  ])
    await inspect(page, path);

  // 独立匿名上下文，避免退出或污染当前已登录会话。
  const anonymous = await browser.newContext({
    baseURL: 'http://127.0.0.1:5666',
  });
  const publicPage = await anonymous.newPage();
  try {
    for (const path of [
      '/auth',
      '/auth/login',
      '/auth/code-login',
      '/auth/qrcode-login',
      '/auth/forget-password',
      '/auth/register',
      '/auth/invitation-register',
    ])
      await inspect(publicPage, path);
  } finally {
    await anonymous.close();
  }
});

// 关闭旧文档后单独采集个人页，排除旧页请求对冷启动计数的影响。
test('个人中心独立文档请求归因', async ({ page }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(30_000);
  await loginViaCurrentPasswordChallenge(page, { timeout: 90_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 });
  const context = page.context();
  await page.close();
  const freshPage = await context.newPage();
  await inspect(freshPage, '/profile');
  const requests = report.at(-1)?.requests as { path: string }[];
  // 个人资料刷新不应重复触发顶部消息两项查询。
  for (const endpoint of [
    '/UserMessage/use/unreadCount',
    '/UserMessage/use/list',
  ]) {
    expect(
      requests.filter((request) =>
        request.path.split('?')[0]?.endsWith(endpoint),
      ),
    ).toHaveLength(1);
  }
  writeFileSync(
    '/tmp/levin-profile-fresh-page-audit.json',
    JSON.stringify(report, null, 2),
  );
  await freshPage.close();
});
