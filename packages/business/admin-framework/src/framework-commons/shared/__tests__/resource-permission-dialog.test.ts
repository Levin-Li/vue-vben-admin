/* eslint-disable vue/one-component-per-file -- Isolated UI boundary stubs for dialog persistence. */
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import ResourcePermissionDialog from '../resource-permission-dialog.vue';

const action = 'example:合同::试算';
const group = 'example:属性组:finance:试算';
const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), tree: vi.fn() }));
const targetCallbacks = {
  loadTarget: async () => {
    const detail = await mocks.get('/com.levin.oak.base/V1/api/Role/retrieve', {
      baseURL: '',
      params: { id: 'role' },
    });
    return {
      id: detail.id,
      name: detail.name || '角色',
      optimisticLock: detail.optimisticLock,
      permissions: detail.permissionList || [],
    };
  },
  saveTarget: (changes: {
    id: string;
    optimisticLock?: number;
    permissions: string[];
  }) =>
    mocks.put(
      '/com.levin.oak.base/V1/api/Role/update',
      {
        autoForceUpdateField: false,
        forceUpdateFields: ['permissionList'],
        id: changes.id,
        ...(changes.optimisticLock === undefined
          ? {}
          : { optimisticLock: changes.optimisticLock }),
        permissionList: changes.permissions,
      },
      { baseURL: '' },
    ),
};
vi.mock('@vben/runtime/hooks', () => ({
  useAppConfig: () => ({ apiURL: '/com.levin.oak.base/V1/api' }),
}));
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
    name: 'PermissionModal',
    props: { width: { type: String, default: '' } },
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
      autoIncludeMenuAncestors: { type: Function, default: undefined },
    },
    emits: ['update:value'],
    template: '<div />',
  }),
}));
enableAutoUnmount(afterEach);

describe('资源授权保存属性组', () => {
  it('将可选父菜单策略传给编辑器，并保存自动补全的菜单权限', async () => {
    const root = 'module:系统数据-系统菜单:root:展示';
    const groupMenu = 'module:系统数据-系统菜单:root.reports:展示';
    const report = 'module:系统数据-系统菜单:root.reports.sales:展示';
    mocks.tree.mockResolvedValue([{ id: 'root', name: '根菜单', nodeType: 'Menu', permissionExpr: root, children: [
      { id: 'group', name: '报表中心', nodeType: 'Menu', permissionExpr: groupMenu, children: [
        { id: 'report', name: '经营报表', nodeType: 'Menu', permissionExpr: report },
      ] },
    ] }]);
    const saveTarget = vi.fn().mockResolvedValue(undefined);
    const policy = (path: string) => path === '/report/one';
    const wrapper = mount(ResourcePermissionDialog, { props: { open: true, autoIncludeMenuAncestors: policy,
      loadTarget: async () => ({ id: 'role', name: '角色', permissions: [] }), saveTarget } });
    await flushPromises();
    const editor = wrapper.findComponent({ name: 'PermissionEditor' });
    expect(editor.props('autoIncludeMenuAncestors')).toBe(policy);
    editor.vm.$emit('update:value', [report, root, groupMenu]);
    await wrapper.vm.$nextTick();
    await wrapper.get('[data-test="save"]').trigger('click');
    await flushPromises();
    expect(saveTarget).toHaveBeenCalledWith({ id: 'role', permissions: [report, root, groupMenu] });
  });

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
      props: { ...targetCallbacks, open: true },
    });
    await flushPromises();
    expect(
      wrapper.findComponent({ name: 'PermissionModal' }).props('width'),
    ).toBe('max(1080px, 85vw)');
    expect(
      wrapper.findComponent({ name: 'PermissionModal' }).attributes('style'),
    ).toContain('max-width: none');
    expect(mocks.get).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/Role/retrieve',
      { baseURL: '', params: { id: 'role' } },
    );
    expect(
      wrapper.findComponent({ name: 'PermissionEditor' }).props('value'),
    ).toEqual([action, group]);
    await wrapper.get('[data-test="save"]').trigger('click');
    await flushPromises();
    expect(mocks.put).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/Role/update',
      {
        id: 'role',
        permissionList: [action, group],
        autoForceUpdateField: false,
        forceUpdateFields: ['permissionList'],
      },
      { baseURL: '' },
    );
  });
});
