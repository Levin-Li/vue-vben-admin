import { expect, test } from '@playwright/test';

const ACCESS_TOKEN = '6a6ede04-f491-470e-9bfa-87889d9ea364';
const ACCESS_STORE_KEY = 'levin-main-app-0.1.0-dev-core-access';

async function bootstrapLogin(page: import('@playwright/test').Page) {
  await page.addInitScript(
    ({ key, token }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          accessCodes: [],
          accessToken: token,
          isLockScreen: false,
          lockScreenPassword: null,
          refreshToken: null,
        }),
      );
    },
    { key: ACCESS_STORE_KEY, token: ACCESS_TOKEN },
  );
}

test.describe('Admin Smoke', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapLogin(page);
  });

  test('loads core management pages', async ({ page }) => {
    const pages = [
      { path: '/clob/V1/Role', breadcrumb: '角色管理' },
      { path: '/clob/V1/Menu', breadcrumb: '菜单管理' },
      { path: '/clob/V1/Org', breadcrumb: '机构管理' },
      { path: '/clob/V1/User', breadcrumb: '用户管理' },
      { path: '/clob/V1/Dict', breadcrumb: '字典管理' },
      { path: '/clob/V1/Tenant', breadcrumb: '平台租户管理' },
      { path: '/clob/V1/TenantSite', breadcrumb: '租户站点管理' },
    ];

    for (const item of pages) {
      await page.goto(item.path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${item.path}$`));
      await expect(
        page.getByRole('navigation', { name: 'breadcrumb' }).getByText(
          item.breadcrumb,
          {
            exact: true,
          },
        ),
      ).toBeVisible();
      await expect(
        page.locator('.ant-table-wrapper').first(),
      ).toBeVisible();
    }
  });

  test('backend menu tree is rendered from server menus', async ({ page }) => {
    await page.goto('/clob/V1/Role', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('menu').getByText('framework-base', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('menu').getByText('首页', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('menu').getByText('角色管理', { exact: true }),
    ).toBeVisible();
  });

  test('admin proxy page is reachable', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/admin\/index/);
    await expect(page).toHaveURL(/\/admin\/index/);
  });

  test('generated crud pages are reachable', async ({ page }) => {
    const pages = [
      { path: '/clob/V1/AccessLog', title: '访问日志管理' },
      { path: '/clob/V1/Setting', title: '系统设置管理' },
      { path: '/clob/V1/ServicePlugin', title: '服务插件管理' },
    ];

    for (const item of pages) {
      await page.goto(item.path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${item.path}$`));
      await expect(
        page.locator('#__vben_main_content').getByText(item.title, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator('.ant-table-wrapper').first()).toBeVisible();
      await expect(
        page.locator('#__vben_main_content iframe'),
      ).toHaveCount(0);
    }
  });
});
