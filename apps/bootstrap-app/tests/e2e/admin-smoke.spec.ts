import { expect, test } from '@playwright/test';

async function loginWithCurrentCaptcha(page: import('@playwright/test').Page) {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('tab', { name: '密码登录' })).toBeVisible();
  await expect(page.getByPlaceholder('请输入手机号或邮箱')).toBeVisible();
  await expect(page.getByPlaceholder('请输入登录密码')).toBeVisible();

  const verifyInput = page.getByPlaceholder('请输入验证码');
  await expect(verifyInput).toBeVisible();
  await expect.poll(async () => await verifyInput.inputValue()).not.toBe('');

  await page.getByRole('button', { name: '登 录' }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/);
}

test.describe('Admin Smoke', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithCurrentCaptcha(page);
  });

  test('loads core management pages', async ({ page }) => {
    const pages = [
      { path: '/clob/V1/Role', breadcrumb: '角色管理', header: '角色名称' },
      { path: '/clob/V1/Menu', breadcrumb: '菜单管理', header: '新增菜单' },
      { path: '/clob/V1/Org', breadcrumb: '组织管理', header: '机构名称' },
      { path: '/clob/V1/User', breadcrumb: '用户管理', header: '登录名' },
      { path: '/clob/V1/Dict', breadcrumb: '数据字典', header: '字典名称' },
      { path: '/clob/V1/Tenant', breadcrumb: '租户管理', header: '租户名称' },
      { path: '/clob/V1/TenantSite', breadcrumb: '租户站点', header: '站点名称' },
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
        page.locator('#__vben_main_content').getByText(item.header, {
          exact: true,
        }).last(),
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
      { path: '/clob/V1/AccessLog', title: '访问日志', header: '日志ID' },
      { path: '/clob/V1/Setting', title: '系统设置', header: '设置ID' },
      { path: '/clob/V1/ServicePlugin', title: '服务插件', header: '插件ID' },
    ];

    for (const item of pages) {
      await page.goto(item.path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${item.path}$`));
      await expect(
        page.getByRole('navigation', { name: 'breadcrumb' }).getByText(
          item.title,
          {
            exact: true,
          },
        ),
      ).toBeVisible();
      await expect(
        page.locator('#__vben_main_content').getByText(item.header, {
          exact: true,
        }).last(),
      ).toBeVisible();
      await expect(
        page.locator('#__vben_main_content iframe'),
      ).toHaveCount(0);
    }
  });
});
