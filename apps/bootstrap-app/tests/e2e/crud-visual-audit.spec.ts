import { test } from '@playwright/test';

import { firstSimpleCrudPageAdapters } from './simple-crud-lifecycle-adapters';
import {
  createCrudAcceptanceRun,
  loginViaCurrentPasswordChallenge,
} from './support/crud-acceptance';
import {
  captureCrudForm,
  closeFormDialog,
  createCrudVisualAuditDirectory,
  assertPageDisplaySettingsControls,
  isCrudVisualAuditEnabled,
  openCreateForm,
  openDetailForm,
  openEditForm,
  openPageDisplaySettings,
  resolveCrudVisualAuditResource,
} from './support/crud-visual-audit';

test.describe.serial('普通 CRUD 真实表单视觉验收', () => {
  test.skip(
    !isCrudVisualAuditEnabled(),
    '未设置 PLAYWRIGHT_CRUD_VISUAL_AUDIT=1；不会创建任何视觉验收测试数据。',
  );

  test('截图新增、编辑和详情表单，并清理本次 run-id 数据', async ({
    page,
  }, testInfo) => {
    const resource = resolveCrudVisualAuditResource(
      Object.keys(firstSimpleCrudPageAdapters),
    );
    const adapter = firstSimpleCrudPageAdapters[resource];
    if (!adapter) {
      throw new Error(`未找到 ${resource} 的视觉验收适配器`);
    }

    await loginViaCurrentPasswordChallenge(page);

    const run = createCrudAcceptanceRun(testInfo);
    const directory = await createCrudVisualAuditDirectory(resource, run);
    const recoveryLabel = process.env.PLAYWRIGHT_CRUD_VISUAL_RECOVERY_LABEL;
    let record: Awaited<ReturnType<typeof adapter.create>> | undefined;
    let deleted = false;

    try {
      await adapter.open(page, run);

      // 仅用于清理旧版本视觉脚本在“截图已完成但关闭弹窗失败”时遗留的
      // 明确 run-id 记录；不接受普通业务数据作为恢复目标。
      if (recoveryLabel) {
        if (!recoveryLabel.startsWith('e2e-crud-') || !adapter.cleanup) {
          throw new Error('视觉验收恢复只允许删除指定的 e2e-crud run-id 记录。');
        }
        await adapter.cleanup(page, {
          key: recoveryLabel,
          label: recoveryLabel,
        }, run);
        return;
      }

      const settingsDrawer = await openPageDisplaySettings(page);
      await assertPageDisplaySettingsControls(settingsDrawer);
      await captureCrudForm(page, directory, 'page-display-settings');
      await closeFormDialog(page, settingsDrawer);

      const createDialog = await openCreateForm(page);
      await captureCrudForm(page, directory, 'create');
      await closeFormDialog(page, createDialog);

      record = await adapter.create(page, run);

      const editDialog = await openEditForm(page, record);
      await captureCrudForm(page, directory, 'edit');
      await closeFormDialog(page, editDialog);

      const detailDialog = await openDetailForm(page, record);
      await captureCrudForm(page, directory, 'detail');
      await closeFormDialog(page, detailDialog);

      await adapter.delete(page, record, run);
      deleted = true;
    } finally {
      if (record && !deleted && adapter.cleanup) {
        await adapter.cleanup(page, record, run);
      }
    }
  });
});
