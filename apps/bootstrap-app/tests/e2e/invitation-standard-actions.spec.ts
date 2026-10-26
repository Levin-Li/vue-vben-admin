import { expect, test } from '@playwright/test';

import { loginViaCurrentPasswordChallenge } from './support/crud-acceptance';
import { captureFieldPolicyRequests } from './support/field-policy-requests';

test('邀请链接列表按标准 CRUD 展示且不常驻显示签发资格信息', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const policies = captureFieldPolicyRequests(page.context());
  page.on('pageerror', (error) => errors.push(error.message));
  await loginViaCurrentPasswordChallenge(page, { timeout: 90_000 });
  const response = page.waitForResponse((item) =>
    new URL(item.url()).pathname.endsWith('/api/InvitationLink/list'),
  );
  await page.goto('/clob/V1/InvitationLink', { waitUntil: 'domcontentloaded' });
  const listResponse = await response;
  expect(listResponse.ok()).toBe(true);
  await expect(
    page.getByText('邀请目标', { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: '展开', exact: true }).click();
  await expect(page.getByPlaceholder('开始时间')).toBeVisible();
  await expect(page.getByPlaceholder('结束时间')).toBeVisible();
  await expect(page.getByText('到期时间起', { exact: true })).toHaveCount(0);
  await expect(page.getByText('到期时间止', { exact: true })).toHaveCount(0);
  await expect(page.getByText('不能签发邀请链接')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '新增', exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(policies).toEqual([]);
});
