import type { CrudPageDisplayConfig } from '../types';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';

import { Drawer, Form, Modal, Switch, Tooltip } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import { resolveCrudPageDisplayDefaults } from '../crud-page-display';
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

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('缺少预期控件');
  return value;
}

async function mountDrawer(modelValue?: CrudPageDisplayConfig) {
  const wrapper = mount(PageDisplaySettingsDrawer, {
    attachTo: document.body,
    props: {
      code: '/clob/V1/I18nRes',
      detailFields: [{ key: 'name', label: '名称' }],
      fields: [{ key: 'name', label: '名称', table: true }],
      modelValue: modelValue ?? { version: 1 },
      open: false,
      saving: false,
    },
  });
  await wrapper.setProps({ open: true });
  return wrapper;
}

async function openListTab() {
  await flushPromises();
  const tab = [...document.body.querySelectorAll('[role="tab"]')].find(
    (item) => item.textContent?.trim() === '展示列表',
  ) as HTMLElement;
  expect(tab).toBeTruthy();
  tab.click();
  await flushPromises();
}

async function upload() {
  const button = [...document.body.querySelectorAll('button')].find((item) =>
    item.textContent?.includes('上传当前配置'),
  );
  if (!button) throw new Error('缺少上传按钮');
  button.click();
  await nextTick();
}

describe('显示完整分页设置', () => {
  it('缺省关闭自然高度，不修改输入配置', () => {
    const original: CrudPageDisplayConfig = {
      list: { headers: [] },
      version: 1,
    };
    expect(resolveCrudPageDisplayDefaults(original).list).toMatchObject({
      showAllPageRows: false,
    });
    expect(original).toEqual({ list: { headers: [] }, version: 1 });
  });

  it.each([true, false])(
    '保留显式开关值 %s，不修改输入对象',
    (showAllPageRows) => {
      const original: CrudPageDisplayConfig = {
        list: { headers: [], showAllPageRows },
        version: 1,
      };
      const before = structuredClone(original);
      const resolved = resolveCrudPageDisplayDefaults(original);
      expect(resolved.list).toMatchObject(original.list ?? {});
      expect(resolved.list).not.toBe(original.list);
      expect(original).toEqual(before);
    },
  );

  it('开关沿用上传载荷，重新打开回显且允许关闭', async () => {
    const wrapper = await mountDrawer();
    try {
      await openListTab();
      const toggle = () =>
        required(
          wrapper
            .findAllComponents(Form.Item)
            .find((item) => item.props('label') === '显示完整分页'),
        ).findComponent(Switch);
      expect(toggle().props('checked')).toBe(false);
      expect(
        wrapper
          .findAllComponents(Form.Item)
          .some((item) => item.props('label') === '列表正文最小高度'),
      ).toBe(false);
      expect(
        wrapper
          .findAllComponents(Tooltip)
          .some((item) =>
            String(item.props('title')).includes(
              '取消表格内纵向滚动，仅本页内容区域纵向滚动',
            ),
          ),
      ).toBe(true);
      toggle().vm.$emit('update:checked', true);
      await nextTick();
      await upload();
      const payload = wrapper.emitted('save')?.[0]?.[0] as {
        config: CrudPageDisplayConfig;
      };
      expect(payload.config.list).toMatchObject({ showAllPageRows: true });
      expect(payload.config.list).not.toHaveProperty('minBodyHeight');
      expect(payload.config.list).not.toHaveProperty('preserveHeight');
      expect(wrapper.props('modelValue')).toEqual({ version: 1 });
      await wrapper.setProps({ open: false });
      await wrapper.setProps({ modelValue: payload.config, open: true });
      await openListTab();
      expect(toggle().props('checked')).toBe(true);
      toggle().vm.$emit('update:checked', false);
      await nextTick();
      await upload();
      const updated = wrapper.emitted('save')?.[1]?.[0] as {
        config: CrudPageDisplayConfig;
      };
      expect(updated.config.list).toMatchObject({ showAllPageRows: false });
    } finally {
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });
});

describe('页面展示设置上传后的关闭状态', () => {
  it.each(['成功', '失败', '继续修改'])(
    '首次上传%s时正确判断未上传修改',
    async (result) => {
      const confirm = vi
        .spyOn(Modal, 'confirm')
        .mockImplementation(() => ({ destroy: vi.fn(), update: vi.fn() }));
      const wrapper = await mountDrawer();
      try {
        await openListTab();
        const toggle = required(
          wrapper
            .findAllComponents(Form.Item)
            .find((item) => item.props('label') === '显示完整分页'),
        ).findComponent(Switch);
        toggle.vm.$emit('update:checked', true);
        await nextTick();
        await upload();
        const payload = wrapper.emitted('save')?.[0]?.[0] as {
          config: CrudPageDisplayConfig;
        };
        if (result === '继续修改') {
          toggle.vm.$emit('update:checked', false);
          await nextTick();
        }
        if (result !== '失败') {
          await wrapper.setProps({
            modelValue: resolveCrudPageDisplayDefaults(payload.config),
            initialScope: {
              domain: null,
              tenantId: null,
              orgCategory: null,
              orgType: null,
              userCategory: null,
              userType: null,
            } as any,
          });
        }
        wrapper.findComponent(Drawer).vm.$emit('close');
        await nextTick();
        if (result === '成功') {
          expect(confirm).not.toHaveBeenCalled();
          expect(wrapper.emitted('update:open')).toEqual([[false]]);
        } else {
          expect(confirm).toHaveBeenCalledOnce();
          expect(wrapper.emitted('update:open')).toBeUndefined();
        }
      } finally {
        wrapper.unmount();
        confirm.mockRestore();
        document.body.innerHTML = '';
      }
    },
  );
});
