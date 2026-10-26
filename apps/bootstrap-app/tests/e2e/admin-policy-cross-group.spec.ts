import { expect, test } from '@playwright/test';

import { loginViaCurrentPasswordChallenge } from './support/crud-acceptance';

test('switching CRUD pages across business groups does not expose field policy internals', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loginViaCurrentPasswordChallenge(page);
  await page.goto('/clob/V1/UserSetting', { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('columnheader', { name: '分组名称' }),
  ).toBeVisible();
  await page.evaluate(() => {
    const errors: string[] = [];
    (window as any).__policyNavigationErrors = errors;
    new MutationObserver(() => {
      for (const item of document.querySelectorAll(
        '.ant-message-notice-content',
      )) {
        const text = item.textContent?.trim() || '';
        if (
          /授权上下文已变化|当前操作未显示或没有权限|API属性组策略不明确/.test(
            text,
          )
        )
          errors.push(text);
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  for (const [group, names] of [
    ['租户&域名', ['根域名管理', '租户管理', '租户站点']],
    ['应用&接入', ['客户端应用', '客服邮箱设置']],
    ['支付&交易', ['支付渠道', '支付订单']],
    ['客户&伙伴', ['客户', '法律主体']],
    ['内容&资源', ['文章管理', '品牌管理']],
    ['基础&设置', ['数据字典', '系统设置']],
  ] as const) {
    await page.getByText(group, { exact: true }).first().dispatchEvent('click');
    for (const name of names) {
      await page
        .getByRole('menuitem', { name, exact: true })
        .dispatchEvent('click');
      await expect(
        page.getByRole('navigation', { name: 'breadcrumb' }),
      ).toContainText(name);
      await page.waitForTimeout(350);
    }
  }
  expect(
    await page.evaluate(() => (window as any).__policyNavigationErrors),
  ).toEqual([]);
});
