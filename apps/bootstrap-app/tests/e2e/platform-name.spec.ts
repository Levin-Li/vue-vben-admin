import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

test('可绑定按钮和真实来源字段卡片显示三家中文名称', async ({ page }) => {
  const platforms = ['FEISHU', 'WECHAT_ENTERPRISE_V2', 'DINGTALK_V2'];
  // 只替换这两个列表响应验证显示，不声明此用例完成了认证或数据库验收。
  await page.route('**/oauth/getSupportedPlatforms**', (route) =>
    route.fulfill({
      json: {
        successful: true,
        code: 0,
        data: platforms.map((code) => ({ code, name: code })),
      },
    }),
  );
  await page.route('**/oauth/bindings/me**', (route) =>
    route.fulfill({
      json: {
        successful: true,
        code: 0,
        data: platforms.map((sourcePlatform) => ({
          id: sourcePlatform,
          sourcePlatform,
          nickname: '测试成员',
        })),
      },
    }),
  );
  const fixturePath = fileURLToPath(
    new URL('fixtures/social-platform-name.html', import.meta.url),
  );
  const fixtureUrl = `http://127.0.0.1:15666/@fs${fixturePath}`;
  const html = await readFile(fixturePath, 'utf8');
  // 原样读取测试HTML，防止宿主HTML插件注入主应用启动脚本，Vue模块仍由真实Vite编译。
  await page.route(fixtureUrl, (route) =>
    route.fulfill({ contentType: 'text/html', body: html }),
  );
  await page.goto(fixtureUrl);
  for (const name of ['飞书', '企业微信', '钉钉']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    await expect(
      page.locator('.font-medium').filter({ hasText: new RegExp(`^${name}$`) }),
    ).toBeVisible();
  }
  await expect(page.getByText('第三方平台', { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: '/tmp/enterprise-platform-name-browser/platform-names.png',
    fullPage: true,
  });
});
