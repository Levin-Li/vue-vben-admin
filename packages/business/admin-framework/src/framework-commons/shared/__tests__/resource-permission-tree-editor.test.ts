import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ResourcePermissionTreeEditor from '../resource-permission-tree-editor.vue';

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

describe('ResourcePermissionTreeEditor', () => {
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

  it('does not mark a menu as authorized when only a CRUD action is selected', () => {
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
                    requireAuthorization:
                      'framework-base:系统数据-系统菜单:访问日志:查看详情',
                  },
                  {
                    label: '更新',
                    requireAuthorization:
                      'framework-base:系统数据-系统菜单:访问日志:更新',
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
                        permissionExpr: 'framework-base:系统数据-系统菜单:访问日志:更新',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        value: ['framework-base:系统数据-系统菜单:访问日志:查看详情'],
      },
    });

    expect(wrapper.text()).toContain('展示未授权');
    expect(wrapper.findAll('.ant-checkbox-indeterminate')).toHaveLength(1);
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
                    requireAuthorization:
                      'framework-base:系统数据-系统菜单:访问日志:查看详情',
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
      '[data-test="permission-framework-base:系统数据-系统菜单:访问日志:查看详情"]',
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
                        requireAuthorization:
                          'framework-base:系统数据-系统菜单:地址:更新',
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
                        permissionExpr: 'framework-base:系统数据-系统菜单:地址:更新',
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
                        requireAuthorization:
                          'framework-base:系统数据-系统菜单:地址:更新',
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
                        permissionExpr: 'framework-base:系统数据-系统菜单:地址:更新',
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
                            requireAuthorization:
                              'framework-base:系统数据-系统菜单:地址详情:更新',
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
                        permissionExpr: 'framework-base:系统数据-系统菜单:地址详情:更新',
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
                permissionExpr: 'com.levin.oak.base:系统数据-系统菜单:地址:展示',
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
                permissionExpr: 'com.levin.oak.base:系统数据-系统菜单:地址:展示',
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
                requireAuthorization: 'framework-base:系统数据-系统菜单:旧角色:旧操作',
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
                permissionExpr: 'com.levin.oak.base:系统数据-系统菜单:地址:展示',
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
                permissionExpr: 'framework-base:系统数据-系统菜单:framework-base:展示',
                children: [
                  {
                    id: 'role-menu',
                    name: '角色管理',
                    nodeType: 'Menu',
                    permissionExpr: 'framework-base:系统数据-系统菜单:角色管理:展示',
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
                    requireAuthorization:
                      'framework-base:系统数据-系统菜单:角色管理:分配权限',
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
          '[data-test="permission-framework-base:系统数据-系统菜单:角色管理:分配权限"]',
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
