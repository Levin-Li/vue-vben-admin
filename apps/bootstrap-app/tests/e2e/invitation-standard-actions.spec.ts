import { expect, test } from '@playwright/test';

import { loginViaCurrentPasswordChallenge } from './support/crud-acceptance';
import { captureFieldPolicyRequests } from './support/field-policy-requests';

test('平台账号无签发归属时显示原因且不提供错误的创建入口', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const policies = captureFieldPolicyRequests(page.context());
  page.on('pageerror', (error) => errors.push(error.message));
  await loginViaCurrentPasswordChallenge(page, { timeout: 90_000 });
  const response = page.waitForResponse((item) =>
    new URL(item.url()).pathname.endsWith('/api/InvitationLink/list'),
  );
  await page.goto('/clob/V1/InvitationLink', { waitUntil: 'domcontentloaded' });
  expect((await response).ok()).toBe(true);
  const status = page
    .getByRole('status')
    .filter({ hasText: '不能签发邀请链接' });
  await expect(status).toBeVisible();
  await expect(status).toContainText('当前账号缺少');
  await expect(status.locator('..').locator('.ant-select')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '新增', exact: true }),
  ).toHaveCount(0);
  for (const name of [
    '创建内部用户邀请',
    '创建会员用户邀请',
    '创建客户邀请',
    '创建供应伙伴邀请',
    '创建渠道伙伴邀请',
  ]) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(
      0,
    );
  }
  expect(errors).toEqual([]);
  expect(policies).toEqual([]);
});
