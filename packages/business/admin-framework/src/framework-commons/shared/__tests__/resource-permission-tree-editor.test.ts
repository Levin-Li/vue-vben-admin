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

  it('marks the top menu module as indeterminate when one menu permission is selected', () => {
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
                      'framework-base:系统菜单:访问日志:查看详情',
                  },
                  {
                    label: '更新',
                    requireAuthorization: 'framework-base:系统菜单:访问日志:更新',
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
                          'framework-base:系统菜单:访问日志:查看详情',
                      },
                      {
                        action: '更新',
                        label: '更新',
                        permissionExpr: 'framework-base:系统菜单:访问日志:更新',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        value: ['framework-base:系统菜单:访问日志:查看详情'],
      },
    });

    expect(wrapper.text()).toContain('系统菜单');
    expect(wrapper.findAll('.ant-checkbox-indeterminate').length).toBeGreaterThanOrEqual(
      2,
    );
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
                      'framework-base:系统菜单:访问日志:查看详情',
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
                          'framework-base:系统菜单:访问日志:查看详情',
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
      '[data-test="permission-framework-base:系统菜单:访问日志:查看详情"]',
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
                          'framework-base:系统菜单:地址:更新',
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
                        permissionExpr: 'framework-base:系统菜单:地址:更新',
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

    expect(wrapper.findAll('.border-l.border-dashed').length).toBeGreaterThan(0);
    expect(wrapper.findAll('.border-t.border-dashed').length).toBeGreaterThan(0);
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
                              'framework-base:系统菜单:地址详情:更新',
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
                          'framework-base:系统菜单:地址详情:更新',
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
});
