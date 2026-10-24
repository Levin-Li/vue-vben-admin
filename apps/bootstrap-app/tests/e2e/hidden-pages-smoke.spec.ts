import type { Page } from '@playwright/test';

import { writeFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { loginViaCurrentPasswordChallenge } from './support/crud-acceptance';
import {
  captureFieldPolicyRequests,
  isFieldPolicyRequest,
} from './support/field-policy-requests';

const report: Record<string, unknown>[] = [];
let reportOutput = '/tmp/levin-hidden-page-audit.json';
const pendingRequests = new WeakMap<
  Page,
  Map<unknown, { type: string; url: string }>
>();
const pendingFailures: Record<string, unknown>[] = [];

/** 保留超时现场全部未完成请求，不能以删除网络等待掩盖业务请求悬挂。 */
function trackPendingRequests(page: Page) {
  if (pendingRequests.has(page)) return;
  const pending = new Map<unknown, { type: string; url: string }>();
  pendingRequests.set(page, pending);
  page.on('request', (request) =>
    pending.set(request, { url: request.url(), type: request.resourceType() }),
  );
  page.on('requestfinished', (request) => pending.delete(request));
  page.on('requestfailed', (request) => pending.delete(request));
}

async function waitForNetworkIdle(page: Page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
  } catch (error) {
    const failure = {
      path: new URL(page.url()).pathname,
      pending: [...(pendingRequests.get(page)?.values() ?? [])],
      error: String(error),
    };
    pendingFailures.push(failure);
    writeFileSync(
      '/tmp/levin-hidden-pending-requests.json',
      JSON.stringify(pendingFailures, null, 2),
    );
    console.log(JSON.stringify({ networkIdleFailure: failure }));
    throw error;
  }
}

/** 补充菜单审计以外的真实入口；不提交表单或触发通知。 */
async function inspect(
  page: Page,
  path: string,
  open?: () => Promise<void>,
  navigation = 'dropdown-click',
  anonymousProtected = false,
) {
  trackPendingRequests(page);
  const requests: { method: string; path: string; status?: number }[] = [];
  const errors: string[] = [];
  const errorDetails: { message: string; stack?: string }[] = [];
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
  const onError = (error: Error) => {
    errors.push(error.message);
    errorDetails.push({ message: error.message, stack: error.stack });
  };
  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('pageerror', onError);
  let failure: string | undefined;
  try {
    await (open ? open() : page.goto(path, { waitUntil: 'domcontentloaded' }));
    await expect(page.locator('#app')).not.toBeEmpty({ timeout: 30_000 });
    await waitForNetworkIdle(page);
    await expect(page.locator('body')).not.toHaveText('', { timeout: 30_000 });
    if (path === '/__audit_missing_page__')
      await expect(page.locator('body')).toContainText('未找到页面');
    if (anonymousProtected) {
      expect(new URL(page.url()).pathname).toBe('/auth/login');
      // 父路由先解析到默认叶页，登录守卫保留解析后的真实目标。
      const target =
        path === '/demos/public-components'
          ? '/demos/public-components/user-org-selector'
          : path;
      expect(new URL(page.url()).searchParams.get('redirect')).toBe(target);
    } else if (path === '/demos/public-components')
      expect(new URL(page.url()).pathname).toBe(
        '/demos/public-components/user-org-selector',
      );
    expect(errors).toEqual([]);
    expect(
      requests.filter((request) =>
        isFieldPolicyRequest(`http://127.0.0.1:5666${request.path}`),
      ),
    ).toEqual([]);
    expect(requests.filter((item) => (item.status || 0) >= 400)).toEqual([]);
  } catch (error) {
    failure = String(error);
  }
  const visibleText = await page.locator('body').innerText();
  const row = {
    path,
    navigation: open ? navigation : 'deep-link',
    finalPath: new URL(page.url()).pathname,
    anonymousProtected,
    loginRedirect: new URL(page.url()).searchParams.get('redirect'),
    requestCount: requests.length,
    policyRequests: requests.filter((request) =>
      isFieldPolicyRequest(`http://127.0.0.1:5666${request.path}`),
    ),
    overFive: requests.length > 5,
    requests,
    errors,
    errorDetails,
    failure,
    text: visibleText.slice(-1800),
  };
  report.push(row);
  writeFileSync(reportOutput, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      path,
      finalPath: row.finalPath,
      count: requests.length,
      failure,
    }),
  );
  page.off('request', onRequest);
  page.off('response', onResponse);
  page.off('pageerror', onError);
  expect(failure, path).toBeUndefined();
}

test('补查隐藏功能、兼容入口与公开认证页面', async ({ page, browser }) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(30_000);
  trackPendingRequests(page);
  const policyRequests = captureFieldPolicyRequests(page.context());
  console.log('开始登录隐藏入口审计');
  await loginViaCurrentPasswordChallenge(page, { timeout: 90_000 });
  console.log('登录完成');
  await expect(page.locator('.header-user-dropdown')).toBeVisible({
    timeout: 30_000,
  });
  await waitForNetworkIdle(page);
  console.log('开始检查个人中心');
  await inspect(page, '个人中心下拉入口', async () => {
    await page.locator('.header-user-dropdown').click();
    await page.getByRole('menuitem', { name: '个人中心', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('基本设置', {
      timeout: 30_000,
    });
  });
  for (const path of [
    '/',
    '/profile',
    '/demos/public-components',
    '/clob/V1/index',
    '/demos/public-components/user-org-selector',
    '/demos/public-components/permissions',
    '/clob/V1/Partner',
    '/clob/V1/SettlementStatement',
  ])
    await inspect(page, path);

  // 已初始化会话验证兜底组件；冷启动未知链接按既有规则恢复到安全首页。
  await inspect(
    page,
    '/__audit_missing_page__',
    async () => {
      await page.evaluate(async () => {
        const router = (document.querySelector('#app') as any).__vue_app__
          .config.globalProperties.$router;
        await router.push('/__audit_missing_page__');
      });
    },
    'client-route',
  );

  // 独立匿名上下文，避免退出或污染当前已登录会话。
  const anonymous = await browser.newContext({
    baseURL: 'http://127.0.0.1:5666',
  });
  const anonymousPolicyRequests = captureFieldPolicyRequests(anonymous);
  const publicPage = await anonymous.newPage();
  publicPage.setDefaultTimeout(30_000);
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
    // 三个受保护演示入口在匿名状态必须保留目标并回到登录页，不提交登录。
    for (const path of [
      '/demos/public-components',
      '/demos/public-components/user-org-selector',
      '/demos/public-components/permissions',
    ])
      await inspect(publicPage, path, undefined, 'deep-link', true);
  } finally {
    await anonymous.close();
  }
  writeFileSync(
    '/tmp/levin-hidden-policy-requests.json',
    JSON.stringify(
      { authenticated: policyRequests, anonymous: anonymousPolicyRequests },
      null,
      2,
    ),
  );
  expect(policyRequests, '含登录在内的隐藏入口字段策略 HTTP 必须为零').toEqual(
    [],
  );
  expect(anonymousPolicyRequests, '公开认证入口字段策略 HTTP 必须为零').toEqual(
    [],
  );
});

// 关闭旧文档后单独采集个人页，排除旧页请求对冷启动计数的影响。
test('个人中心独立文档请求归因', async ({ page }) => {
  test.setTimeout(180_000);
  report.length = 0;
  reportOutput = '/tmp/levin-profile-fresh-page-audit.json';
  const policyRequests = captureFieldPolicyRequests(page.context());
  page.setDefaultTimeout(30_000);
  trackPendingRequests(page);
  await loginViaCurrentPasswordChallenge(page, { timeout: 90_000 });
  await waitForNetworkIdle(page);
  const context = page.context();
  await page.close();
  const freshPage = await context.newPage();
  freshPage.setDefaultTimeout(30_000);
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
  expect(policyRequests, '独立文档及其登录字段策略 HTTP 必须为零').toEqual([]);
  await freshPage.close();
});
