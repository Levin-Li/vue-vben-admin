import { mount } from '@vue/test-utils';
import { message } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import ResourcePermissionTreeEditor from '../resource-permission-tree-editor.vue';

const root = 'module:系统数据-系统菜单:root:展示';
const group = 'module:系统数据-系统菜单:root.reports:展示';
const report = 'module:系统数据-系统菜单:root.reports.sales:展示';
const other = 'module:系统数据-系统菜单:root.reports.other:展示';
const tree = [{ id: '__menus__', name: '系统菜单', nodeType: 'Menu' as const, children: [
  { id: 'root', name: '后台', nodeType: 'Menu' as const, permissionExpr: root, children: [
    { id: 'group', name: '报表中心', nodeType: 'Menu' as const, permissionExpr: group, children: [
      { id: 'report', name: '经营报表', nodeType: 'Menu' as const, permissionExpr: report, remark: '/report/one' },
      { id: 'other', name: '其他报表', nodeType: 'Menu' as const, permissionExpr: other, remark: '/other' },
    ] },
  ] },
] }];

describe('按策略补充菜单祖先权限', () => {
  it('仅选择指定叶菜单与其祖先，不选择兄弟菜单', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, { props: { permissionTree: tree, value: [],
      autoIncludeMenuAncestors: (path: string) => path === '/report/one' } });
    await wrapper.get('[data-test="permission-search"]').setValue('经营报表');
    await wrapper.get('[data-test="permission-node-report"]').setValue(true);
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([report, root, group]);
    wrapper.unmount();
  });

  it('未启用策略或不匹配时保留菜单独立选择', async () => {
    for (const policy of [undefined, (path: string) => path === '/other']) {
      const wrapper = mount(ResourcePermissionTreeEditor, { props: { permissionTree: tree, value: [],
        autoIncludeMenuAncestors: policy } });
      await wrapper.get('[data-test="permission-search"]').setValue('经营报表');
      await wrapper.get('[data-test="permission-node-report"]').setValue(true);
      expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([report]);
      wrapper.unmount();
    }
  });

  it('只补充菜单展示权限，不添加祖先中的其他资源动作', async () => {
    const altered = JSON.parse(JSON.stringify(tree));
    const groupNode = altered[0].children[0].children[0];
    groupNode.children = [{ id: 'unexpected', name: '非菜单权限', nodeType: 'Group',
      permissionExpr: 'module:财务:付款:删除', children: groupNode.children }];
    const wrapper = mount(ResourcePermissionTreeEditor, { props: { permissionTree: altered, value: [],
      autoIncludeMenuAncestors: (path: string) => path === '/report/one' } });
    await wrapper.get('[data-test="permission-search"]').setValue('经营报表');
    await wrapper.get('[data-test="permission-node-report"]').setValue(true);
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([report, root, group]);
    wrapper.unmount();
  });

  it('缺少权威权限树时不从旧菜单树推测祖先权限', async () => {
    const menuTree = [{ id: 'root', name: '后台', moduleId: 'module', children: [
      { id: 'group', name: '报表中心', children: [
        { id: 'report', name: '经营报表', path: '/report/one' },
        { id: 'other', name: '其他报表', path: '/other' },
      ] },
    ] }];
    const wrapper = mount(ResourcePermissionTreeEditor, { props: { menuTree, modules: [{ id: '__menus__', name: '系统菜单', typeList: [] }], value: [],
      autoIncludeMenuAncestors: (path: string) => path === '/report/one' } });
    await wrapper.get('[data-test="permission-search"]').setValue('经营报表');
    const leaf = 'module:系统数据-系统菜单:经营报表:展示';
    await wrapper.get(`[data-test="permission-${leaf}"]`).setValue(true);
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([leaf]);
    wrapper.unmount();
  });

  it('权限树菜单节点为空而界面回退旧菜单树时不推测祖先权限', async () => {
    const warning = vi.spyOn(message, 'warning').mockImplementation(() => undefined as never);
    const menuTree = [{ id: 'root', name: '后台', moduleId: 'module', children: [
      { id: 'group', name: '报表中心', children: [
        { id: 'report', name: '经营报表', path: '/report/one' },
      ] },
    ] }];
    const permissionTree = [{ id: '__menus__', name: '系统菜单', nodeType: 'Module' as const, children: [] }];
    const wrapper = mount(ResourcePermissionTreeEditor, { props: { permissionTree, menuTree, value: [],
      autoIncludeMenuAncestors: (path: string) => path === '/report/one' } });
    await wrapper.get('[data-test="permission-search"]').setValue('经营报表');
    await wrapper.get('[data-test="permission-node-report"]').setValue(true);
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual(['module:系统数据-系统菜单:经营报表:展示']);
    expect(warning).toHaveBeenCalledOnce();
    wrapper.unmount();
    warning.mockRestore();
  });

  it('展示节点与后端叶节点表达式不一致时不补充祖先', async () => {
    const warning = vi.spyOn(message, 'warning').mockImplementation(() => undefined as never);
    const menuTree = [{ id: 'root', name: '后台', moduleId: 'module', children: [
      { id: 'group', name: '报表中心', children: [{ id: 'report', name: '经营报表', path: '/report/one' }] },
    ] }];
    const permissionTree = [{ id: '__menus__', name: '系统菜单', nodeType: 'Module' as const, children: [
      { id: 'container', name: '资源', nodeType: 'Resource' as const, children: tree[0]!.children },
    ] }];
    const wrapper = mount(ResourcePermissionTreeEditor, { props: { permissionTree, menuTree, value: [],
      autoIncludeMenuAncestors: (path: string) => path === '/report/one' } });
    await wrapper.get('[data-test="permission-search"]').setValue('经营报表');
    await wrapper.get('[data-test="permission-node-report"]').setValue(true);
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual(['module:系统数据-系统菜单:经营报表:展示']);
    expect(warning).toHaveBeenCalledOnce();
    wrapper.unmount(); warning.mockRestore();
  });
});
