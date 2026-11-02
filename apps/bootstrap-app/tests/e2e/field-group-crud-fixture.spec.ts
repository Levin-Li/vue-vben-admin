import type { APIRequestContext } from '@playwright/test';

import process from 'node:process';

import { expect, test } from '@playwright/test';

/**
 * 本脚本只连接显式提供的回环隔离夹具，不访问业务数据库：
 * 1. 在独立后端副本运行 FieldGroupBrowserFixtureTest，指定 field.group.ui.fixture、portFile 与 stopFile。
 * 2. 用 field-group-proxy.py 指向该端口，并启动已按仓库规则刷新依赖的本地 Vite。
 * 3. 设置 FIELD_GROUP_UI_PORT 和 FIELD_GROUP_UI_PROXY 后运行本测试。
 * 账号通过测试请求头模拟；角色计算和字段契约由真实后端组件完成，记录保存在夹具内存。
 */
const port = process.env.FIELD_GROUP_UI_PORT || '';
const proxy = process.env.FIELD_GROUP_UI_PROXY || '';
const backend = `http://127.0.0.1:${port}`;
async function fixtureState(request: APIRequestContext) {
  const response = await request.get(`${backend}/fixture/state`);
  return response.json();
}

test.describe.serial('字段组的真实 HTTP 与公共 CRUD 闭环', () => {
  test.skip(
    !/^\d{2,5}$/.test(port) || !/^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(proxy),
    '须显式提供回环测试服务与代理',
  );
  test('无权字段不展示、不编辑，直接提交由后端拒绝', async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${proxy}/?port=${port}&actor=reader&proxy=1`);
    await expect(page.getByText('隔离测试账号：reader')).toBeVisible();
    await expect(page.getByText('初始标题')).toBeVisible();
    await expect(page.getByText('合同金额', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '详情', exact: true }).click();
    await expect(page.getByText('合同详情')).toBeVisible();
    await expect(page.getByText('合同金额', { exact: true })).toHaveCount(0);
    await page
      .getByRole('button', { name: /关闭|取消/ })
      .last()
      .click();
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    await expect(page.locator('[data-crud-form-field="amount"]')).toHaveCount(
      0,
    );
    await page.getByRole('button', { name: '取 消' }).last().click();
    await page.getByRole('button', { name: '新增' }).click();
    await expect(page.locator('[data-crud-form-field="amount"]')).toHaveCount(
      0,
    );
    await page.getByRole('button', { name: '取 消' }).last().click();
    const before = await fixtureState(request);
    for (const [method, path, data] of [
      ['GET', '/fixture/ui/contracts/list?amount=999', undefined],
      [
        'POST',
        '/fixture/ui/contracts/create',
        { title: '无权新增', amount: '999' },
      ],
      [
        'POST',
        '/fixture/ui/contracts/update',
        { id: 'c1', optimisticLock: 1, amount: '999' },
      ],
    ] as const) {
      const response = await request.fetch(`${backend}${path}`, {
        method,
        headers: { 'X-Fixture-User': 'reader' },
        ...(data ? { data } : {}),
      });
      expect(response.status(), `${method} ${path}`).toBe(403);
    }
    const after = await fixtureState(request);
    expect(after.calls).toEqual(before.calls);
    expect(after.contract).toEqual(before.contract);
    expect(errors).toEqual([]);
  });
  test('有权账号可查询、展示、新增和编辑该字段', async ({ page, request }) => {
    await request.post(`${backend}/fixture/reset`);
    await page.goto(`${proxy}/?port=${port}&actor=writer&proxy=1`);
    await expect(page.getByText('隔离测试账号：writer')).toBeVisible();
    await expect(page.getByText('初始标题')).toBeVisible();
    await expect(
      page.getByText('合同金额', { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText('100.00', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '详情', exact: true }).click();
    await expect(page.getByText('合同详情')).toBeVisible();
    await expect(
      page.getByText('合同金额', { exact: true }).last(),
    ).toBeVisible();
    await page
      .getByRole('button', { name: /关闭|取消/ })
      .last()
      .click();
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    await expect(page.locator('[data-crud-form-field="amount"]')).toBeVisible();
    await page.locator('[data-crud-form-field="amount"] input').fill('150.00');
    await page.getByRole('button', { name: '确 定' }).last().click();
    await expect
      .poll(async () => {
        const state = await fixtureState(request);
        return state.contract.amount;
      })
      .toBe('150.00');
    await page.getByRole('button', { name: '新增' }).click();
    await expect(page.locator('[data-crud-form-field="amount"]')).toBeVisible();
    await page.locator('[data-crud-form-field="title"] input').fill('新增合同');
    await page.locator('[data-crud-form-field="amount"] input').fill('200.00');
    await page.getByRole('button', { name: '确 定' }).last().click();
    await expect
      .poll(async () => {
        const state = await fixtureState(request);
        return state.contract.amount;
      })
      .toBe('200.00');
  });
});
