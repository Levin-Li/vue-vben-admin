import { mkdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { expect } from '@playwright/test';

import {
  rowContainingRunValue,
  type CrudAcceptanceRun,
  type CrudCreatedRecord,
} from './crud-acceptance';

export const CRUD_VISUAL_AUDIT_ENABLE_ENV = 'PLAYWRIGHT_CRUD_VISUAL_AUDIT';
export const CRUD_VISUAL_AUDIT_RESOURCES_ENV =
  'PLAYWRIGHT_CRUD_VISUAL_RESOURCES';
export const CRUD_VISUAL_AUDIT_OUTPUT_DIR_ENV =
  'PLAYWRIGHT_CRUD_VISUAL_OUTPUT_DIR';

export function isCrudVisualAuditEnabled(): boolean {
  return process.env[CRUD_VISUAL_AUDIT_ENABLE_ENV] === '1';
}

/**
 * 每次视觉审计只允许写入一个页面，避免批量创建测试数据。
 */
export function resolveCrudVisualAuditResource(
  availableResources: readonly string[],
): string {
  const requested = String(
    process.env[CRUD_VISUAL_AUDIT_RESOURCES_ENV] || 'Demo',
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (requested.length !== 1) {
    throw new Error(
      `${CRUD_VISUAL_AUDIT_RESOURCES_ENV} 每次只能指定一个页面资源。`,
    );
  }

  const [resource] = requested;
  if (!resource || !availableResources.includes(resource)) {
    throw new Error(`未登记视觉验收适配器：${resource || '(空)'}`);
  }

  return resource;
}

export async function createCrudVisualAuditDirectory(
  resource: string,
  run: CrudAcceptanceRun,
): Promise<string> {
  const root = resolve(
    process.env[CRUD_VISUAL_AUDIT_OUTPUT_DIR_ENV] ||
      'test-results/crud-visual-audit',
  );
  const directory = resolve(root, resource, run.id);
  await mkdir(directory, { recursive: true });
  return directory;
}

export async function captureCrudForm(
  page: Page,
  directory: string,
  name: 'create' | 'detail' | 'edit' | 'page-display-settings',
): Promise<void> {
  const settingsScrollContainer = page
    .locator('[data-test="page-display-settings-scroll"]')
    .last();
  const drawerBody = page
    .locator('.ant-drawer-open .ant-drawer-body')
    .last();
  const modalBody = page
    .getByRole('dialog')
    .last()
    .locator('.ant-modal-body')
    .first();
  const scrollContainer =
    (await settingsScrollContainer.count()) > 0
      ? settingsScrollContainer
      : (await drawerBody.count()) > 0
        ? drawerBody
        : modalBody;

  if (!(await scrollContainer.count())) {
    await page.screenshot({
      fullPage: true,
      path: resolve(directory, `${name}.png`),
    });
    return;
  }

  const { clientHeight, scrollHeight } = await scrollContainer.evaluate(
    (element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }),
  );
  const step = Math.max(clientHeight - 96, 1);
  const positions = Array.from(
    {
      length: Math.max(1, Math.ceil((scrollHeight - clientHeight) / step) + 1),
    },
    (_, index) =>
      Math.min(index * step, Math.max(scrollHeight - clientHeight, 0)),
  );

  for (const [index, scrollTop] of positions.entries()) {
    await scrollContainer.evaluate((element, top) => {
      element.scrollTop = top;
    }, scrollTop);
    await page.waitForTimeout(100);
    await page.screenshot({
      fullPage: true,
      path: resolve(
        directory,
        index === 0 ? `${name}.png` : `${name}-${index + 1}.png`,
      ),
    });
  }

  await scrollContainer.evaluate((element) => {
    element.scrollTop = 0;
  });
}

/**
 * 每个标准页都应向有配置权限的验收账号暴露页面展示设置入口。打开后只修改
 * 内存草稿，不保存，避免视觉验收把默认配置写入用户数据。
 */
export async function openPageDisplaySettings(page: Page): Promise<Locator> {
  const button = page.getByRole('button', { name: '页面展示设置', exact: true });
  await expect(button).toBeVisible();
  await button.click();

  const drawer = page
    .locator('.ant-drawer-open')
    .filter({ hasText: '页面展示设置' })
    .last();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('查询表单', { exact: true })).toBeVisible();
  await expect(drawer.getByText('新增表单', { exact: true })).toBeVisible();
  await expect(drawer.getByText('编辑表单', { exact: true })).toBeVisible();
  await expect(drawer.getByText('详情表单', { exact: true })).toBeVisible();
  return drawer;
}

/** 只读核对四态分段按钮；验收不修改运行时页面配置草稿。 */
export async function assertPageDisplaySettingsControls(
  drawer: Locator,
): Promise<void> {
  const createTab = drawer.getByRole('tab', {
    name: '新增表单',
    exact: true,
  });
  await createTab.click();
  await expect(createTab).toHaveAttribute('aria-selected', 'true');
  const activeContent = drawer.locator('.page-display-settings-tab-content');
  await expect(activeContent.getByText('展提', { exact: true }).first()).toBeVisible();
  await expect(activeContent.getByText('隐提', { exact: true }).first()).toBeVisible();
  await expect(activeContent.getByText('禁提', { exact: true }).first()).toBeVisible();
  await expect(activeContent.getByText('不提', { exact: true }).first()).toBeVisible();

  await expect(createTab).toHaveAttribute('aria-selected', 'true');
}

export async function openCreateForm(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: '新增', exact: true }).click();
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function closeFormDialog(
  page: Page,
  dialog: Locator,
): Promise<void> {
  const drawerClose = dialog.locator('.ant-drawer-close');
  if (await drawerClose.count()) {
    await drawerClose.click();
    await expect(dialog).toBeHidden();
    return;
  }

  const cancel = dialog.getByRole('button', { name: /取\s*消/ });
  if (await cancel.count()) {
    await cancel.click();
  } else {
    const close = dialog.getByRole('button', { name: 'Close', exact: true });
    if (await close.count()) {
      await close.click();
    } else {
      await page.keyboard.press('Escape');
    }
  }
  await expect(dialog).toBeHidden();
}

export async function findAuditedRow(
  page: Page,
  record: CrudCreatedRecord,
): Promise<Locator> {
  const row = rowContainingRunValue(page, record.label);
  await expect(row).toBeVisible();
  return row;
}

export async function openEditForm(
  page: Page,
  record: CrudCreatedRecord,
): Promise<Locator> {
  const row = await findAuditedRow(page, record);
  await row.getByRole('button', { name: '编辑', exact: true }).click();
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function openDetailForm(
  page: Page,
  record: CrudCreatedRecord,
): Promise<Locator> {
  const row = await findAuditedRow(page, record);
  const detailButton = row.getByRole('button', { name: '详情', exact: true });
  if ((await detailButton.count()) === 0) {
    throw new Error(
      `当前页面没有向验收账号展示详情操作，无法生成详情表单截图：${record.label}`,
    );
  }
  await detailButton.click();
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  return dialog;
}

export function describeCrudVisualAuditOutput(directory: string): string {
  return basename(directory);
}
