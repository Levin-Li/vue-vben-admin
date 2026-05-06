import { expect, test } from '@playwright/test';

test.describe('Login Page', () => {
  test('shows verify tabs and current captcha area', async ({ page }) => {
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('tab', { name: '图片验证码' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '手机短信' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '邮箱验证码' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'MFA' })).toBeVisible();

    await expect(
      page.getByPlaceholder('请输入登录账号/手机号/邮箱'),
    ).toBeVisible();
    await expect(page.getByPlaceholder('请输入登录密码')).toBeVisible();
    await expect(page.getByPlaceholder('请输入验证码')).toBeVisible();
    await expect(page.getByAltText('验证码')).toBeVisible();
  });
});
