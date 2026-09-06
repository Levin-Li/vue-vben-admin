import type { Locator, Page } from '@playwright/test';

import { expect } from '@playwright/test';

import {
  expectCrudSuccess,
  rowContainingRunValue,
  type CrudAcceptanceRun,
  type CrudCreatedRecord,
  type CrudLifecycleAdapter,
} from './support/crud-acceptance';

interface SimpleCrudDefinition {
  create: (page: Page, run: CrudAcceptanceRun) => Promise<CrudCreatedRecord>;
  route: string;
  update: (
    page: Page,
    record: CrudCreatedRecord,
    run: CrudAcceptanceRun,
  ) => Promise<void>;
}

async function fillFormText(
  modal: Locator,
  placeholder: string,
  value: string,
) {
  const input = modal.getByPlaceholder(placeholder);
  await expect(input).toBeVisible();
  await input.fill(value);
}

async function selectFirstFormOption(
  page: Page,
  modal: Locator,
  placeholder: string,
) {
  const selector = modal
    .getByText(placeholder, { exact: true })
    .locator('xpath=ancestor::div[contains(@class, "ant-select-selector")]');
  const input = selector.locator('input[role="combobox"]');
  await input.click();
  const option = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .last()
    .locator('.ant-select-item-option:not(.ant-select-item-option-disabled)')
    .first();
  await option.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await option.isVisible().catch(() => false)) {
    await option.click();
  } else {
    await input.press('ArrowDown');
    await input.press('Enter');
  }
}

async function selectFirstFormOptionByLabel(
  page: Page,
  modal: Locator,
  label: string,
) {
  const formItem = modal
    .locator('.ant-form-item')
    .filter({ hasText: label })
    .first();
  const input = formItem.locator('input[role="combobox"]');
  await expect(input).toBeVisible();
  await input.click();
  const option = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .last()
    .locator('.ant-select-item-option:not(.ant-select-item-option-disabled)')
    .first();
  await option.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await option.isVisible().catch(() => false)) {
    await option.click();
  } else {
    await input.press('ArrowDown');
    await input.press('Enter');
  }
}

async function selectFirstDistrictCode(page: Page, modal: Locator) {
  const formItem = modal
    .locator('.ant-form-item')
    .filter({ hasText: '区域编码' })
    .first();
  const input = formItem.locator('input[role="combobox"]');
  await expect(input).toBeVisible();
  await input.click();

  for (let level = 0; level < 6; level += 1) {
    const menus = page.locator('.ant-cascader-menu:visible');
    const menu = menus.last();
    const item = menu
      .locator('.ant-cascader-menu-item:not(.ant-cascader-menu-item-disabled)')
      .first();
    await expect(item).toBeVisible();
    await item.click();

    const nextMenuCount = await page
      .locator('.ant-cascader-menu:visible')
      .count();
    if (nextMenuCount <= level + 1) {
      return;
    }
  }

  throw new Error('未能在行政区划级联中选择区县级值');
}

async function disableFormSwitch(modal: Locator, label: string) {
  const formItem = modal
    .locator('.ant-form-item')
    .filter({ hasText: label })
    .first();
  const control = formItem.getByRole('switch');
  await expect(control).toBeVisible();
  if ((await control.getAttribute('aria-checked')) === 'true') {
    await control.click();
  }
}

async function fillCodeEditor(
  page: Page,
  modal: Locator,
  placeholder: string,
  title: string,
  value: string,
) {
  await modal.getByPlaceholder(placeholder).click();
  const editor = page.getByRole('dialog', { name: title });
  await expect(editor).toBeVisible();
  await editor.locator('textarea').fill(value);
  await editor.getByRole('button', { name: /保\s*存/ }).click();
  await expect(editor).toBeHidden();
}

async function fillTags(modal: Locator, label: string, value: string) {
  const formItem = modal
    .locator('.ant-form-item')
    .filter({ hasText: label })
    .first();
  const input = formItem.locator('input').last();
  await expect(input).toBeVisible();
  await input.fill(value);
  await input.press('Enter');
}

async function uploadFormImage(page: Page, modal: Locator, filePath: string) {
  const upload = modal.locator('input[type="file"]').first();
  await expect(upload).toBeAttached();
  await upload.setInputFiles(filePath);
  const cropDialog = page.getByRole('dialog', { name: '图片裁剪' });
  await expect(cropDialog).toBeVisible();
  const response = page.waitForResponse(
    (item) =>
      item.request().method() === 'POST' && item.url().includes('/upload'),
  );
  await cropDialog.getByRole('button', { name: '裁剪并上传' }).click();
  expect((await response).ok()).toBe(true);
}

async function uploadFormFile(page: Page, modal: Locator, filePath: string) {
  const upload = modal.locator('input[type="file"]').first();
  await expect(upload).toBeAttached();
  const response = page.waitForResponse(
    (item) =>
      item.request().method() === 'POST' && item.url().includes('/upload'),
  );
  await upload.setInputFiles(filePath);
  expect((await response).ok()).toBe(true);
}

async function openCreateModal(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: '新增', exact: true }).click();
  const modal = page.getByRole('dialog').last();
  await expect(modal).toBeVisible();
  return modal;
}

async function submitModal(page: Page, modal: Locator, success: string) {
  await modal.getByRole('button', { name: /确\s*定/ }).click();
  await expectCrudSuccess(page, success);
  await expect(modal).toBeHidden();
}

async function editRow(
  page: Page,
  record: CrudCreatedRecord,
): Promise<Locator> {
  const row = rowContainingRunValue(page, record.label);
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '编辑', exact: true }).click();
  const modal = page.getByRole('dialog').last();
  await expect(modal).toBeVisible();
  return modal;
}

async function deleteRow(page: Page, record: CrudCreatedRecord) {
  const row = rowContainingRunValue(page, record.label);
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '删除', exact: true }).click();
  const confirm = page
    .locator('.ant-popconfirm')
    .filter({ hasText: '确认删除当前记录吗？' })
    .last()
    .getByRole('button', { name: /确\s*定/ });
  await expect(confirm).toBeVisible();
  await confirm.click();
  await expectCrudSuccess(page, '删除成功');
  await expect(
    rowContainingRunValue(page, record.label).getByRole('button', {
      name: '删除',
      exact: true,
    }),
  ).toHaveCount(0);
}

function buildSimpleCrudAdapter(
  definition: SimpleCrudDefinition,
): CrudLifecycleAdapter {
  return {
    async cleanup(page, record) {
      const dialog = page.getByRole('dialog').last();
      if (await dialog.isVisible().catch(() => false)) {
        const cancel = dialog.getByRole('button', { name: /取\s*消/ });
        if (await cancel.count()) {
          await cancel.click();
        } else {
          await dialog.getByRole('button', { name: 'Close', exact: true }).click();
        }
        await expect(dialog).toBeHidden();
      }
      const row = rowContainingRunValue(page, record.label);
      if (await row.count()) {
        await deleteRow(page, record);
      }
    },
    async create(page, run) {
      return definition.create(page, run);
    },
    async delete(page, record) {
      await deleteRow(page, record);
    },
    async open(page) {
      await page.goto(definition.route, { waitUntil: 'domcontentloaded' });
      await expect(
        page.getByRole('button', { name: '新增', exact: true }),
      ).toBeVisible();
    },
    async update(page, record, run) {
      await definition.update(page, record, run);
    },
  };
}

function nationAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.id;
      const label = run.value('国家');
      const modal = await openCreateModal(page);
      await fillFormText(modal, '请输入国家码', value);
      await fillFormText(modal, '请输入中文名', label);
      await submitModal(page, modal, '创建成功');
      await page
        .locator('.vben-crud-section .ant-form-item')
        .filter({ hasText: '国家码' })
        .locator('input')
        .fill(value);
      await page.getByRole('button', { name: /查\s*询/ }).click();
      await expect(rowContainingRunValue(page, label)).toBeVisible();
      return { key: value, label };
    },
    route: '/clob/V1/Nation',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('国家已更新');
      await fillFormText(modal, '请输入中文名', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function areaAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const id = run.id;
      const value = run.value('区域');
      const modal = await openCreateModal(page);
      await fillFormText(modal, '请输入区域编码', id);
      await fillFormText(modal, '请输入名称', value);
      await selectFirstFormOptionByLabel(page, modal, '类型');
      await submitModal(page, modal, '创建成功');
      await page
        .locator('.vben-crud-section .ant-form-item')
        .filter({ hasText: '区域编码' })
        .locator('input')
        .fill(id);
      await page.getByRole('button', { name: /查\s*询/ }).click();
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: id, label: value };
    },
    route: '/clob/V1/Area',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('区域已更新');
      await fillFormText(modal, '请输入名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function addressAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('地址收件人');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await selectFirstDistrictCode(page, modal);
      await fillFormText(modal, '请输入业务类型', run.value('地址业务'));
      await fillFormText(modal, '请输入详细地址', run.value('地址内容'));
      await fillFormText(modal, '请输入收寄件人姓名', value);
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/Address',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('地址收件人已更新');
      await fillFormText(modal, '请输入收寄件人姓名', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function customerAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('客户');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入名称', value);
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/Customer',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('客户已更新');
      await fillFormText(modal, '请输入名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function articleChannelAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('文章栏目');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入名称', value);
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/ArticleChannel',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('文章栏目已更新');
      await fillFormText(modal, '请输入名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function demoAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = `https://example.invalid/${run.value('demo')}`;
      const modal = await openCreateModal(page);
      await fillFormText(modal, '请输入普通链接', value);
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/Demo',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = `https://example.invalid/${run.value('demo-updated')}`;
      await fillFormText(modal, '请输入普通链接', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function noticeAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('通知');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入名称', value);
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/Notice',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('通知已更新');
      await fillFormText(modal, '请输入名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function importExportTemplateAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('导入导出模板');
      const code = `crud_${run.id}`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入模板名称', value);
      await fillFormText(modal, '请输入模板编码', code);
      await fillFormText(
        modal,
        '请输入目标业务类型',
        'com.example.CrudAcceptance',
      );
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/ImportExportTemplate',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('导入导出模板已更新');
      await fillFormText(modal, '请输入模板名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function i18nResAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('国际化标签');
      const key = `crud.${run.id}`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入模块ID', 'crud-acceptance');
      await selectFirstFormOption(page, modal, '请选择语言编码');
      await selectFirstFormOption(page, modal, '请选择国家编码');
      await fillFormText(modal, '请输入资源键', key);
      await fillFormText(modal, '请输入标签值', value);
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key, label: value };
    },
    route: '/clob/V1/I18nRes',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('国际化标签已更新');
      await fillFormText(modal, '请输入标签值', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function socialUserAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('社交用户');
      const uid = `crud-${run.id}`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入来源平台', value);
      await fillFormText(modal, '请输入第三方用户标识', uid);
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: uid, label: value };
    },
    route: '/clob/V1/SocialUser',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('社交用户已更新');
      await fillFormText(modal, '请输入来源平台', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function openAreaAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = `${run.id}.crud-acceptance.invalid`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择所属租户');
      await fillFormText(modal, '请输入域名', value);
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/OpenArea',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = `${run.value('开放区域')}.invalid`;
      await fillFormText(modal, '请输入域名', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function servicePluginSettingAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = `${run.id}.crud-acceptance.invalid`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await selectFirstFormOption(page, modal, '请选择服务插件');
      await selectFirstFormOption(page, modal, '请先选择服务插件');
      await fillFormText(modal, '请输入域名', value);
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/ServicePluginSetting',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = `${run.value('服务插件设置')}.invalid`;
      await fillFormText(modal, '请输入域名', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function legalSubjectAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('法律主体');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入主体名称', value);
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/LegalSubject',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('法律主体已更新');
      await fillFormText(modal, '请输入主体名称', updated);
      const updateResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          response.url().includes('/LegalSubject/update'),
        { timeout: 20_000 },
      );
      await modal.getByRole('button', { name: /确\s*定/ }).click();
      const response = await updateResponse;
      const responseText = await response.text();
      expect(response.ok(), `法律主体更新响应：${responseText}`).toBe(true);
      await expectCrudSuccess(page, '更新成功');
      await expect(modal).toBeHidden();
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function jobPostAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('工作岗位');
      const code = `crud-${run.id}`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入编码', code);
      await fillFormText(modal, '请输入名称', value);
      await selectFirstFormOption(page, modal, '请选择类型');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: code, label: value };
    },
    route: '/clob/V1/JobPost',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('工作岗位已更新');
      await fillFormText(modal, '请输入名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function fundAccountAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('资金账户');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入账户名称', value);
      await selectFirstFormOption(page, modal, '请选择货币类型');
      await selectFirstFormOption(page, modal, '请选择货币代码');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/FundAccount',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('资金账户已更新');
      await fillFormText(modal, '请输入账户名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function dictAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收字典');
      const code = `crud_${run.id}`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入字典名称', value);
      await fillFormText(modal, '请输入字典编码', code);
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: code, label: value };
    },
    route: '/clob/V1/Dict',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收字典已更新');
      await fillFormText(modal, '请输入字典名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function trafficControlRuleAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收限流规则');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入规则名称', value);
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/TrafficControlRule',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收限流规则已更新');
      await fillFormText(modal, '请输入规则名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function urlExAclAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收访问规则');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入名称', value);
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/UrlExAcl',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收访问规则已更新');
      await fillFormText(modal, '请输入名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function scheduledTaskAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收调度任务');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入名称', value);
      await fillFormText(modal, '请输入任务分类', 'crud-acceptance');
      await fillFormText(modal, '请输入任务组', run.id);
      await fillCodeEditor(
        page,
        modal,
        '点击编辑 Groovy 脚本',
        '编辑 Groovy 脚本',
        'return null',
      );
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/ScheduledTask',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收调度任务已更新');
      await fillFormText(modal, '请输入名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function clientAppAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收客户端应用');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await selectFirstFormOption(page, modal, '请选择所属组织');
      await fillFormText(modal, '请输入应用名称', value);
      await selectFirstFormOption(page, modal, '请选择绑定服务账号');
      await fillTags(modal, '允许访问路径', `/crud-acceptance/${run.id}`);
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/ClientApp',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收客户端应用已更新');
      await fillFormText(modal, '请输入应用名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function articleAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收文章');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await selectFirstFormOption(page, modal, '请选择所属组织');
      await fillFormText(modal, '请输入标题', value);
      await fillFormText(modal, '请输入资讯类别', 'crud-acceptance');
      await selectFirstFormOption(page, modal, '请选择内容类型');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/Article',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收文章已更新');
      await fillFormText(modal, '请输入标题', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function uiSettingAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收界面设置');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入名称', value);
      await fillFormText(modal, '请输入设置项编码', `crud.${run.id}`);
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/UiSetting',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收界面设置已更新');
      await fillFormText(modal, '请输入名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function userSettingAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收用户设置');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await selectFirstFormOption(page, modal, '请选择所属用户');
      await fillFormText(modal, '请输入编码', `crud.${run.id}`);
      await fillFormText(modal, '请输入分类名称', value);
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/UserSetting',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收用户设置已更新');
      await fillFormText(modal, '请输入分类名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function settingAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收系统设置');
      const id = `crud.${run.id}`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入设置ID', id);
      await fillFormText(modal, '请输入名称', value);
      await fillFormText(modal, '请输入编码', id);
      await fillFormText(modal, '请输入分类名称', 'crud-acceptance');
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: id, label: value };
    },
    route: '/clob/V1/Setting',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收系统设置已更新');
      await fillFormText(modal, '请输入名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function fundExchangeRuleAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收兑换规则');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入名称', value);
      await selectFirstFormOption(page, modal, '请选择原货币类型');
      await selectFirstFormOption(page, modal, '请选择原货币代码');
      await fillFormText(modal, '请输入原货币数量', '1');
      await selectFirstFormOption(page, modal, '请选择目标货币类型');
      await selectFirstFormOption(page, modal, '请选择目标货币代码');
      await fillFormText(modal, '请输入目标货币数量', '1');
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/FundExchangeRule',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收兑换规则已更新');
      await fillFormText(modal, '请输入名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function tenantAppAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收租户应用');
      const code = `crud-${run.id}`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入名称', value);
      await fillFormText(modal, '请输入应用编码', code);
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: code, label: value };
    },
    route: '/clob/V1/TenantApp',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收租户应用已更新');
      await fillFormText(modal, '请输入名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function tenantAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收平台租户');
      const modal = await openCreateModal(page);
      await fillFormText(modal, '请输入租户名称', value);
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/Tenant',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收平台租户已更新');
      await fillFormText(modal, '请输入租户名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function roleAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收角色');
      const code = `R_CRUD_${run.id.replaceAll('-', '_')}`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入角色名称', value);
      await fillFormText(modal, '请输入角色编码', code);
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/Role',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收角色已更新');
      await fillFormText(modal, '请输入角色名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function orgAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收组织');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入机构名称', value);
      await selectFirstFormOption(page, modal, '请选择机构类别');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/Org',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收组织已更新');
      await fillFormText(modal, '请输入机构名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function userAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收用户');
      const loginName = `crud_${run.id.replaceAll('-', '_')}`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入名称', value);
      await fillFormText(modal, '请输入登录名', loginName);
      await fillFormText(
        modal,
        '新增时设置初始密码；编辑时留空表示不修改',
        'Aa123456!',
      );
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/User',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收用户已更新');
      await fillFormText(modal, '请输入名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function noticeProcessLogAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收通知处理备注');
      const noticeId = `notice-${run.id}`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await selectFirstFormOption(page, modal, '请选择所属组织');
      await selectFirstFormOption(page, modal, '请选择所属用户');
      await fillFormText(modal, '请输入通知ID', noticeId);
      await selectFirstFormOption(page, modal, '请选择处理状态');
      await fillFormText(modal, '请输入备注', value);
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, noticeId)).toBeVisible();
      return { key: noticeId, label: noticeId };
    },
    route: '/clob/V1/NoticeProcessLog',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = `notice-updated-${run.id}`;
      await fillFormText(modal, '请输入通知ID', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function payChannelAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收支付通道');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await fillFormText(modal, '请输入通道名称', value);
      await selectFirstFormOption(page, modal, '请选择类别');
      await selectFirstFormOption(page, modal, '请选择货币类型');
      await selectFirstFormOption(page, modal, '请选择支付提供商');
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/PayChannel',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收支付通道已更新');
      await fillFormText(modal, '请输入通道名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function partnerAdapter(): CrudLifecycleAdapter {
  const adapter = buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收合作伙伴');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await selectFirstFormOption(page, modal, '请选择所属组织');
      await selectFirstFormOption(page, modal, '请选择所属用户');
      await fillFormText(modal, '请输入主体名称', value);
      await selectFirstFormOptionByLabel(page, modal, '类别');
      await selectFirstFormOptionByLabel(page, modal, '子类别');
      await fillFormText(
        modal,
        '请输入18位统一社会信用码',
        '91350211M000100Y43',
      );
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/Partner',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收合作伙伴已更新');
      await fillFormText(modal, '请输入主体名称', updated);
      const responsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          response.url().includes('/Partner/updatePartner'),
      );
      await modal.getByRole('button', { name: /确\s*定/ }).click();
      const response = await responsePromise;
      const responseText = await response.text();
      expect(response.ok(), `合作伙伴更新响应：${responseText}`).toBe(true);
      await expectCrudSuccess(page, '更新成功');
      await expect(modal).toBeHidden();
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });

  return {
    ...adapter,
    async delete(page, record) {
      const row = rowContainingRunValue(page, record.label);
      await expect(row).toBeVisible();
      await row.getByRole('button', { name: '删除', exact: true }).click();
      const confirm = page
        .locator('.ant-popconfirm')
        .filter({ hasText: '确认删除当前记录吗？' })
        .last()
        .getByRole('button', { name: /确\s*定/ });
      const responsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'DELETE' &&
          response.url().includes('/Partner/delete'),
      );
      await confirm.click({ force: true });
      const response = await responsePromise;
      expect(response.ok(), `合作伙伴删除响应：${await response.text()}`).toBe(
        true,
      );
      await expect(rowContainingRunValue(page, record.label)).toHaveCount(0);
    },
  };
}

function domainAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = `${run.id}.crud-acceptance.invalid`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择所属租户');
      await fillFormText(modal, '请输入根域名', value);
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/Domain',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = `${run.value('根域名更新')}.invalid`;
      await fillFormText(modal, '请输入备注', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, record.label)).toBeVisible();
    },
  });
}

function brandAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收品牌');
      const modal = await openCreateModal(page);
      await selectFirstFormOptionByLabel(page, modal, '归属租户');
      await selectFirstFormOptionByLabel(page, modal, '所属组织');
      await fillFormText(modal, '请输入品牌名称', value);
      await uploadFormImage(
        page,
        modal,
        '/Users/lilw/IdeaProjects/levin-framework-base/frontend/admin/apps/bootstrap-app/public/mock-files/mock-upload.png',
      );
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/Brand',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收品牌已更新');
      await fillFormText(modal, '请输入品牌名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function electronicContractTemplateAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收合同模板');
      const templateNo = `crud-${run.id}`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await selectFirstFormOption(page, modal, '请选择所属组织');
      await selectFirstFormOption(page, modal, '请选择所属用户');
      await fillFormText(modal, '请输入模板编号', templateNo);
      await fillFormText(modal, '请输入模板名称', value);
      await fillFormText(modal, '请输入类别', 'crud-acceptance');
      await fillFormText(modal, '请输入模板文件名', 'crud-acceptance.docx');
      await fillFormText(
        modal,
        '请输入模板文件链接',
        `https://example.invalid/${run.id}.docx`,
      );
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/EContractTemplate',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收合同模板已更新');
      await fillFormText(modal, '请输入模板名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function fileResAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收文件资源');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择归属租户');
      await selectFirstFormOption(page, modal, '请选择所属组织');
      await selectFirstFormOption(page, modal, '请选择所属用户');
      await fillFormText(modal, '请输入文件名称', value);
      await fillFormText(modal, '请输入业务类型', 'crud-acceptance');
      await selectFirstFormOption(page, modal, '请选择文件类型');
      await uploadFormFile(
        page,
        modal,
        '/Users/lilw/IdeaProjects/levin-framework-base/frontend/admin/apps/bootstrap-app/public/mock-files/mock-upload.png',
      );
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/FileRes',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收文件资源已更新');
      await fillFormText(modal, '请输入文件名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function emailRelayRouteAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收邮件路由');
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择所属租户');
      await fillFormText(modal, '请输入路由名称', value);
      await fillFormText(modal, '请输入邮件域名', `${run.id}.invalid`);
      await fillFormText(modal, '请输入邮箱别名', `route-${run.id.slice(-8)}`);
      await selectFirstFormOption(page, modal, '请选择提供商');
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/EmailRelayRoute',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收邮件路由已更新');
      await fillFormText(modal, '请输入路由名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function rbacPermissionItemAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = run.value('验收权限操作');
      const modal = await openCreateModal(page);
      await fillFormText(modal, '请输入资源域', `crud.${run.id}`);
      await fillFormText(modal, '请输入资源类型', 'Acceptance');
      await fillFormText(modal, '请输入操作', value);
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/RbacPermissionItem',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = run.value('验收权限操作已更新');
      await fillFormText(modal, '请输入操作', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

function domainSslCertAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = `${run.id}.ssl-crud.invalid`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择所属租户');
      await fillFormText(modal, '请输入证书域名', value);
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: value, label: value };
    },
    route: '/clob/V1/DomainSslCert',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      await fillFormText(modal, '请输入备注', run.value('SSL元数据更新'));
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, record.label)).toBeVisible();
    },
  });
}

function tenantSiteAdapter(): CrudLifecycleAdapter {
  return buildSimpleCrudAdapter({
    async create(page, run) {
      const value = `site-${run.id.slice(-12)}`;
      const domain = `${run.id}.crud-acceptance.invalid`;
      const modal = await openCreateModal(page);
      await selectFirstFormOption(page, modal, '请选择所属租户');
      await selectFirstFormOption(page, modal, '请选择所属组织');
      await fillFormText(modal, '请输入站点名称', value);
      await fillTags(modal, '完整域名', domain);
      await disableFormSwitch(modal, '是否启用');
      await submitModal(page, modal, '创建成功');
      await expect(rowContainingRunValue(page, value)).toBeVisible();
      return { key: domain, label: value };
    },
    route: '/clob/V1/TenantSite',
    async update(page, record, run) {
      const modal = await editRow(page, record);
      const updated = `site-u-${run.id.slice(-10)}`;
      await fillFormText(modal, '请输入站点名称', updated);
      await submitModal(page, modal, '更新成功');
      await expect(rowContainingRunValue(page, updated)).toBeVisible();
      record.label = updated;
    },
  });
}

export const firstSimpleCrudPageAdapters: Readonly<
  Record<string, CrudLifecycleAdapter>
> = {
  Address: addressAdapter(),
  Area: areaAdapter(),
  ArticleChannel: articleChannelAdapter(),
  Article: articleAdapter(),
  Brand: brandAdapter(),
  ClientApp: clientAppAdapter(),
  Customer: customerAdapter(),
  Demo: demoAdapter(),
  Domain: domainAdapter(),
  DomainSslCert: domainSslCertAdapter(),
  Dict: dictAdapter(),
  EmailRelayRoute: emailRelayRouteAdapter(),
  ElectronicContractTemplate: electronicContractTemplateAdapter(),
  FileRes: fileResAdapter(),
  FundAccount: fundAccountAdapter(),
  FundExchangeRule: fundExchangeRuleAdapter(),
  I18nRes: i18nResAdapter(),
  ImportExportTemplate: importExportTemplateAdapter(),
  JobPost: jobPostAdapter(),
  LegalSubject: legalSubjectAdapter(),
  Nation: nationAdapter(),
  Notice: noticeAdapter(),
  NoticeProcessLog: noticeProcessLogAdapter(),
  OpenArea: openAreaAdapter(),
  PayChannel: payChannelAdapter(),
  Partner: partnerAdapter(),
  Org: orgAdapter(),
  Role: roleAdapter(),
  RbacPermissionItem: rbacPermissionItemAdapter(),
  SocialUser: socialUserAdapter(),
  ScheduledTask: scheduledTaskAdapter(),
  ServicePluginSetting: servicePluginSettingAdapter(),
  Setting: settingAdapter(),
  TrafficControlRule: trafficControlRuleAdapter(),
  TenantApp: tenantAppAdapter(),
  Tenant: tenantAdapter(),
  TenantSite: tenantSiteAdapter(),
  UrlExAcl: urlExAclAdapter(),
  UiSetting: uiSettingAdapter(),
  User: userAdapter(),
  UserSetting: userSettingAdapter(),
};

/**
 * 这些页面的验收仍在推进；条目只说明尚未接入通用浏览器适配器的具体前提，
 * 不构成页面自身新增、编辑、删除的豁免。
 */
export const firstSimpleCrudPageBlockers = {
  EmailRelayRoute:
    '记录绑定外部邮件提供商与 DNS/Webhook 语义，普通 CRUD 验收不能假设创建只影响本地数据。',
  JobPost:
    '新增同时依赖归属租户和远程枚举类型；先复用已验证的租户选择与枚举适配器后再接入。',
  LegalSubject:
    '新增表单包含多个必填嵌套信息组及图片字段，不能用简化数据绕过真实合同。',
  RbacPermissionItem:
    '临时权限项会影响当前授权注册表和缓存，不能作为普通无副作用的 CRUD 验收数据。',
} as const;
