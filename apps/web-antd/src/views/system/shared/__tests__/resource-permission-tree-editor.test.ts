import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import ResourcePermissionTreeEditor from '../resource-permission-tree-editor.vue';

describe('resource-permission-tree-editor', () => {
  it('emits checked action permissions only', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        modules: [
          {
            id: 'module-a',
            name: '模块A',
            typeList: [
              {
                id: 'type-a',
                name: '类型A',
                resList: [
                  {
                    actionList: [
                      {
                        action: '查看',
                        id: 'action-view',
                        permissionExpr: 'perm:view',
                      },
                    ],
                    id: 'res-a',
                    name: '资源A',
                  },
                ],
              },
            ],
          },
        ],
        value: [],
      },
    });

    await wrapper.get('[data-test="permission-perm:view"]').setValue(true);

    const emitted = wrapper.emitted('update:value');
    expect(emitted).toBeTruthy();
    expect(emitted?.[0]?.[0]).toEqual(['perm:view']);
  });

  it('renders one tab per module', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        modules: [
          { id: 'module-a', name: '模块A', typeList: [] },
          { id: 'module-b', name: '模块B', typeList: [] },
        ],
        value: [],
      },
    });

    expect(wrapper.findAll('[data-test="permission-module-tab"]').length).toBe(
      2,
    );
  });

  it('filters permissions by keyword inside the active module', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        modules: [
          {
            id: 'module-a',
            name: '模块A',
            typeList: [
              {
                id: 'type-a',
                name: '类型A',
                resList: [
                  {
                    actionList: [
                      {
                        action: '查看',
                        id: 'action-view',
                        permissionExpr: 'perm:view',
                      },
                      {
                        action: '删除',
                        id: 'action-delete',
                        permissionExpr: 'perm:delete',
                      },
                    ],
                    id: 'res-a',
                    name: '资源A',
                  },
                ],
              },
            ],
          },
        ],
        value: [],
      },
    });

    await wrapper.get('[data-test="permission-search"]').setValue('删除');

    expect(wrapper.find('[data-test="permission-perm:view"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-test="permission-perm:delete"]').exists()).toBe(
      true,
    );
  });

  it('selects all permissions in the active module', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        modules: [
          {
            id: 'module-a',
            name: '模块A',
            typeList: [
              {
                id: 'type-a',
                name: '类型A',
                resList: [
                  {
                    actionList: [
                      {
                        action: '查看',
                        id: 'action-view',
                        permissionExpr: 'perm:view',
                      },
                      {
                        action: '删除',
                        id: 'action-delete',
                        permissionExpr: 'perm:delete',
                      },
                    ],
                    id: 'res-a',
                    name: '资源A',
                  },
                ],
              },
            ],
          },
        ],
        value: [],
      },
    });

    await wrapper.get('[data-test="permission-module-toggle"]').setValue(true);

    const emitted = wrapper.emitted('update:value') as
      | Array<[string[]]>
      | undefined;

    expect(emitted?.[0]?.[0]).toEqual(['perm:view', 'perm:delete']);
  });

  it('clears permissions in the active module only', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        modules: [
          {
            id: 'module-a',
            name: '模块A',
            typeList: [
              {
                id: 'type-a',
                name: '类型A',
                resList: [
                  {
                    actionList: [
                      {
                        action: '查看',
                        id: 'action-view',
                        permissionExpr: 'perm:view',
                      },
                      {
                        action: '删除',
                        id: 'action-delete',
                        permissionExpr: 'perm:delete',
                      },
                    ],
                    id: 'res-a',
                    name: '资源A',
                  },
                ],
              },
            ],
          },
        ],
        value: ['perm:view', 'perm:delete', 'perm:other'],
      },
    });

    await wrapper.get('[data-test="permission-module-toggle"]').setValue(false);

    const emitted = wrapper.emitted('update:value') as
      | Array<[string[]]>
      | undefined;

    expect(emitted?.[0]?.[0]).toEqual(['perm:other']);
  });

  it('clears search keyword when switching modules', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        modules: [
          {
            id: 'module-a',
            name: '模块A',
            typeList: [
              {
                id: 'type-a',
                name: '类型A',
                resList: [
                  {
                    actionList: [
                      {
                        action: '查看',
                        id: 'action-view',
                        permissionExpr: 'perm:view',
                      },
                    ],
                    id: 'res-a',
                    name: '资源A',
                  },
                ],
              },
            ],
          },
          {
            id: 'module-b',
            name: '模块B',
            typeList: [],
          },
        ],
        value: [],
      },
    });

    await wrapper.get('[data-test="permission-search"]').setValue('查看');
    const moduleTabs = wrapper.findAll('[data-test="permission-module-tab"]');
    const nextModuleTab = moduleTabs[1];
    expect(nextModuleTab).toBeDefined();
    if (!nextModuleTab) {
      throw new Error('expected the second module tab to exist');
    }
    await nextModuleTab.trigger('click');

    const searchInput = wrapper.get('[data-test="permission-search"]')
      .element as HTMLInputElement;

    expect(searchInput.value).toBe('');
  });

  it('shows an empty hint when no permission matches the keyword', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        modules: [
          {
            id: 'module-a',
            name: '模块A',
            typeList: [
              {
                id: 'type-a',
                name: '类型A',
                resList: [
                  {
                    actionList: [
                      {
                        action: '查看',
                        id: 'action-view',
                        permissionExpr: 'perm:view',
                      },
                    ],
                    id: 'res-a',
                    name: '资源A',
                  },
                ],
              },
            ],
          },
        ],
        value: [],
      },
    });

    await wrapper.get('[data-test="permission-search"]').setValue('不存在');

    expect(wrapper.text()).toContain('没有匹配的权限');
  });

  it('hides resource title when resource name is empty', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        modules: [
          {
            id: 'module-a',
            name: '模块A',
            typeList: [
              {
                id: '系统数据-访问日志',
                name: '访问日志',
                resList: [
                  {
                    actionList: [
                      {
                        action: '查询列表',
                        id: null,
                        permissionExpr: 'perm:list',
                      },
                    ],
                    domain: 'com.levin.oak.base',
                    id: '',
                    name: null,
                    type: '系统数据-访问日志',
                  },
                ],
              },
            ],
          },
        ],
        value: [],
      },
    });

    expect(wrapper.text()).not.toContain('系统数据-访问日志');
    expect(wrapper.text()).toContain('查询列表');
  });

  it('checks actions matched by wildcard role permissions', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        modules: [
          {
            id: 'module-a',
            name: '模块A',
            typeList: [
              {
                id: '系统数据-角色',
                name: '角色',
                resList: [
                  {
                    actionList: [
                      {
                        action: '查询列表',
                        permissionExpr:
                          'com.levin.oak.base:系统数据-角色::查询列表',
                      },
                    ],
                    type: '系统数据-角色',
                  },
                ],
              },
            ],
          },
        ],
        value: ['com.levin.oak.base:系统数据-角色::*'],
      },
    });

    expect(
      (
        wrapper.get(
          '[data-test="permission-com.levin.oak.base:系统数据-角色::查询列表"]',
        ).element as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it('sorts resource types by display name', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        modules: [
          {
            id: 'module-a',
            name: '模块A',
            typeList: [
              { id: 'z', name: '租户', resList: [] },
              { id: 'a', name: '角色', resList: [] },
            ],
          },
        ],
        value: [],
      },
    });

    expect(wrapper.text().indexOf('角色')).toBeLessThan(
      wrapper.text().indexOf('租户'),
    );
  });
});
