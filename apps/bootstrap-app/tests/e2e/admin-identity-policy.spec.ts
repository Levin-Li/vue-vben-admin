import { expect, test } from '@playwright/test';

import { loginViaCurrentPasswordChallenge } from './support/crud-acceptance';

test('organization, user, and role pages load their lists and create forms', async ({
  page,
}) => {
  await loginViaCurrentPasswordChallenge(page);

  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  for (const item of [
    { path: '/clob/V1/Org', title: '组织管理', column: '名称' },
    { path: '/clob/V1/User', title: '用户管理', column: '登录名' },
    { path: '/clob/V1/Role', title: '角色管理', column: '角色名称' },
  ]) {
    await page.goto(item.path, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('navigation', { name: 'breadcrumb' }),
    ).toContainText(item.title);
    await expect(
      page.getByRole('columnheader', { name: new RegExp(item.column) }).first(),
    ).toBeVisible();
    const listResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`${item.path.split('/').at(-1)}/list`) &&
        response.request().method() === 'GET',
    );
    await page
      .getByRole('button', { name: /查\s*询/ })
      .first()
      .click();
    const response = await listResponse;
    expect(response.status()).toBe(200);
    await expect(
      page.getByRole('button', { name: '新增' }).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: '新增' }).first().click();
    await expect(page.getByRole('dialog').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('API属性组策略不明确')).toHaveCount(0);
  }

  expect(errors).toEqual([]);
});

test('switching cached user management tabs does not report an unavailable field policy', async ({
  page,
}) => {
  await loginViaCurrentPasswordChallenge(page);
  await page.goto('/clob/V1/UserSetting', { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('columnheader', { name: '分组名称' }),
  ).toBeVisible();

  for (let index = 0; index < 3; index++) {
    await page.getByRole('menuitem', { name: '用户管理' }).click();
    await expect(page).toHaveURL(/\/clob\/V1\/User$/);
    await page.getByRole('menuitem', { name: '用户设置' }).click();
    await expect(page).toHaveURL(/\/clob\/V1\/UserSetting$/);
    await expect(
      page.getByText('当前操作未显示或没有权限，不能读取字段策略'),
    ).toHaveCount(0);
  }
});

test('switching identity administration pages does not expose stale policy cancellations', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await loginViaCurrentPasswordChallenge(page);
  await page.goto('/clob/V1/UserSetting', { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('columnheader', { name: '分组名称' }),
  ).toBeVisible();
  await page.evaluate(() => {
    const errors: string[] = [];
    (window as any).__policyNavigationErrors = errors;
    new MutationObserver(() => {
      for (const notice of document.querySelectorAll(
        '.ant-message-notice-content',
      )) {
        const text = notice.textContent?.trim() || '';
        if (
          /授权上下文已变化|当前操作未显示或没有权限|API属性组策略不明确/.test(
            text,
          )
        )
          errors.push(text);
      }
    }).observe(document.body, { childList: true, subtree: true });
  });

  for (const name of [
    '菜单管理',
    '组织管理',
    '权限项定义',
    '角色管理',
    '社交用户',
    '用户管理',
    '用户设置',
    '邀请链接',
    '组织与用户',
  ]) {
    await page
      .getByRole('menuitem', { name, exact: true })
      .dispatchEvent('click');
    await expect(
      page.getByRole('navigation', { name: 'breadcrumb' }),
    ).toContainText(name);
    await page.waitForTimeout(350);
  }

  expect(
    await page.evaluate(() => (window as any).__policyNavigationErrors),
  ).toEqual([]);
});
