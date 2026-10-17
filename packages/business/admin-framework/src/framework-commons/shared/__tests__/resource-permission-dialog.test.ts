/* eslint-disable vue/one-component-per-file -- Isolated UI boundary stubs for dialog persistence. */
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import ResourcePermissionDialog from '../resource-permission-dialog.vue';

const action = 'example:合同::试算';
const group = 'example:属性组:finance:试算';
const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), tree: vi.fn() }));
vi.mock('../../runtime', () => ({
  requestClient: { get: mocks.get, put: mocks.put },
}));
vi.mock('../../app/api/rbac-service', () => ({
  rbacService: {
    fetchAuthorizedPermissionTree: mocks.tree,
    fetchAuthorizedResourceModules: vi.fn().mockResolvedValue([]),
    getAuthorizedMenuList: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('ant-design-vue', () => ({
  Alert: defineComponent({
    props: { message: { type: String, default: '' } },
    template: '<div>{{ message }}</div>',
  }),
  Spin: defineComponent({ template: '<div><slot /></div>' }),
  Modal: defineComponent({
    emits: ['ok', 'cancel'],
    template:
      '<div><slot /><button data-test="save" @click="$emit(\'ok\')">保存</button></div>',
  }),
  message: { success: vi.fn() },
}));
vi.mock('../resource-permission-tree-editor.vue', () => ({
  default: defineComponent({
    name: 'PermissionEditor',
    props: {
      value: { type: Array, default: () => [] },
      permissionTree: { type: Array, default: () => [] },
    },
    template: '<div />',
  }),
}));
enableAutoUnmount(afterEach);

describe('资源授权保存属性组', () => {
  it('回显并通过原permissionList保存组表达式，包含清空强制写入参数', async () => {
    mocks.get.mockResolvedValue({
      id: 'role',
      permissionList: [action, group],
    });
    mocks.put.mockResolvedValue({});
    mocks.tree.mockResolvedValue([
      {
        id: 'action',
        name: '试算',
        nodeType: 'Action',
        permissionExpr: action,
        attrGroups: [
          { name: '财务信息', permissionExpr: group, attributes: ['金额'] },
        ],
      },
    ]);
    const wrapper = mount(ResourcePermissionDialog, {
      props: { open: true, record: { id: 'role' } },
    });
    await flushPromises();
    expect(
      wrapper.findComponent({ name: 'PermissionEditor' }).props('value'),
    ).toEqual([action, group]);
    await wrapper.get('[data-test="save"]').trigger('click');
    await flushPromises();
    expect(mocks.put).toHaveBeenCalledWith('/Role/update', {
      id: 'role',
      permissionList: [action, group],
      autoForceUpdateField: false,
      forceUpdateFields: ['permissionList'],
    });
  });
});
