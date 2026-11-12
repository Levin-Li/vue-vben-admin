import { expect, test } from '@playwright/test';

import {
  isCrudAcceptanceEnabled,
  loginViaCurrentPasswordChallenge,
} from './support/crud-acceptance';

test('上传页面路由在短视口首次打开和重开时显示表格', async ({ page }) => {
  test.skip(!isCrudAcceptanceEnabled(), '需要隔离本地环境的平台超管登录态');
  await page.setViewportSize({ width: 1700, height: 345 });
  await loginViaCurrentPasswordChallenge(page);

  // 上传入口由平台超管的用户菜单提供；仅打开弹窗，不提交菜单。
  async function openDialog() {
    await page.getByText('平台超管', { exact: true }).last().click();
    await page
      .getByText('上传页面路由', { exact: true })
      .filter({ visible: true })
      .first()
      .click();

    const grid = page.locator('.sync-menu-route-tree-grid');
    await expect(
      grid.getByRole('columnheader', { name: '名称' }),
    ).toBeVisible();
    await expect(grid.locator('.vxe-body--row').first()).toBeVisible();
    await expect(page.getByText(/共\s*\d+\s*个已启用前端模块/)).toBeVisible();
  }

  await openDialog();
  await page
    .getByRole('button', { name: /取\s*消/ })
    .last()
    .click();
  await expect(page.locator('.sync-menu-route-tree-grid')).toHaveCount(0);
  await openDialog();
});
