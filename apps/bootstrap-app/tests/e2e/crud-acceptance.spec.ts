import { test } from '@playwright/test';

import { CRUD_SPECIAL_OPERATION_FORM_EXCEPTIONS } from './crud-acceptance-plan';
import { firstSimpleCrudPageAdapters } from './simple-crud-lifecycle-adapters';
import {
  CRUD_ACCEPTANCE_ENABLE_ENV,
  createCrudAcceptanceRun,
  exerciseCrudLifecycle,
  isCrudAcceptanceEnabled,
  loginViaCurrentPasswordChallenge,
  type CrudLifecycleAdapter,
} from './support/crud-acceptance';

/**
 * 真实数据验收必须显式开启，避免开发机或共享环境意外写入数据：
 * PLAYWRIGHT_CRUD_ACCEPTANCE=1 pnpm exec playwright test -c playwright.local.config.ts crud-acceptance
 *
 * 页级改造完成后，把适配器登记到此处；一个适配器只处理标准新增、编辑、删除。
 * CRUD_SPECIAL_OPERATION_FORM_EXCEPTIONS 记录的扩展操作表单不在本套件的改造或验收范围内。
 */
const pageAdapters: Readonly<Record<string, CrudLifecycleAdapter>> =
  firstSimpleCrudPageAdapters;

function selectPageAdapters() {
  const requestedResources = process.env.PLAYWRIGHT_CRUD_RESOURCES?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!requestedResources?.length) {
    return pageAdapters;
  }

  return Object.fromEntries(
    requestedResources.map((resource) => [resource, pageAdapters[resource]]),
  ) as Readonly<Record<string, CrudLifecycleAdapter>>;
}

test.describe.serial('普通 CRUD 真实生命周期验收', () => {
  test.skip(
    !isCrudAcceptanceEnabled(),
    `未设置 ${CRUD_ACCEPTANCE_ENABLE_ENV}=1；真实 CRUD 验收不会在未明确授权时写入数据。`,
  );

  test('所有已登记页面都能新增、编辑、删除并清理测试数据', async ({
    page,
  }, testInfo) => {
    await loginViaCurrentPasswordChallenge(page);

    const run = createCrudAcceptanceRun(testInfo);
    const selectedAdapters = selectPageAdapters();
    const registeredResources = Object.keys(selectedAdapters);

    // 每页要执行真实登录后的新增、编辑、删除和清理；页面数量增长后不能让
    // Playwright 的单测默认上限在中途截断全量验收。
    test.setTimeout(Math.max(60_000, registeredResources.length * 45_000));

    test.skip(
      registeredResources.length === 0,
      '页级适配器尚未登记；此脚手架不会猜测字段或误操作业务数据。',
    );

    for (const resource of registeredResources) {
      const adapter = selectedAdapters[resource];
      if (!adapter) {
        throw new Error(`未找到 ${resource} 的 CRUD 验收适配器`);
      }

      await test.step(`验收 ${resource}`, async () => {
        await exerciseCrudLifecycle(page, adapter, run);
      });
    }
  });
});

// 防止后续维护者误把“扩展操作例外”理解成“整个页面不验收”。
void CRUD_SPECIAL_OPERATION_FORM_EXCEPTIONS;
