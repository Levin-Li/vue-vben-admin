import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

import {
  createCrudAcceptanceRun,
  loginViaCurrentPasswordChallenge,
  rowContainingRunValue,
} from './support/crud-acceptance';

test.describe.serial('法律主体最小创建请求诊断', () => {
  test.skip(
    process.env.PLAYWRIGHT_LEGAL_SUBJECT_DIAGNOSTIC !== '1',
    '仅在定位法律主体请求契约时运行。',
  );

  test('最小创建请求能到达后端并清理验收记录', async ({ page }, testInfo) => {
    await loginViaCurrentPasswordChallenge(page);
    const run = createCrudAcceptanceRun(testInfo);
    const name = run.value('法律主体诊断');
    let created = false;

    try {
      await page.goto('/clob/V1/LegalSubject', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '新增', exact: true }).click();
      const modal = page.getByRole('dialog').last();
      await expect(modal).toBeVisible();

      const tenantSelector = modal
        .getByText('请选择归属租户', { exact: true })
        .locator('xpath=ancestor::div[contains(@class, "ant-select-selector")]');
      const tenantInput = tenantSelector.locator('input[role="combobox"]');
      await tenantInput.click();
      const option = page
        .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
        .last()
        .locator('.ant-select-item-option:not(.ant-select-item-option-disabled)')
        .first();
      await expect(option).toBeVisible();
      await option.click();
      await modal.getByPlaceholder('请输入主体名称').fill(name);

      const responsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/LegalSubject/create'),
        { timeout: 20_000 },
      );
      await modal.getByRole('button', { name: /确\s*定/ }).click();
      const response = await responsePromise;
      const responseText = await response.text();
      expect(response.ok(), `创建响应：${responseText}`).toBe(true);
      created = true;
      const row = rowContainingRunValue(page, name);
      await expect(row).toBeVisible();

      await row.getByRole('button', { name: '编辑', exact: true }).click();
      const editModal = page.getByRole('dialog').last();
      await expect(editModal).toBeVisible();
      const updatedName = run.value('法律主体诊断已更新');
      await editModal.getByPlaceholder('请输入主体名称').fill(updatedName);
      const updateRequest = page.waitForRequest(
        (request) =>
          request.method() === 'PUT' &&
          request.url().includes('/LegalSubject/update'),
        { timeout: 5_000 },
      );
      const updateResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          response.url().includes('/LegalSubject/update'),
        { timeout: 20_000 },
      );
      await editModal.getByRole('button', { name: /确\s*定/ }).click();
      const requestObserved = await Promise.race([
        updateRequest.then(() => true).catch(() => false),
        page.waitForTimeout(300).then(() => false),
      ]);
      if (!requestObserved) {
        const messages = await page.locator('.ant-message-notice').allTextContents();
        const invalidFields = await editModal
          .locator('.ant-form-item-has-error')
          .allTextContents();
        const validationErrors = await editModal
          .locator('.ant-form-item-explain-error')
          .allTextContents();
        const invalidControls = await editModal
          .locator('[aria-invalid="true"]')
          .evaluateAll((controls) =>
            controls.map((control) =>
              control.getAttribute('placeholder') || control.getAttribute('aria-label') || control.tagName,
            ),
          );
        await writeFile(
          '/tmp/legal-subject-update-diagnostic.json',
          JSON.stringify({ invalidControls, invalidFields, messages, validationErrors }),
        );
        throw new Error(
          `更新请求未发出：${messages.join(' | ') || '无前端提示'}；校验字段：${[...invalidFields, ...validationErrors, ...invalidControls].join(' | ') || '无'}`,
        );
      }
      const updateResponseResult = await updateResponse;
      const updateResponseText = await updateResponseResult.text();
      await writeFile(
        '/tmp/legal-subject-update-response.json',
        JSON.stringify({ ok: updateResponseResult.ok(), updateResponseText }),
      );
      expect(updateResponseResult.ok(), `更新响应：${updateResponseText}`).toBe(
        true,
      );
    } finally {
      if (created) {
        const row = rowContainingRunValue(page, name);
        if (await row.count()) {
          await row.getByRole('button', { name: '删除', exact: true }).click();
          const confirm = page
            .locator('.ant-popconfirm')
            .filter({ hasText: '确认删除当前记录吗？' })
            .last()
            .getByRole('button', { name: /确\s*定/ });
          const deleteResponsePromise = page.waitForResponse(
            (response) =>
              response.request().method() === 'DELETE' &&
              response.url().includes('/LegalSubject/delete'),
            { timeout: 20_000 },
          );
          await confirm.click();
          const deleteResponse = await deleteResponsePromise;
          const deleteResponseText = await deleteResponse.text();
          expect(deleteResponse.ok(), `删除响应：${deleteResponseText}`).toBe(
            true,
          );
          await expect(page.getByText('删除成功').last()).toBeVisible();
        }
      }
    }
  });
});
