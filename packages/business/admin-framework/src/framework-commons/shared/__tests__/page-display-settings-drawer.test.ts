import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import PageDisplaySettingsDrawer from '../page-display-settings-drawer.vue';

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

function mountDrawer(saving: boolean) {
  return mount(PageDisplaySettingsDrawer, {
    attachTo: document.body,
    props: {
      code: '/clob/V1/Area',
      fields: [{ key: 'name', label: '名称', search: true }],
      modelValue: { version: 1 },
      open: true,
      saving,
    },
  });
}

function getUploadButton() {
  return Array.from(document.body.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('上传当前配置'),
  ) as HTMLButtonElement;
}

function getTitleAliasInput() {
  return document.body.querySelector(
    'input[placeholder="名称"]',
  ) as HTMLInputElement;
}

function getTab(title: string) {
  return Array.from(document.body.querySelectorAll('[role="tab"]')).find(
    (tab) => tab.textContent?.trim() === title,
  ) as HTMLElement;
}

describe('页面展示设置抽屉', () => {
  it('上传中禁用上传按钮且不重复提交', async () => {
    const wrapper = mountDrawer(true);
    await flushPromises();

    const button = getUploadButton();
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(true);

    button.click();
    await nextTick();
    expect(wrapper.emitted('save')).toBeUndefined();
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('空闲时允许提交当前配置', async () => {
    const wrapper = mountDrawer(false);
    await flushPromises();

    const button = getUploadButton();
    expect(button).toBeTruthy();
    button.click();
    await nextTick();
    expect(wrapper.emitted('save')).toHaveLength(1);
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('在查询页签保存独立字段标题别名', async () => {
    const wrapper = mountDrawer(false);
    await flushPromises();

    const input = getTitleAliasInput();
    expect(input).toBeTruthy();
    input.value = '机构名称';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();

    getUploadButton().click();
    await nextTick();
    expect(wrapper.emitted('save')?.at(-1)?.[0]).toMatchObject({
      config: {
        query: { fields: [{ key: 'name', label: '机构名称' }] },
      },
    });
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('首次打开页签后保留该页签的字段编辑实例', async () => {
    const wrapper = mountDrawer(false);
    await flushPromises();

    const queryAliasInput = getTitleAliasInput();
    expect(queryAliasInput).toBeTruthy();

    getTab('展示列表').click();
    await nextTick();
    expect(getTitleAliasInput()).not.toBe(queryAliasInput);

    getTab('查询表单').click();
    await nextTick();
    expect(getTitleAliasInput()).toBe(queryAliasInput);

    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('默认分组不提供折叠配置，命名分组仍可配置折叠', async () => {
    const wrapper = mountDrawer(false);
    await flushPromises();

    expect(document.body.textContent).not.toContain('组自动折叠行数');

    const addGroupButton = Array.from(
      document.body.querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('添加分组')) as HTMLButtonElement;
    addGroupButton.click();
    await nextTick();

    expect(document.body.textContent).toContain('组自动折叠行数');
    wrapper.unmount();
    document.body.innerHTML = '';
  });
});
