import type { Page } from '@playwright/test';

import { mkdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';

import { expect, test } from '@playwright/test';

import { loginViaCurrentPasswordChallenge } from './support/crud-acceptance';
import {
  captureFieldPolicyRequests,
  isFieldPolicyRequest,
} from './support/field-policy-requests';

const output = process.env.PAGE_AUDIT_OUTPUT || '/tmp/levin-all-pages-audit';

/** 依据真实菜单展开业务分组，保留 SPA 标签缓存和正常点击链路。 */
async function expandMenus(page: Page) {
  for (let round = 0; round < 5; round++) {
    const collapsed = page.locator(
      '[role="menu"] [role="menuitem"][aria-expanded="false"]',
    );
    const count = await collapsed.count();
    if (!count) break;
    for (let index = count - 1; index >= 0; index--)
      await collapsed.nth(index).dispatchEvent('click');
  }
}

test('逐页点击并记录超过五个请求的页面', async ({ page }) => {
  test.setTimeout(900_000);
  page.setDefaultTimeout(30_000);
  mkdirSync(output, { recursive: true });
  const requests: any[] = [];
  const allRequests: any[] = [];
  const policyRequests = captureFieldPolicyRequests(page.context());
  const consoleErrors: string[] = [];
  const active = new Set<any>();
  page.on('request', (request) => {
    const recorded = {
      resourceType: request.resourceType(),
      method: request.method(),
      url: request.url(),
      at: Date.now(),
    };
    allRequests.push(recorded);
    if (!['fetch', 'xhr'].includes(request.resourceType())) return;
    active.add(request);
    requests.push({
      method: request.method(),
      url: request.url(),
      at: Date.now(),
    });
  });
  page.on('requestfinished', (request) => active.delete(request));
  page.on('requestfailed', (request) => active.delete(request));
  page.on('response', (response) => {
    const recorded = allRequests.findLast(
      (request) =>
        request.url === response.url() && request.status === undefined,
    );
    if (recorded) recorded.status = response.status();
    const item = requests.findLast(
      (request) =>
        request.url === response.url() && request.status === undefined,
    );
    if (item) item.status = response.status();
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error')
      consoleErrors.push(message.text().slice(0, 500));
  });
  await loginViaCurrentPasswordChallenge(page, { timeout: 90_000 });
  await page.waitForTimeout(1000);
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
  await expandMenus(page);
  const menu = await page
    .locator('[role="menu"] [role="menuitem"]')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        text: element.textContent?.trim(),
        html: element.outerHTML,
      })),
    );
  writeFileSync(
    `${output}/inventory.json`,
    JSON.stringify({ routes, menu, startupRequests: requests }, null, 2),
  );
  writeFileSync(
    `${output}/all-requests.json`,
    JSON.stringify(allRequests, null, 2),
  );
  writeFileSync(
    `${output}/policy-requests.json`,
    JSON.stringify(policyRequests, null, 2),
  );
  expect(policyRequests, '登录及菜单初始化字段策略 HTTP 必须为零').toEqual([]);
  if (process.env.PAGE_AUDIT_INVENTORY_ONLY === '1') return;
  const pages = routes.filter(
    (route: any) =>
      !route.redirect &&
      route.children.length === 0 &&
      !route.path.includes(':') &&
      route.meta.menuPageType === 'LocalPage' &&
      !route.meta.hideInMenu,
  );
  const report: any[] = [];
  for (const route of pages) {
    const start = requests.length;
    const errorStart = consoleErrors.length;
    const label = String(route.meta.title || '');
    const row: any = {
      path: route.path,
      title: label,
      started: new Date().toISOString(),
    };
    try {
      const menuItem = page.getByRole('menuitem', { name: label, exact: true });
      if (!(await menuItem.isVisible())) {
        const parent = routes.find((candidate: any) =>
          candidate.children.includes(route.path),
        );
        if (parent) {
          const group = page
            .getByRole('menu')
            .getByText(String(parent.meta.title), { exact: true });
          if (!(await group.isVisible()))
            await page
              .getByRole('menu')
              .getByText('基础框架', { exact: true })
              .click();
          await group.click();
        }
      }
      if ((await menuItem.count()) === 1) {
        await menuItem.click();
        row.navigation = 'menu-click';
      } else {
        row.navigation = 'not-found';
        row.menuMatches = await menuItem.count();
        throw new Error('无法唯一定位真实菜单入口');
      }
      await expect.poll(() => new URL(page.url()).pathname).toBe(route.path);
      await expect(page.locator('#__vben_main_content')).toBeVisible();
      if (route.path !== '/index')
        await expect(
          page.getByRole('navigation', { name: 'breadcrumb' }),
        ).toContainText(label);
      await page.waitForTimeout(800);
      let previous = requests.length;
      let stable = 0;
      for (let index = 0; index < 60; index++) {
        await page.waitForTimeout(200);
        stable =
          requests.length === previous && active.size === 0 ? stable + 1 : 0;
        if (stable >= 2) break;
        previous = requests.length;
      }
      if (active.size > 0) throw new Error('页面请求在等待上限内未完成');
      row.messages = await page
        .locator('.ant-message-error, .ant-notification-notice-error')
        .allTextContents();
      const visibleText = await page
        .locator('#__vben_main_content')
        .innerText();
      row.visibleText = visibleText.slice(0, 500);
      row.status = row.messages.length > 0 ? 'error' : 'passed';
    } catch (error) {
      row.status = 'error';
      row.error = String(error);
    }
    row.requests = requests.slice(start);
    row.apiRequests = row.requests.filter((request: any) =>
      new URL(request.url).pathname.includes('/api/'),
    );
    row.policyRequests = row.requests.filter((request: any) =>
      isFieldPolicyRequest(request.url),
    );
    row.apiCount = row.apiRequests.length;
    row.count = row.requests.length;
    row.overBudget = row.count > 5;
    row.consoleErrors = consoleErrors.slice(errorStart);
    if (
      row.policyRequests.length > 0 ||
      row.consoleErrors.length > 0 ||
      row.apiRequests.some((request: any) => request.status >= 400)
    )
      row.status = 'error';
    report.push(row);
    writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
    writeFileSync(
      `${output}/all-requests.json`,
      JSON.stringify(allRequests, null, 2),
    );
    writeFileSync(
      `${output}/policy-requests.json`,
      JSON.stringify(policyRequests, null, 2),
    );
    writeFileSync(
      `${output}/over-five.json`,
      JSON.stringify(
        report.filter((item) => item.overBudget),
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        page: report.length,
        path: row.path,
        count: row.count,
        status: row.status,
        overBudget: row.overBudget,
      }),
    );
  }
  expect(policyRequests, '整个逐页审计字段策略 HTTP 必须为零').toEqual([]);
  expect(report.length).toBe(pages.length);
  expect(report.filter((row) => row.status === 'error')).toEqual([]);
});
