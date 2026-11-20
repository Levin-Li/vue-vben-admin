import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { message } from 'ant-design-vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { externalCrudFormDisplayKey } from '../crud-form-elements';
import DrawerV2 from '../page-display-settings-drawer-v2.vue';
import Drawer from '../page-display-settings-drawer.vue';

vi.mock('../../api', () => ({
  fetchDictOptions: vi.fn().mockResolvedValue([]),
  fetchEnumOptions: vi.fn().mockResolvedValue([]),
  fetchOptions: vi.fn().mockResolvedValue([]),
}));
vi.mock('../config-helpers', () => ({
  OAK_BASE_API_MODULE: 'com.levin.oak.base',
  roleOptionsLoader: vi.fn().mockResolvedValue([]),
}));
vi.mock('../script-workbench-dialog.vue', () => ({
  default: defineComponent({ template: '<div />' }),
}));
afterEach(() => document.body.replaceChildren());
describe.each([
  ['第一版', Drawer],
  ['第二版', DrawerV2],
])('%s表单字段隔离', (_name, Component) => {
  it('同名字段分别登记并保留原标准字段', async () => {
    const wrapper = mount(Component, {
      attachTo: document.body,
      props: {
        code: '/test',
        open: true,
        modelValue: { version: 1 },
        fields: [{ key: 'name', label: '标准名称', form: true }],
        formElements: [
          {
            formId: 'first',
            formName: '第一表单',
            key: 'name',
            label: '名称',
            view: 'create',
            isolateDisplay: true,
          },
          {
            formId: 'second',
            formName: '第二表单',
            key: 'name',
            label: '名称',
            view: 'create',
            isolateDisplay: true,
          },
        ],
      },
    });
    await flushPromises();
    const tab = [
      ...document.body.querySelectorAll<HTMLElement>('[role="tab"]'),
    ].find((item) => item.textContent?.trim() === '新增表单');
    if (!tab) throw new Error('缺少新增表单页签');
    tab.click();
    await flushPromises();
    expect(document.body.textContent).toContain('第一表单 · 名称');
    expect(document.body.textContent).toContain('第二表单 · 名称');
    expect(document.body.textContent).toContain('标准名称');
    expect(externalCrudFormDisplayKey('first', 'name')).not.toEqual(
      externalCrudFormDisplayKey('second', 'name'),
    );
    wrapper.unmount();
  }, 20_000);
});

it('上传专用表单设置并收到相同配置后可以直接关闭', async () => {
  const error = vi.spyOn(message, 'error');
  const wrapper = mount(DrawerV2, {
    attachTo: document.body,
    props: {
      code: '/test', open: true, modelValue: { version: 1 }, fields: [{ key: 'name', label: '名称', form: true, detail: true }], detailFields: [{ key: 'name', label: '名称' }],
      formElements: [{ formId: 'first', formName: '第一表单', key: 'remark', label: '备注', view: 'create', isolateDisplay: true }],
    },
  });
  await flushPromises();
  const tab = [...document.body.querySelectorAll<HTMLElement>('[role="tab"]')].find((item) => item.textContent?.trim() === '新增表单');
  if (!tab) throw new Error('缺少新增表单页签');
  tab.click(); await flushPromises();
  const row = document.body.querySelector<HTMLElement>(`[data-field-key="${externalCrudFormDisplayKey('first', 'remark')}"]`);
  if (!row) throw new Error('缺少表单字段');
  row.click(); await flushPromises();
  const radio = [...document.body.querySelectorAll<HTMLElement>('label')].find((item) => item.textContent?.trim() === '不提');
  if (!radio) throw new Error('缺少隐藏提交选项');
  radio.click(); await flushPromises();
  const upload = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.includes('上传设置'));
  if (!upload) throw new Error('缺少上传按钮');
  upload.click(); await flushPromises();
  const saved = wrapper.emitted('save')?.at(-1)?.[0] as { config: { version: 1 }, scope: Record<string, unknown> } | undefined;
  if (!saved) throw new Error(`设置未提交: ${JSON.stringify(error.mock.calls)}`);
  // PostgreSQL JSONB 返回的对象键顺序可能与提交时不同，但值不变。
  const reorder = (value: any): any => {
    if (Array.isArray(value)) return value.map(reorder);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).toSorted(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, reorder(item)]));
  };
  await wrapper.setProps({ modelValue: reorder(saved.config), initialScope: saved.scope });
  await flushPromises();
  document.body.querySelector<HTMLButtonElement>('.ant-drawer-close')?.click();
  await flushPromises();
  expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
  wrapper.unmount();
}, 20000);
