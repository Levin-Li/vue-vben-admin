import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from '@vue/test-utils';

import { IconifyIcon } from '@vben/icons';

import { afterEach, describe, expect, it } from 'vitest';

import ResourcePermissionTreeEditor from '../resource-permission-tree-editor.vue';

enableAutoUnmount(afterEach);

const modules = [
  {
    id: 'framework-base',
    name: 'framework-base',
    typeList: [
      {
        id: 'menu',
        name: '菜单',
        resList: [
          {
            id: 'simple-page',
            name: '简单页面',
            actionList: [
              {
                action: '批量删除',
                label: '批量删除',
                permissionExpr: 'framework-base:菜单:简单页面:批量删除',
              },
              {
                action: '查询列表',
                label: '查询列表',
                permissionExpr: 'framework-base:菜单:简单页面:查询列表',
              },
            ],
          },
        ],
      },
    ],
  },
];

describe('资源权限树编辑器', () => {
  it('keeps a filtered parent permission expression when saving its subtree', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: '__menus__',
            name: '系统菜单',
            nodeType: 'Menu',
            children: [
              {
                id: 'backend-management',
                name: '后台管理',
                nodeType: 'Menu',
                permissionExpr:
                  'framework-base:系统数据-系统菜单:后台管理:展示',
                children: [
                  {
                    id: 'backend-management:query',
                    name: '查询列表',
                    nodeType: 'Action',
                    permissionExpr:
                      'framework-base:系统数据-系统菜单:后台管理:查询列表',
                  },
                ],
              },
            ],
          },
        ],
        value: [],
      },
    });

    await wrapper.get('[data-test="permission-search"]').setValue('查询列表');
    await wrapper
      .get('[data-test="permission-node-backend-management"]')
      .setValue(true);

    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual(
      expect.arrayContaining([
        'framework-base:系统数据-系统菜单:后台管理:展示',
        'framework-base:系统数据-系统菜单:后台管理:查询列表',
      ]),
    );
  });

  it('取消最后一个子权限时保留已有菜单展示权限', async () => {
    const parentPermission = 'framework-base:系统数据-系统菜单:后台管理:展示';
    const childPermission =
      'framework-base:系统数据-系统菜单:后台管理:查询列表';
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: '__menus__',
            name: '系统菜单',
            nodeType: 'Menu',
            children: [
              {
                id: 'backend-management',
                name: '后台管理',
                nodeType: 'Menu',
                permissionExpr: parentPermission,
                children: [
                  {
                    id: 'backend-management:query',
                    name: '查询列表',
                    nodeType: 'Action',
                    permissionExpr: childPermission,
                  },
                ],
              },
            ],
          },
        ],
        value: [parentPermission, childPermission],
      },
    });

    await wrapper
      .get(`[data-test="permission-${childPermission}"]`)
      .setValue(false);

    const nextPermissions = wrapper
      .emitted('update:value')
      ?.at(-1)?.[0] as string[];
    expect(nextPermissions).toEqual([parentPermission]);
    await wrapper.setProps({ value: nextPermissions });
    expect(
      (
        wrapper.get('[data-test="permission-node-backend-management"]')
          .element as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it('selects a parent permission when a child permission is selected', async () => {
    const parentPermission = 'framework-base:系统数据-系统菜单:后台管理:展示';
    const childPermission =
      'framework-base:系统数据-系统菜单:后台管理:查询列表';
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: '__menus__',
            name: '系统菜单',
            nodeType: 'Menu',
            children: [
              {
                id: 'backend-management',
                name: '后台管理',
                nodeType: 'Menu',
                permissionExpr: parentPermission,
                children: [
                  {
                    id: 'backend-management:query',
                    name: '查询列表',
                    nodeType: 'Action',
                    permissionExpr: childPermission,
                  },
                ],
              },
            ],
          },
        ],
        value: [],
      },
    });

    await wrapper
      .get(`[data-test="permission-${childPermission}"]`)
      .setValue(true);

    const nextPermissions = wrapper
      .emitted('update:value')
      ?.at(-1)?.[0] as string[];
    expect(nextPermissions).toEqual(
      expect.arrayContaining([parentPermission, childPermission]),
    );
    await wrapper.setProps({ value: nextPermissions });
    expect(
      (
        wrapper.get('[data-test="permission-node-backend-management"]')
          .element as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it('marks module, type, and resource parents as indeterminate when one child action is selected', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        modules,
        value: ['framework-base:菜单:简单页面:批量删除'],
      },
    });

    const indeterminateBoxes = wrapper.findAll('.ant-checkbox-indeterminate');

    expect(indeterminateBoxes.length).toBeGreaterThanOrEqual(3);
    expect(wrapper.text()).toContain('菜单');
    expect(wrapper.text()).toContain('简单页面');
  });

  it('includes a menu permission together with its child operations', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        menuTree: [
          {
            id: 'framework-base',
            label: 'framework-base',
            moduleId: 'framework-base',
            children: [
              {
                id: 'access-log',
                label: '访问日志',
                moduleId: 'framework-base',
                opButtonList: [
                  {
                    label: '查看详情',
                    opName: 'view-detail',
                    requireAuthorizations: [
                      'framework-base:系统数据-系统菜单:访问日志:查看详情',
                    ],
                  },
                  {
                    label: '更新',
                    opName: 'update',
                    requireAuthorizations: [
                      'framework-base:系统数据-系统菜单:访问日志:更新',
                    ],
                  },
                ],
              },
            ],
          },
        ],
        modules: [
          {
            id: '__menus__',
            name: '系统菜单',
            typeList: [
              {
                id: '系统菜单',
                name: '系统菜单',
                resList: [
                  {
                    id: '访问日志',
                    name: '访问日志',
                    actionList: [
                      {
                        action: '查看详情',
                        label: '查看详情',
                        permissionExpr:
                          'framework-base:系统数据-系统菜单:访问日志:查看详情',
                      },
                      {
                        action: '更新',
                        label: '更新',
                        permissionExpr:
                          'framework-base:系统数据-系统菜单:访问日志:更新',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        value: [
          'framework-base:系统数据-页面操作:access-log:view-detail',
          'framework-base:系统数据-系统菜单:访问日志:查看详情',
        ],
      },
    });

    expect(wrapper.text()).toContain('访问日志');
    expect(wrapper.text()).toContain('1/3');
  });

  it('renders menu operations as simple checkbox items instead of prominent buttons', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        menuTree: [
          {
            id: 'framework-base',
            label: 'framework-base',
            moduleId: 'framework-base',
            children: [
              {
                id: 'access-log',
                label: '访问日志',
                moduleId: 'framework-base',
                opButtonList: [
                  {
                    label: '查看详情',
                    opName: 'view-detail',
                    requireAuthorizations: [
                      'framework-base:系统数据-系统菜单:访问日志:查看详情',
                    ],
                  },
                ],
              },
            ],
          },
        ],
        modules: [
          {
            id: '__menus__',
            name: '系统菜单',
            typeList: [
              {
                id: '系统菜单',
                name: '系统菜单',
                resList: [
                  {
                    id: '访问日志',
                    name: '访问日志',
                    actionList: [
                      {
                        action: '查看详情',
                        label: '查看详情',
                        permissionExpr:
                          'framework-base:系统数据-系统菜单:访问日志:查看详情',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        value: [],
      },
    });

    const operation = wrapper.get(
      '[data-test="permission-framework-base:系统数据-页面操作:access-log:view-detail"]',
    );

    expect(operation.element.tagName).not.toBe('BUTTON');
    expect(operation.attributes('aria-pressed')).toBeUndefined();
  });

  it('renders visual guide lines for nested system menu nodes', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        menuTree: [
          {
            id: 'framework-base',
            label: 'framework-base',
            moduleId: 'framework-base',
            children: [
              {
                id: 'nested',
                label: '菜单',
                moduleId: 'framework-base',
                children: [
                  {
                    id: 'address',
                    label: '地址',
                    moduleId: 'framework-base',
                    opButtonList: [
                      {
                        label: '更新',
                        opName: 'update-address',
                        requireAuthorizations: [
                          'framework-base:系统数据-系统菜单:地址:更新',
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        modules: [
          {
            id: '__menus__',
            name: '系统菜单',
            typeList: [
              {
                id: '系统菜单',
                name: '系统菜单',
                resList: [
                  {
                    id: '地址',
                    name: '地址',
                    actionList: [
                      {
                        action: '更新',
                        label: '更新',
                        permissionExpr:
                          'framework-base:系统数据-系统菜单:地址:更新',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        value: [],
      },
    });

    expect(wrapper.findAll('.border-l.border-dashed').length).toBeGreaterThan(
      0,
    );
    expect(wrapper.findAll('.border-t.border-dashed').length).toBeGreaterThan(
      0,
    );
    expect(wrapper.findAll('.border-l.border-t.border-dashed').length).toBe(0);
  });

  it('keeps menu guide branch width aligned with the node indent step', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        menuTree: [
          {
            id: 'framework-base',
            label: 'framework-base',
            moduleId: 'framework-base',
            children: [
              {
                id: 'nested',
                label: '菜单',
                moduleId: 'framework-base',
                children: [
                  {
                    id: 'address',
                    label: '地址',
                    moduleId: 'framework-base',
                    opButtonList: [
                      {
                        label: '更新',
                        opName: 'update-address',
                        requireAuthorizations: [
                          'framework-base:系统数据-系统菜单:地址:更新',
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        modules: [
          {
            id: '__menus__',
            name: '系统菜单',
            typeList: [
              {
                id: '系统菜单',
                name: '系统菜单',
                resList: [
                  {
                    id: '地址',
                    name: '地址',
                    actionList: [
                      {
                        action: '更新',
                        label: '更新',
                        permissionExpr:
                          'framework-base:系统数据-系统菜单:地址:更新',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        value: [],
      },
    });

    const branchLines = wrapper
      .findAll('.border-t.border-dashed')
      .map((item) => item.attributes('style') || '');

    expect(branchLines.some((style) => style.includes('width: 36px'))).toBe(
      true,
    );
    expect(wrapper.html()).not.toContain('width: 24px');
  });

  it('defaults system menu tree to the second menu level and expands deeper nodes on demand', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        menuTree: [
          {
            id: 'framework-base',
            label: 'framework-base',
            moduleId: 'framework-base',
            children: [
              {
                id: 'menu',
                label: '菜单',
                moduleId: 'framework-base',
                children: [
                  {
                    id: 'nested-address',
                    label: '地址',
                    moduleId: 'framework-base',
                    children: [
                      {
                        id: 'nested-address-detail',
                        label: '地址详情',
                        moduleId: 'framework-base',
                        opButtonList: [
                          {
                            label: '更新',
                            opName: 'update-address-detail',
                            requireAuthorizations: [
                              'framework-base:系统数据-系统菜单:地址详情:更新',
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        modules: [
          {
            id: '__menus__',
            name: '系统菜单',
            typeList: [
              {
                id: '系统菜单',
                name: '系统菜单',
                resList: [
                  {
                    id: '地址详情',
                    name: '地址详情',
                    actionList: [
                      {
                        action: '更新',
                        label: '更新',
                        permissionExpr:
                          'framework-base:系统数据-系统菜单:地址详情:更新',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        value: [],
      },
    });

    expect(wrapper.text()).toContain('framework-base');
    expect(wrapper.text()).toContain('菜单');
    expect(wrapper.text()).toContain('地址');
    expect(wrapper.text()).not.toContain('地址详情');

    const expandButton = wrapper.get(
      '[data-test="permission-menu-expand-nested-address"]',
    );

    expect(expandButton.attributes('aria-expanded')).toBe('false');

    await expandButton.trigger('click');

    expect(wrapper.text()).toContain('地址详情');
    expect(expandButton.attributes('aria-expanded')).toBe('true');
  });

  it('renders pure permission tree nodes without depending on module organization', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: 'root',
            name: '后台权限',
            nodeType: 'Group',
            remark: '权限分组',
            children: [
              {
                id: 'role-list',
                name: '角色列表',
                nodeType: 'Permission',
                permissionExpr: 'com.levin.oak.base:系统数据-角色::查询列表',
              },
            ],
          },
        ],
        value: ['com.levin.oak.base:系统数据-角色::*'],
      },
    });

    expect(wrapper.text()).toContain('后台权限');
    expect(wrapper.text()).toContain('角色列表');
    expect(wrapper.find('[title="权限分组"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="permission-node-root"]').exists()).toBe(
      false,
    );
    expect(wrapper.get('[data-test="permission-root-tab-root"]').exists()).toBe(
      true,
    );
    expect(wrapper.findAll('.ant-checkbox-checked').length).toBeGreaterThan(0);
  });

  it('uses permission tree label before name without displaying remark', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: '__menus__',
            label: '系统菜单展示',
            name: '系统菜单',
            nodeType: 'Menu',
            children: [
              {
                id: 'address-menu',
                label: '地址管理',
                name: '地址',
                nodeType: 'Menu',
                permissionExpr:
                  'com.levin.oak.base:系统数据-系统菜单:地址:展示',
                remark: '/clob/V1/Address',
              },
            ],
          },
        ],
        value: [],
      },
    });

    expect(wrapper.text()).toContain('系统菜单展示');
    expect(wrapper.text()).toContain('地址管理');
    expect(wrapper.text()).not.toContain('地址 0/1');
    expect(wrapper.find('[title="/clob/V1/Address"]').exists()).toBe(false);
    expect(wrapper.get('[title="地址管理"]').exists()).toBe(true);
  });

  it('falls back to permission tree name when label is empty', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: '__menus__',
            name: '系统菜单',
            nodeType: 'Menu',
            children: [
              {
                id: 'address-menu',
                label: '',
                name: '地址',
                nodeType: 'Menu',
                permissionExpr:
                  'com.levin.oak.base:系统数据-系统菜单:地址:展示',
                remark: '/clob/V1/Address',
              },
            ],
          },
        ],
        value: [],
      },
    });

    expect(wrapper.text()).toContain('地址');
    expect(wrapper.find('[title="/clob/V1/Address"]').exists()).toBe(false);
    expect(wrapper.get('[title="地址"]').exists()).toBe(true);
  });

  it('keeps the backend menu permission tree when it already uses the new node structure', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        menuTree: [
          {
            id: 'legacy-role',
            label: '旧菜单角色',
            moduleId: 'framework-base',
            name: '旧菜单角色',
            opButtonList: [
              {
                label: '旧操作',
                opName: 'legacy-operation',
                requireAuthorizations: [
                  'framework-base:系统数据-系统菜单:旧角色:旧操作',
                ],
              },
            ],
          },
        ],
        permissionTree: [
          {
            id: '__menus__',
            label: '系统菜单',
            name: '系统菜单',
            nodeType: 'Menu',
            children: [
              {
                id: 'address-menu',
                label: '地址管理',
                name: '地址',
                nodeType: 'Menu',
                permissionExpr:
                  'com.levin.oak.base:系统数据-系统菜单:地址:展示',
                remark: '/clob/V1/Address',
              },
            ],
          },
        ],
        value: [],
      },
    });

    expect(wrapper.text()).toContain('地址管理');
    expect(wrapper.text()).not.toContain('旧菜单角色');
    expect(wrapper.find('[title="/clob/V1/Address"]').exists()).toBe(false);
    expect(wrapper.get('[title="地址管理"]').exists()).toBe(true);
  });

  it('uses first-level pure permission tree nodes as tabs', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: 'menus',
            name: '系统菜单',
            nodeType: 'Menu',
            children: [
              {
                id: 'base-menu',
                name: 'framework-base',
                nodeType: 'Resource',
                permissionExpr: 'framework-base:系统数据-系统菜单:展示',
              },
            ],
          },
          {
            id: 'resources',
            name: 'framework-base',
            nodeType: 'Module',
            children: [
              {
                id: 'role-list',
                name: '角色列表',
                nodeType: 'Permission',
                permissionExpr: 'framework-base:角色:查询',
              },
            ],
          },
        ],
        value: [],
      },
    });

    expect(
      wrapper.get('[data-test="permission-root-tab-menus"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-test="permission-root-tab-resources"]').exists(),
    ).toBe(true);
    expect(wrapper.find('[data-test="permission-node-menus"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain('framework-base');
    expect(wrapper.text()).not.toContain('角色列表');

    await wrapper
      .get('[data-test="permission-root-tab-resources"]')
      .trigger('click');

    expect(wrapper.text()).toContain('角色列表');
    expect(
      wrapper.find('[data-test="permission-node-resources"]').exists(),
    ).toBe(false);
  });

  it('renders Action and Permission nodes horizontally by node type and ignores their children', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: 'resources',
            name: 'framework-base',
            nodeType: 'Module',
            children: [
              {
                id: 'page',
                name: '在线代码生成',
                nodeType: 'Resource',
                children: [
                  {
                    id: 'page-generate',
                    name: '生成百度 Amis 页面',
                    nodeType: 'Action',
                    permissionExpr: 'framework-base:页面:生成',
                    children: [
                      {
                        id: 'hidden-child',
                        name: '隐藏子权限',
                        nodeType: 'Permission',
                        permissionExpr: 'framework-base:页面:隐藏',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        value: ['framework-base:页面:隐藏'],
      },
    });

    expect(wrapper.text()).toContain('在线代码生成');
    expect(wrapper.text()).toContain('生成百度 Amis 页面');
    expect(wrapper.text()).not.toContain('隐藏子权限');
    expect(
      wrapper.get('[data-test="permission-framework-base:页面:生成"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-test="permission-node-page-generate"]').exists(),
    ).toBe(false);
    expect(
      wrapper
        .find('[data-test="permission-framework-base:页面:隐藏"]')
        .exists(),
    ).toBe(false);
    expect(wrapper.text()).toContain('已选 0');
    expect(wrapper.text()).toContain('未选 1');
  });

  it('flattens untitled organization shell nodes in the pure permission tree', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: 'resources',
            name: 'framework-base',
            nodeType: 'Module',
            children: [
              {
                id: 'simple-page-type',
                name: '简单页面',
                nodeType: 'ResourceType',
                children: [
                  {
                    id: '',
                    name: '',
                    nodeType: 'Resource',
                    children: [
                      {
                        id: 'simple-page-query',
                        name: '查询列表',
                        nodeType: 'Action',
                        permissionExpr: 'framework-base:简单页面:查询列表',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        value: [],
      },
    });

    expect(wrapper.text()).toContain('简单页面');
    expect(wrapper.text()).toContain('查询列表');
    expect(wrapper.find('[data-test="permission-node-"]').exists()).toBe(false);
    expect(
      wrapper.findAll('[data-test="permission-node-simple-page-type"]'),
    ).toHaveLength(1);
    expect(
      wrapper
        .get('[data-test="permission-framework-base:简单页面:查询列表"]')
        .exists(),
    ).toBe(true);
  });

  it('keeps the menu layout and renders module tabs recursively inside pure tree tabs', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: '__menus__',
            name: '系统菜单',
            nodeType: 'Menu',
            children: [
              {
                id: 'framework-base-menu',
                name: 'framework-base',
                nodeType: 'Menu',
                permissionExpr:
                  'framework-base:系统数据-系统菜单:framework-base:展示',
                children: [
                  {
                    id: 'role-menu',
                    name: '角色管理',
                    nodeType: 'Menu',
                    permissionExpr:
                      'framework-base:系统数据-系统菜单:角色管理:展示',
                    children: [
                      {
                        id: 'role-menu:op:assign',
                        name: '分配权限',
                        nodeType: 'Action',
                        permissionExpr:
                          'framework-base:系统数据-系统菜单:角色管理:分配权限',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'framework-base',
            name: 'framework-base',
            nodeType: 'Module',
            children: [
              {
                id: 'domain',
                name: '业务域',
                nodeType: 'Group',
                children: [
                  {
                    id: 'feature',
                    name: '功能分组',
                    nodeType: 'Group',
                    children: [
                      {
                        id: 'role-list',
                        name: '角色列表',
                        nodeType: 'Resource',
                        children: [
                          {
                            id: 'role-query',
                            name: '查询',
                            nodeType: 'Action',
                            permissionExpr: 'framework-base:角色:查询',
                          },
                          {
                            id: 'role-assign',
                            name: '分配权限',
                            nodeType: 'Permission',
                            permissionExpr: 'framework-base:角色:分配权限',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        value: [],
      },
    });

    expect(wrapper.text()).toContain('framework-base');
    expect(wrapper.text()).toContain('角色管理');
    expect(wrapper.text()).toContain('分配权限');
    expect(
      wrapper
        .get('[data-test="permission-tree-expand-framework-base-menu"]')
        .exists(),
    ).toBe(true);
    expect(
      wrapper
        .get(
          '[data-test="permission-framework-base:系统数据-系统菜单:角色管理:分配权限"]',
        )
        .exists(),
    ).toBe(true);

    await wrapper
      .get('[data-test="permission-root-tab-framework-base"]')
      .trigger('click');

    expect(wrapper.text()).toContain('业务域');
    expect(wrapper.text()).toContain('功能分组');

    await wrapper
      .get('[data-test="permission-tree-expand-feature"]')
      .trigger('click');

    expect(wrapper.text()).toContain('角色列表');
    expect(wrapper.text()).toContain('查询');
    expect(wrapper.text()).toContain('分配权限');
    expect(
      wrapper.find('[data-test="permission-node-role-query"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-test="permission-node-role-assign"]').exists(),
    ).toBe(false);
    expect(
      wrapper.get('[data-test="permission-framework-base:角色:查询"]').exists(),
    ).toBe(true);
    expect(
      wrapper
        .get('[data-test="permission-framework-base:角色:分配权限"]')
        .exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-test="permission-tree-expand-role-list"]').exists(),
    ).toBe(false);
    expect(wrapper.text()).not.toContain('简单页面');
  });

  it('normalizes menu data into the same permission tree template when pure tree mode is active', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        menuTree: [
          {
            id: 'framework-base-menu',
            label: 'framework-base',
            moduleId: 'framework-base',
            children: [
              {
                id: 'role-menu',
                label: '角色管理',
                moduleId: 'framework-base',
                opButtonList: [
                  {
                    label: '分配权限',
                    opName: 'assign-permissions',
                    requireAuthorizations: [
                      'framework-base:系统数据-系统菜单:角色管理:分配权限',
                    ],
                  },
                ],
              },
            ],
          },
        ],
        modules: [
          {
            id: '__menus__',
            name: '系统菜单',
            typeList: [
              {
                id: '系统菜单',
                name: '系统菜单',
                resList: [
                  {
                    id: '角色管理',
                    name: '角色管理',
                    actionList: [
                      {
                        action: '分配权限',
                        label: '分配权限',
                        permissionExpr:
                          'framework-base:系统数据-系统菜单:角色管理:分配权限',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        permissionTree: [
          {
            id: '__menus__',
            name: '系统菜单',
            nodeType: 'Menu',
            children: [
              {
                id: 'legacy-shell',
                name: '菜单',
                nodeType: 'ResourceType',
                children: [
                  {
                    id: 'legacy-default',
                    name: '默认',
                    nodeType: 'Resource',
                    permissionExpr: 'legacy:menu:default',
                  },
                ],
              },
            ],
          },
          {
            id: 'framework-base',
            name: 'framework-base',
            nodeType: 'Module',
            children: [],
          },
        ],
        value: [],
      },
    });

    expect(wrapper.text()).toContain('framework-base');
    expect(wrapper.text()).toContain('角色管理');
    expect(wrapper.text()).toContain('分配权限');
    expect(wrapper.text()).not.toContain('默认');
    expect(
      wrapper.find('[data-test="permission-menu-expand-role-menu"]').exists(),
    ).toBe(false);
    expect(
      wrapper
        .find('[data-test="permission-tree-expand-framework-base-menu"]')
        .exists(),
    ).toBe(true);
    expect(
      wrapper
        .find(
          '[data-test="permission-framework-base:系统数据-页面操作:role-menu:assign-permissions"]',
        )
        .exists(),
    ).toBe(true);
  });

  it('summarizes selected and unselected permissions for the active pure tree tab', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: 'menus',
            name: '系统菜单',
            nodeType: 'Menu',
            children: [
              {
                id: 'menu-view',
                name: '菜单展示',
                nodeType: 'Permission',
                permissionExpr: 'framework-base:系统数据-系统菜单:展示',
              },
            ],
          },
          {
            id: 'resources',
            name: 'framework-base',
            nodeType: 'Module',
            children: [
              {
                id: 'role-list',
                name: '角色列表',
                nodeType: 'Resource',
                children: [
                  {
                    id: 'role-query',
                    name: '查询',
                    nodeType: 'Action',
                    permissionExpr: 'framework-base:角色:查询',
                  },
                  {
                    id: 'role-update',
                    name: '更新',
                    nodeType: 'Action',
                    permissionExpr: 'framework-base:角色:更新',
                  },
                ],
              },
            ],
          },
        ],
        value: ['framework-base:角色:查询'],
      },
    });

    expect(wrapper.text()).toContain('已选 0');
    expect(wrapper.text()).toContain('未选 1');

    await wrapper
      .get('[data-test="permission-root-tab-resources"]')
      .trigger('click');

    expect(wrapper.text()).toContain('已选 1');
    expect(wrapper.text()).toContain('未选 1');
  });

  it('does not use remark as the pure tree node hover title or saved permission', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: 'org-only',
            name: '组织分组',
            nodeType: 'Group',
            children: [
              {
                id: 'child-org-only',
                name: '仅组织',
                nodeType: 'Group',
                remark: '这里只负责组织节点',
                children: [],
              },
            ],
          },
        ],
        value: [],
      },
    });

    expect(wrapper.find('[title="这里只负责组织节点"]').exists()).toBe(false);
    expect(wrapper.get('[title="仅组织"]').exists()).toBe(true);

    await wrapper
      .get('[data-test="permission-node-child-org-only"]')
      .trigger('click');

    expect(wrapper.emitted('update:value')).toBeUndefined();
  });
});

const sharedPermission = '基础模块:团队管理::新增';
const queryPermission = '基础模块:团队管理::查询';
const menuPermission = '基础模块:菜单:团队管理:展示';
const sharedPermissionTree = [
  {
    id: 'menus',
    name: '系统菜单',
    nodeType: 'Menu',
    children: [
      {
        id: 'team-menu',
        name: '团队管理',
        nodeType: 'Menu',
        permissionExpr: menuPermission,
        children: [
          {
            id: 'menu-add',
            name: '新增',
            nodeType: 'Action',
            permissionExpr: sharedPermission,
            resourcePermissions: [
              {
                id: 'resource-add',
                name: '基础模块 / 团队资源 / 新增',
                nodeType: 'Action',
                permissionExpr: sharedPermission,
              },
            ],
          },
          {
            id: 'menu-add-copy',
            name: '快捷新增',
            nodeType: 'Action',
            permissionExpr: sharedPermission,
            resourcePermissions: [
              {
                id: 'resource-add',
                name: '基础模块 / 团队资源 / 新增',
                nodeType: 'Action',
                permissionExpr: sharedPermission,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'resources',
    name: '基础模块',
    nodeType: 'Module',
    children: [
      {
        id: 'team-resource',
        name: '团队资源',
        nodeType: 'Resource',
        children: [
          {
            id: 'resource-add',
            name: '新增',
            nodeType: 'Action',
            permissionExpr: sharedPermission,
          },
          {
            id: 'resource-query',
            name: '查询',
            nodeType: 'Action',
            permissionExpr: queryPermission,
          },
        ],
      },
    ],
  },
];

function mountSharedPermissions(value: string[] = []) {
  return mount(ResourcePermissionTreeEditor, {
    props: { permissionTree: sharedPermissionTree, value },
    attachTo: document.body,
  });
}

async function applyPermissionUpdate(
  wrapper: ReturnType<typeof mountSharedPermissions>,
) {
  const next = wrapper.emitted('update:value')?.at(-1)?.[0] as string[];
  expect(next).toBeDefined();
  await wrapper.setProps({ value: next });
  return next;
}

function sharedCheckboxes(wrapper: ReturnType<typeof mountSharedPermissions>) {
  return wrapper.findAll<HTMLInputElement>(
    `[data-test="permission-${sharedPermission}"]`,
  );
}

function sharedCheckbox(
  wrapper: ReturnType<typeof mountSharedPermissions>,
  index = 0,
) {
  const checkbox = sharedCheckboxes(wrapper)[index];
  if (!checkbox) {
    throw new Error(`未找到第 ${index + 1} 个共享权限复选框`);
  }
  return checkbox;
}

function findVisibleDialog() {
  return new DOMWrapper(document.body)
    .findAll('[role="dialog"]')
    .find((dialog) => dialog.isVisible());
}

function getVisibleDialog() {
  const dialog = findVisibleDialog();
  if (!dialog) throw new Error('未找到可见弹窗');
  return dialog;
}

async function cancellationDialog() {
  await flushPromises();
  const dialog = getVisibleDialog();
  expect(dialog.text()).toContain('确认取消操作权限');
  return dialog;
}

async function pressCancellationButton(label: string) {
  const dialog = await cancellationDialog();
  const button = dialog
    .findAll('button')
    .find((item) => item.text().replaceAll(/\s/g, '') === label);
  if (!button) throw new Error(`未找到取消授权弹窗按钮：${label}`);
  await button.trigger('click');
  await flushPromises();
}

async function confirmOperationCancellation() {
  await pressCancellationButton('确认');
}

describe('权限表达式共享状态', () => {
  it('同一页签的重复元素及跨页签勾选取消同步且结果去重', async () => {
    const wrapper = mountSharedPermissions();
    expect(sharedCheckboxes(wrapper)).toHaveLength(2);
    await sharedCheckbox(wrapper, 0).setValue(true);
    const selected = await applyPermissionUpdate(wrapper);
    expect(selected.filter((item) => item === sharedPermission)).toHaveLength(
      1,
    );
    expect(
      sharedCheckboxes(wrapper).every((item) => item.element.checked),
    ).toBe(true);

    await wrapper
      .get('[data-test="permission-root-tab-resources"]')
      .trigger('click');
    expect(sharedCheckbox(wrapper, 0).element.checked).toBe(true);
    await sharedCheckbox(wrapper, 0).setValue(false);
    expect(await applyPermissionUpdate(wrapper)).toEqual([menuPermission]);
    await wrapper
      .get('[data-test="permission-root-tab-menus"]')
      .trigger('click');
    expect(
      sharedCheckboxes(wrapper).every((item) => !item.element.checked),
    ).toBe(true);

    await sharedCheckbox(wrapper, 1).setValue(true);
    await applyPermissionUpdate(wrapper);
    await sharedCheckbox(wrapper, 0).setValue(false);
    await confirmOperationCancellation();
    await applyPermissionUpdate(wrapper);
    expect(
      sharedCheckboxes(wrapper).every((item) => !item.element.checked),
    ).toBe(true);
    await wrapper
      .get('[data-test="permission-root-tab-resources"]')
      .trigger('click');
    expect(sharedCheckbox(wrapper, 0).element.checked).toBe(false);
    wrapper.unmount();
  });

  it('取消菜单中的子操作不会新增原本未授予的菜单展示权限', async () => {
    const wrapper = mountSharedPermissions([sharedPermission]);
    await sharedCheckbox(wrapper, 0).setValue(false);
    await confirmOperationCancellation();
    expect(await applyPermissionUpdate(wrapper)).toEqual([]);
    expect(
      wrapper.get<HTMLInputElement>('[data-test="permission-node-team-menu"]')
        .element.checked,
    ).toBe(false);
    wrapper.unmount();
  });

  it.each(['permission-node-team-menu', 'permission-tree-toggle'])(
    '通过 %s 批量取消会同步模块权限并保留范围外权限',
    async (selector) => {
      const wrapper = mountSharedPermissions([
        menuPermission,
        sharedPermission,
        queryPermission,
      ]);
      await wrapper.get(`[data-test="${selector}"]`).setValue(false);
      await confirmOperationCancellation();
      expect(await applyPermissionUpdate(wrapper)).toEqual([queryPermission]);
      await wrapper
        .get('[data-test="permission-root-tab-resources"]')
        .trigger('click');
      expect(sharedCheckbox(wrapper, 0).element.checked).toBe(false);
      expect(
        wrapper.get<HTMLInputElement>(
          `[data-test="permission-${queryPermission}"]`,
        ).element.checked,
      ).toBe(true);
      wrapper.unmount();
    },
  );

  it('不同授权对象的独立编辑器不会相互影响', async () => {
    const first = mountSharedPermissions([sharedPermission]);
    const second = mountSharedPermissions([sharedPermission]);
    await sharedCheckbox(first, 0).setValue(false);
    await confirmOperationCancellation();
    expect(await applyPermissionUpdate(first)).toEqual([]);
    expect(sharedCheckboxes(second).every((item) => item.element.checked)).toBe(
      true,
    );
    expect(second.emitted('update:value')).toBeUndefined();
    first.unmount();
    second.unmount();
  });

  it('数字角标统计所有共享位置且不受搜索过滤影响', async () => {
    const wrapper = mountSharedPermissions();
    const selector = `[data-test="permission-shared-${sharedPermission}"]`;
    expect(wrapper.findAll(selector)).toHaveLength(2);
    expect(wrapper.get(selector).text()).toBe('3');
    expect(wrapper.get(selector).attributes('title')).toBe('3处共用权限');
    expect(wrapper.get(selector).attributes('aria-label')).toBe(
      '共享 3 处，查看同步位置',
    );
    await wrapper.get('[data-test="permission-search"]').setValue('快捷新增');
    expect(wrapper.findAll(selector)).toHaveLength(1);
    expect(wrapper.get(selector).text()).toBe('3');
    await wrapper.get('[data-test="permission-search"]').setValue('');
    await wrapper
      .get('[data-test="permission-root-tab-resources"]')
      .trigger('click');
    expect(wrapper.get(selector).text()).toBe('3');
    expect(
      wrapper
        .find(`[data-test="permission-shared-${queryPermission}"]`)
        .exists(),
    ).toBe(false);
    wrapper.unmount();
  });

  it.each(['鼠标', '键盘'])(
    '%s 激活数字角标会展示完整中文路径且不会改变权限勾选',
    async (activation) => {
      const wrapper = mountSharedPermissions();
      const badge = wrapper.get<HTMLButtonElement>(
        `[data-test="permission-shared-${sharedPermission}"]`,
      );
      expect(badge.element.tagName).toBe('BUTTON');
      expect(badge.attributes('type')).toBe('button');
      if (activation === '键盘') {
        badge.element.focus();
        expect(document.activeElement).toBe(badge.element);
        await badge.trigger('keydown', { key: 'Enter' });
        await badge.trigger('keyup', { key: 'Enter' });
        // DOM 测试环境不执行按键默认动作，显式派发原生按钮键盘激活产生的 click。
        await badge.trigger('click', { detail: 0 });
      } else {
        await badge.trigger('click', { detail: 1 });
      }
      await flushPromises();
      const dialog = getVisibleDialog();
      expect(dialog.text()).toContain('系统菜单 / 团队管理 / 新增');
      expect(dialog.text()).toContain('系统菜单 / 团队管理 / 快捷新增');
      expect(dialog.text()).toContain('基础模块 / 团队资源 / 新增');
      expect(wrapper.emitted('update:value')).toBeUndefined();
      expect(
        sharedCheckboxes(wrapper).every((item) => !item.element.checked),
      ).toBe(true);
      wrapper.unmount();
    },
  );

  it('确认取消共享操作权限后给出可查看影响位置的非阻断提示', async () => {
    const wrapper = mountSharedPermissions([sharedPermission]);
    await sharedCheckbox(wrapper, 0).setValue(false);
    await confirmOperationCancellation();
    expect(await applyPermissionUpdate(wrapper)).toEqual([]);
    const status = wrapper.get('[role="status"]');
    expect(status.text()).toContain('已同步取消');
    expect(status.find('button').exists()).toBe(true);
    expect(findVisibleDialog()).toBeUndefined();
    await status.get('button').trigger('click');
    await flushPromises();
    expect(getVisibleDialog().text()).toContain('基础模块 / 团队资源 / 新增');
    wrapper.unmount();
  });

  it('取消通配授权覆盖的操作后保持其它具体操作且所有重复位置取消', async () => {
    const wrapper = mountSharedPermissions(['基础模块:团队管理::*']);
    await sharedCheckbox(wrapper, 0).setValue(false);
    await confirmOperationCancellation();
    const next = await applyPermissionUpdate(wrapper);
    expect(next).toEqual([queryPermission]);
    expect(
      sharedCheckboxes(wrapper).every((item) => !item.element.checked),
    ).toBe(true);
    await wrapper
      .get('[data-test="permission-root-tab-resources"]')
      .trigger('click');
    expect(sharedCheckbox(wrapper, 0).element.checked).toBe(false);
    expect(
      wrapper.get<HTMLInputElement>(
        `[data-test="permission-${queryPermission}"]`,
      ).element.checked,
    ).toBe(true);
    wrapper.unmount();
  });
});

const linkedOperation = 'demo:团队:成员:审核|付款|查看';
const linkedPermissions = ['审核', '付款', '查看'].map(
  (action) => `demo:团队:成员:${action}`,
);
const unrelatedPermission = 'demo:团队:成员:导出';
const linkedPermissionTree = [
  {
    id: 'linked-menus',
    name: '系统菜单',
    nodeType: 'Menu',
    children: [
      {
        id: 'linked-page',
        name: '成员管理',
        nodeType: 'Menu',
        children: [
          {
            id: 'linked-operation',
            name: '成员操作',
            nodeType: 'Action',
            permissionExpr: linkedOperation,
            resourcePermissions: ['审核', '付款', '查看'].map(
              (name, index) => ({
                id: `linked-resource-${index}`,
                label: `基础模块 / 团队管理 / ${name}`,
                name,
                nodeType: 'Action',
                permissionExpr: linkedPermissions[index],
              }),
            ),
          },
        ],
      },
    ],
  },
  {
    id: 'linked-resources',
    name: '基础模块',
    nodeType: 'Module',
    children: [
      {
        id: 'linked-resource-group',
        name: '团队管理',
        nodeType: 'Resource',
        children: [
          ...linkedPermissions.map((permissionExpr, index) => ({
            id: `linked-resource-${index}`,
            name: ['审核', '付款', '查看'][index],
            nodeType: 'Action',
            permissionExpr,
          })),
          {
            id: 'unrelated-resource',
            name: '导出',
            nodeType: 'Action',
            permissionExpr: unrelatedPermission,
          },
        ],
      },
    ],
  },
];

function mountLinkedPermissions(value: string[] = []) {
  return mount(ResourcePermissionTreeEditor, {
    attachTo: document.body,
    props: { permissionTree: linkedPermissionTree, value },
  });
}

function linkedOperationCheckbox(
  wrapper: ReturnType<typeof mountLinkedPermissions>,
) {
  return wrapper.get<HTMLInputElement>(
    `[data-test="permission-${linkedOperation}"]`,
  );
}

describe('操作权限关联资源权限', () => {
  it('红色关联数字角标悬停逐行展示资源权限且点击不改变授权', async () => {
    const wrapper = mountLinkedPermissions();
    const badge = wrapper.get(
      '[data-test="permission-linked-linked-operation"]',
    );
    expect(badge.text()).toBe('3');
    expect(badge.classes()).toContain('bg-destructive');
    expect(badge.attributes('aria-label')).toBe('关联 3 个资源权限');
    await badge.trigger('mouseenter');
    await expect
      .poll(() => document.querySelector('[role="tooltip"]')?.textContent)
      .toContain('关联的资源权限');
    const tooltip = new DOMWrapper(document.body).get('[role="tooltip"]');
    expect(tooltip.findAll('li').map((item) => item.text())).toEqual([
      '基础模块 / 团队管理 / 审核',
      '基础模块 / 团队管理 / 付款',
      '基础模块 / 团队管理 / 查看',
    ]);
    await badge.trigger('click');
    expect(wrapper.emitted('update:value')).toBeUndefined();
    expect(linkedOperationCheckbox(wrapper).element.checked).toBe(false);
    wrapper.unmount();
  });

  it('复合操作表达式自动匹配并勾选全部关联资源权限', async () => {
    const wrapper = mountLinkedPermissions();
    expect(
      wrapper.get('[data-test="permission-linked-linked-operation"]').text(),
    ).toBe('3');
    expect(
      wrapper.findAllComponents(IconifyIcon).map((icon) => icon.props('icon')),
    ).toContain('lucide:mouse-pointer-click');
    await linkedOperationCheckbox(wrapper).setValue(true);
    const next = await applyPermissionUpdate(wrapper);
    expect(new Set(next)).toEqual(
      new Set([linkedOperation, ...linkedPermissions]),
    );
    expect(next).toHaveLength(4);
    await wrapper
      .get('[data-test="permission-root-tab-linked-resources"]')
      .trigger('click');
    expect(
      wrapper.findAllComponents(IconifyIcon).map((icon) => icon.props('icon')),
    ).toContain('lucide:cable');
    for (const permission of linkedPermissions) {
      expect(
        wrapper.get<HTMLInputElement>(`[data-test="permission-${permission}"]`)
          .element.checked,
      ).toBe(true);
    }
    expect(
      wrapper.get<HTMLInputElement>(
        `[data-test="permission-${unrelatedPermission}"]`,
      ).element.checked,
    ).toBe(false);
    wrapper.unmount();
  });

  it('取消操作权限先列出全部资源权限，返回不提交，确认只提交一次', async () => {
    const selected = [
      linkedOperation,
      ...linkedPermissions,
      unrelatedPermission,
    ];
    const wrapper = mountLinkedPermissions(selected);
    await linkedOperationCheckbox(wrapper).setValue(false);
    const dialog = await cancellationDialog();
    for (const name of ['审核', '付款', '查看']) {
      expect(dialog.text()).toContain(`基础模块 / 团队管理 / ${name}`);
    }
    expect(dialog.text()).not.toContain('基础模块 / 团队管理 / 导出');
    expect(wrapper.emitted('update:value')).toBeUndefined();
    await pressCancellationButton('返回');
    expect(wrapper.emitted('update:value')).toBeUndefined();
    expect(linkedOperationCheckbox(wrapper).element.checked).toBe(true);
    await linkedOperationCheckbox(wrapper).setValue(false);
    await confirmOperationCancellation();
    expect(wrapper.emitted('update:value')).toHaveLength(1);
    expect(await applyPermissionUpdate(wrapper)).toEqual([unrelatedPermission]);
    wrapper.unmount();
  });

  it('仅授予全部关联资源原子权限时操作仍半选，勾选后补齐操作表达式', async () => {
    const wrapper = mountLinkedPermissions([...linkedPermissions]);
    const checkbox = linkedOperationCheckbox(wrapper);
    expect(checkbox.element.checked).toBe(false);
    expect(
      checkbox.element
        .closest('.ant-checkbox')
        ?.classList.contains('ant-checkbox-indeterminate'),
    ).toBe(true);
    await checkbox.setValue(true);
    const next = await applyPermissionUpdate(wrapper);
    expect(new Set(next)).toEqual(
      new Set([linkedOperation, ...linkedPermissions]),
    );
    expect(next).toHaveLength(4);
    expect(linkedOperationCheckbox(wrapper).element.checked).toBe(true);
    expect(
      linkedOperationCheckbox(wrapper)
        .element.closest('.ant-checkbox')
        ?.classList.contains('ant-checkbox-indeterminate'),
    ).toBe(false);
    wrapper.unmount();
  });

  it('直接取消一个资源权限无需确认且关联操作显示半选', async () => {
    const wrapper = mountLinkedPermissions([
      linkedOperation,
      ...linkedPermissions,
    ]);
    await wrapper
      .get('[data-test="permission-root-tab-linked-resources"]')
      .trigger('click');
    await wrapper
      .get(`[data-test="permission-${linkedPermissions[0]}"]`)
      .setValue(false);
    await applyPermissionUpdate(wrapper);
    expect(findVisibleDialog()).toBeUndefined();
    expect(
      wrapper.get<HTMLInputElement>(
        `[data-test="permission-${linkedPermissions[0]}"]`,
      ).element.checked,
    ).toBe(false);
    await wrapper
      .get('[data-test="permission-root-tab-linked-menus"]')
      .trigger('click');
    expect(
      linkedOperationCheckbox(wrapper)
        .element.closest('.ant-checkbox')
        ?.classList.contains('ant-checkbox-indeterminate'),
    ).toBe(true);
    wrapper.unmount();
  });

  it('批量取消操作权限也要确认并保留范围外资源权限', async () => {
    const wrapper = mountLinkedPermissions([
      linkedOperation,
      ...linkedPermissions,
      unrelatedPermission,
    ]);
    await wrapper.get('[data-test="permission-tree-toggle"]').setValue(false);
    expect(wrapper.emitted('update:value')).toBeUndefined();
    await confirmOperationCancellation();
    expect(wrapper.emitted('update:value')).toHaveLength(1);
    expect(await applyPermissionUpdate(wrapper)).toEqual([unrelatedPermission]);
    wrapper.unmount();
  });

  it.each(['value', 'permissionTree'])(
    '外部 %s 更新会关闭过期的取消确认且不提交旧权限',
    async (field) => {
      const wrapper = mountLinkedPermissions([
        linkedOperation,
        ...linkedPermissions,
      ]);
      await linkedOperationCheckbox(wrapper).setValue(false);
      await cancellationDialog();
      await (field === 'value'
        ? wrapper.setProps({ value: [unrelatedPermission] })
        : wrapper.setProps({ permissionTree: [] }));
      await flushPromises();
      expect(findVisibleDialog()).toBeUndefined();
      expect(wrapper.emitted('update:value')).toBeUndefined();
      wrapper.unmount();
    },
  );
});
