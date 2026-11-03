import type { PermissionTreeNode } from '../data-permission-types';

import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from '@vue/test-utils';

import { Tooltip } from 'ant-design-vue';
import { afterEach, describe, expect, it } from 'vitest';

import ApiScopedDataPermissions from '../api-scoped-data-permissions.vue';
import {
  collectKnownPermissionTreeValues,
  collectPermissionValues,
  splitMappedAndUnmappedPermissions,
} from '../data-permission-transform';
import AttrGroupPermissions from '../resource-attr-group-permissions.vue';
import ResourcePermissionTreeEditor from '../resource-permission-tree-editor.vue';

enableAutoUnmount(afterEach);
const action = 'example:合同::试算';
// Opaque backend expression; clients must not construct it from a label.
const expression = 'example:属性组:contract.finance:试算';
const group = {
  attributes: ['合同金额', '税率', '结算账号'],
  name: '财务信息',
  permissionExpr: expression,
  remark: '控制合作关系专用收款账户的API输入与输出',
};
const entityExpression = 'example:业务数据-合同:DataAttrGroup@finance:access';
const tree: PermissionTreeNode[] = [
  {
    id: 'module',
    name: '示例',
    nodeType: 'Module',
    children: [
      {
        id: 'contract',
        name: '合同',
        nodeType: 'Resource',
        children: [
          {
            id: 'calculate',
            name: '试算',
            nodeType: 'Action',
            permissionExpr: action,
            attrGroups: [group],
          },
        ],
      },
    ],
  },
];
const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 150));
};

describe('api 属性组授权', () => {
  it('信息权限以绿色角标统计并延迟预览已选内容', () => {
    const wrapper = mount(ApiScopedDataPermissions, {
      props: {
        operation: action,
        enabled: true,
        groups: [group],
        selected: [`@${action}:@财务信息|enum#Example#kind@A`],
        attributes: [
          {
            attribute: 'kind',
            entityClass: 'Contract',
            name: '类型',
            sourceKind: 'enum',
            sourceKey: 'Example',
            values: [{ name: 'A', label: '客户', permissionExpr: 'old:a' }],
          },
        ],
      },
    });
    expect(wrapper.get('[aria-label="已选 2 项信息权限"]').classes()).toContain(
      'bg-success',
    );
    const tooltip = wrapper
      .findAllComponents(Tooltip)
      .find((item) => item.props('mouseEnterDelay') === 0.7);
    expect(tooltip?.props('title')).toBe('信息组：财务信息\n类型：客户');
    expect(tooltip?.props('overlayInnerStyle')).toEqual({
      whiteSpace: 'pre-line',
    });
  });
  it('部分接口已有信息组时显示半选，下一次勾选表示全部选中', async () => {
    const wrapper = mount(ApiScopedDataPermissions, {
      attachTo: document.body,
      props: {
        operation: action,
        enabled: true,
        groups: [group],
        selected: [`@${action}:@财务信息`],
        partialGroups: ['财务信息'],
      },
    });
    await wrapper
      .get(`[data-test="api-data-trigger-${action}"]`)
      .trigger('click');
    await flushPromises();
    const checkbox = document.querySelector<HTMLInputElement>(
      `[data-test="api-group-${action}-财务信息"]`,
    );
    expect(checkbox?.closest('.ant-checkbox-indeterminate')).not.toBeNull();
    expect(checkbox?.checked).toBe(false);
    checkbox?.click();
    await flushPromises();
    expect(wrapper.emitted('toggleGroup')?.at(-1)).toEqual(['财务信息', true]);
  });
  it('只对服务端声明的同类全部操作入口汇总同源组和值', async () => {
    const wildcard = 'example:业务数据-合同::*';
    const sourceGroup = {
      ...group,
      entityScope: true,
      name: '财务信息',
      sourceKey: 'com.example.Contract#财务信息',
    };
    const attribute = (value: string) => ({
      attribute: 'type',
      entityClass: 'com.example.Contract',
      name: '合同类型',
      sourceKind: 'enum' as const,
      sourceKey: 'com.example.Contract$Type',
      values: [{ name: value, label: value, permissionExpr: `old:${value}` }],
    });
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: 'module',
            name: '示例',
            nodeType: 'Module',
            children: [
              {
                id: 'contract-type',
                name: '合同',
                nodeType: 'ResourceType',
                wildcardOperation: wildcard,
                children: [
                  {
                    id: 'contract',
                    name: '合同',
                    nodeType: 'Resource',
                    children: [
                      {
                        id: 'list',
                        name: '查询列表',
                        nodeType: 'Action',
                        permissionExpr: 'example:业务数据-合同::查询列表',
                        attrGroups: [sourceGroup],
                        dataAttrs: [attribute('Customer')],
                      },
                      {
                        id: 'detail',
                        name: '查看详情',
                        nodeType: 'Action',
                        permissionExpr: 'example:业务数据-合同::查看详情',
                        attrGroups: [sourceGroup],
                        dataAttrs: [attribute('Supplier')],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        value: [wildcard],
      },
    });
    expect(
      wrapper.find(`[data-test="permission-wildcard-${wildcard}"]`).exists(),
    ).toBe(false);
    const picker = wrapper
      .findAllComponents(ApiScopedDataPermissions)
      .find((item) => item.props('operation') === wildcard);
    const inline = wrapper.get('[data-test="permission-wildcard-inline"]');
    expect(inline.text()).not.toContain('全部操作');
    expect(inline.text()).toContain('信息权限');
    expect(
      inline.find(`[data-test="api-data-trigger-${wildcard}"]`).exists(),
    ).toBe(true);
    expect(
      inline.element.parentElement?.querySelector(
        '[data-test="permission-node-contract-type"]',
      ),
    ).not.toBeNull();
    expect(picker?.props('groups')).toHaveLength(1);
    expect(
      picker?.props('attributes')[0]?.values.map((item: any) => item.name),
    ).toEqual(['Customer', 'Supplier']);
    picker?.vm.$emit(
      'toggleValues',
      'enum#com.example.Contract$Type#type',
      ['Customer'],
      true,
    );
    await flushPromises();
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([
      `@${wildcard}:enum#com.example.Contract$Type#type@Customer`,
    ]);
    const saved = splitMappedAndUnmappedPermissions(
      [`@${wildcard}:@财务信息`],
      [],
      wrapper.props('permissionTree'),
    );
    expect(saved).toEqual({
      mapped: [`@${wildcard}:@财务信息`],
      unmapped: [],
    });
    await wrapper.setProps({ value: saved.mapped });
    expect(picker?.props('selected')).toContain(`@${wildcard}:@财务信息`);
    expect(
      inline
        .findAllComponents(Tooltip)
        .find((item) => item.props('mouseEnterDelay') === 0.7)
        ?.props('title'),
    ).toBe('信息组：财务信息');
    picker?.vm.$emit('toggleGroup', '财务信息', false);
    await flushPromises();
    const revoked = wrapper.emitted('update:value')?.at(-1)?.[0] as string[];
    expect(collectPermissionValues(revoked)).toEqual([wildcard]);
    await wrapper.setProps({
      value: [
        '@example:业务数据-合同::查询列表:@财务信息|enum#com.example.Contract$Type#type@Customer',
        'example:业务数据-合同::查看详情',
      ],
    });
    expect(picker?.props('partialGroups')).toContain('财务信息');
    expect(picker?.props('partialValues')).toContain(
      'enum#com.example.Contract$Type#type@Customer',
    );
    expect(picker?.props('selected')).toContain(
      `@${wildcard}:@财务信息|enum#com.example.Contract$Type#type@Customer`,
    );
    expect(inline.find('[aria-label="已选 2 项信息权限"]').exists()).toBe(true);
    await wrapper.setProps({
      value: [
        'example:业务数据-合同::查询列表',
        'example:业务数据-合同::查看详情',
        'example:其他::查询',
      ],
    });
    picker?.vm.$emit('toggleGroup', '财务信息', true);
    await flushPromises();
    const scoped = wrapper.emitted('update:value')?.at(-1)?.[0] as string[];
    expect(scoped).toContain('@example:业务数据-合同::查询列表:@财务信息');
    expect(scoped).toContain('@example:业务数据-合同::查看详情:@财务信息');
    expect(scoped).toContain('example:其他::查询');
    expect(scoped).not.toContain(wildcard);
    await wrapper.setProps({ value: scoped });
    expect(picker?.props('selected')).toContain(`@${wildcard}:@财务信息`);
  });

  it('只修改已选具体接口的信息权限，不隐式增加全部操作', async () => {
    const wildcard = 'example:业务数据-合同::*';
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        value: [],
        permissionTree: [
          {
            id: 'module',
            name: '示例',
            nodeType: 'Module',
            children: [
              {
                id: 'contract-type',
                name: '合同',
                nodeType: 'ResourceType',
                wildcardOperation: wildcard,
                children: [
                  {
                    id: 'list',
                    name: '查询列表',
                    nodeType: 'Action',
                    permissionExpr: 'example:业务数据-合同::查询列表',
                    attrGroups: [
                      {
                        ...group,
                        entityScope: true,
                        sourceKey: 'Contract#财务信息',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const picker = wrapper
      .findAllComponents(ApiScopedDataPermissions)
      .find((item) => item.props('operation') === wildcard);
    expect(picker?.props('enabled')).toBe(false);
    expect(wrapper.emitted('update:value')).toBeUndefined();
    picker?.vm.$emit('toggleGroup', '财务信息', true);
    await flushPromises();
    expect(wrapper.emitted('update:value')).toBeUndefined();
    await wrapper.setProps({ value: ['example:业务数据-合同::查询列表'] });
    expect(picker?.props('enabled')).toBe(true);
    picker?.vm.$emit('toggleGroup', '财务信息', true);
    await flushPromises();
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([
      '@example:业务数据-合同::查询列表:@财务信息',
    ]);
    await wrapper.setProps({
      value: ['@example:业务数据-合同::查询列表:@财务信息'],
    });
    expect(picker?.props('selected')).toContain(`@${wildcard}:@财务信息`);
  });

  it('实体没有信息权限候选时不增加通配区域', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        value: [],
        permissionTree: [
          {
            id: 'module',
            name: '示例',
            nodeType: 'Module',
            children: [
              {
                id: 'contract-type',
                name: '合同',
                nodeType: 'ResourceType',
                wildcardOperation: 'example:业务数据-合同::*',
                children: [
                  {
                    id: 'list',
                    name: '查询列表',
                    nodeType: 'Action',
                    permissionExpr: 'example:业务数据-合同::查询列表',
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(
      wrapper.find('[data-test="permission-wildcard-inline"]').exists(),
    ).toBe(false);
  });

  it('没有通配目录时仍可为已选具体接口配置信息权限', async () => {
    const operation = 'example:业务数据-合同::查询列表';
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        value: [operation],
        permissionTree: [
          {
            id: 'module',
            name: '示例',
            nodeType: 'Module',
            children: [
              {
                id: 'contract-type',
                name: '合同',
                nodeType: 'ResourceType',
                children: [
                  {
                    id: 'list',
                    name: '查询列表',
                    nodeType: 'Action',
                    permissionExpr: operation,
                    attrGroups: [
                      {
                        ...group,
                        entityScope: true,
                        sourceKey: 'Contract#财务信息',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(
      wrapper.find('[data-test="permission-wildcard-inline"]').exists(),
    ).toBe(true);
    const picker = wrapper
      .find('[data-test="permission-wildcard-inline"]')
      .findComponent(ApiScopedDataPermissions);
    picker.vm.$emit('toggleGroup', '财务信息', true);
    await flushPromises();
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([
      `@${operation}:@财务信息`,
    ]);
  });

  it('未声明通配入口及同名不同来源候选不显示通配配置', () => {
    const wildcard = 'example:业务数据-合同::*';
    const permissionTree: PermissionTreeNode[] = [
      {
        id: 'type',
        name: '合同',
        nodeType: 'ResourceType',
        wildcardOperation: wildcard,
        children: [
          {
            id: 'resource',
            name: '合同',
            nodeType: 'Resource',
            children: [
              {
                id: 'first',
                name: '查询',
                nodeType: 'Action',
                permissionExpr: 'example:业务数据-合同::查询',
                attrGroups: [
                  { ...group, entityScope: true, sourceKey: 'First#财务信息' },
                ],
                dataAttrs: [
                  {
                    attribute: 'type',
                    entityClass: 'First',
                    name: '类型',
                    sourceKind: 'enum',
                    sourceKey: 'First$Type',
                    values: [
                      { name: 'A', label: 'A', permissionExpr: 'old:A' },
                    ],
                  },
                ],
              },
              {
                id: 'second',
                name: '详情',
                nodeType: 'Action',
                permissionExpr: 'example:业务数据-合同::详情',
                attrGroups: [
                  { ...group, entityScope: true, sourceKey: 'Second#财务信息' },
                ],
                dataAttrs: [
                  {
                    attribute: 'type',
                    entityClass: 'Second',
                    name: '类型',
                    sourceKind: 'enum',
                    sourceKey: 'Second$Type',
                    values: [
                      { name: 'B', label: 'B', permissionExpr: 'old:B' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: 'module',
            name: '示例',
            nodeType: 'Module',
            children: permissionTree,
          },
        ],
        value: [],
      },
    });
    expect(
      wrapper.find(`[data-test="permission-wildcard-${wildcard}"]`).exists(),
    ).toBe(false);
    expect(
      wrapper
        .findAllComponents(ApiScopedDataPermissions)
        .some((item) => item.props('operation') === wildcard),
    ).toBe(false);
    const withoutWildcard = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: 'module',
            name: '示例',
            nodeType: 'Module',
            children: [{ ...permissionTree[0], wildcardOperation: undefined }],
          },
        ],
        value: [],
      },
    });
    expect(
      withoutWildcard.find('[data-test^="permission-wildcard-"]').exists(),
    ).toBe(false);
  });

  it('同一接口的枚举和字典允许值写入一条复合授权', async () => {
    const operation = 'example:系统数据-用户::查询列表';
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: 'module',
            name: '示例',
            nodeType: 'Module',
            children: [
              {
                id: 'user',
                name: '用户',
                nodeType: 'Resource',
                children: [
                  {
                    id: 'list',
                    name: '查询列表',
                    nodeType: 'Action',
                    permissionExpr: operation,
                    dataAttrs: [
                      {
                        attribute: 'sex',
                        entityClass: 'User',
                        name: '性别',
                        sourceKind: 'enum',
                        sourceKey: 'com.example.User$Sex',
                        values: [
                          {
                            label: '男',
                            name: 'Male',
                            permissionExpr: 'old:male',
                          },
                        ],
                      },
                      {
                        attribute: 'type',
                        entityClass: 'User',
                        name: '用户类型',
                        sourceKind: 'dict',
                        sourceKey: 'com.example.User.type',
                        values: [
                          {
                            label: '客户',
                            name: 'Customer',
                            permissionExpr: 'old:customer',
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
        value: [operation],
      },
    });
    const picker = wrapper.findComponent(ApiScopedDataPermissions);
    expect(picker.exists()).toBe(true);
    picker.vm.$emit(
      'toggleValues',
      'enum#com.example.User$Sex#sex',
      ['Male'],
      true,
    );
    await flushPromises();
    const first = `@${operation}:enum#com.example.User$Sex#sex@Male`;
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([first]);

    await wrapper.setProps({ value: [first] });
    expect(picker.text()).toContain('信息权限 1');
    picker.vm.$emit(
      'toggleValues',
      'dict#com.example.User.type#type',
      ['Customer'],
      true,
    );
    await flushPromises();
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([
      `@${operation}:dict#com.example.User.type#type@Customer|enum#com.example.User$Sex#sex@Male`,
    ]);
    await wrapper.setProps({
      value: [
        `@${operation}:dict#com.example.User.type#type@Customer|enum#com.example.User$Sex#sex@Male`,
      ],
    });
    expect(picker.text()).toContain('信息权限 2');
  });

  it('同一信息组在不同接口操作下分别勾选并保存为一条复合授权', async () => {
    const firstAction = 'example:业务数据-合同::查询列表';
    const secondAction = 'example:业务数据-合同::查看详情';
    const entityGroup = {
      ...group,
      entityScope: true,
      name: '财 务 信息',
      permissionExpr: entityExpression,
      scopeKey: 'example:业务数据-合同',
    };
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: 'module',
            name: '示例',
            nodeType: 'Module',
            children: [
              {
                id: 'contract-type',
                name: '合同',
                nodeType: 'ResourceType',
                attrGroups: [entityGroup],
                children: [
                  {
                    id: 'contract',
                    name: '合同',
                    nodeType: 'Resource',
                    children: [
                      {
                        id: 'list',
                        name: '查询列表',
                        nodeType: 'Action',
                        permissionExpr: firstAction,
                        attrGroups: [entityGroup],
                      },
                      {
                        id: 'detail',
                        name: '查看详情',
                        nodeType: 'Action',
                        permissionExpr: secondAction,
                        attrGroups: [entityGroup],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ] as PermissionTreeNode[],
        value: [firstAction, secondAction],
      },
    });
    expect(wrapper.find('[data-test="entity-attr-groups"]').exists()).toBe(
      false,
    );
    const selectors = wrapper.findAllComponents(ApiScopedDataPermissions);
    expect(selectors).toHaveLength(2);
    selectors[0]?.vm.$emit('toggleGroup', '财务信息', true);
    await flushPromises();
    const scoped = `@${firstAction}:@财务信息`;
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([
      secondAction,
      scoped,
    ]);
    await wrapper.setProps({ value: [secondAction, scoped] });
    expect(selectors[0]?.props('selected')).toEqual([secondAction, scoped]);
    expect(selectors[1]?.props('selected')).toEqual([secondAction, scoped]);
    await wrapper
      .get(`[data-test="permission-${firstAction}"]`)
      .setValue(false);
    const afterFirstRemoval = wrapper
      .emitted('update:value')
      ?.at(-1)?.[0] as string[];
    expect(afterFirstRemoval).not.toContain(scoped);
    expect(afterFirstRemoval).toContain(secondAction);
  });

  it('无组时不增加入口，悬停仅显示中文属性名称列表', async () => {
    const empty = mount(AttrGroupPermissions, {
      props: { enabled: true, groups: [], selected: [] },
    });
    expect(empty.find('[data-test="attr-groups-trigger"]').exists()).toBe(
      false,
    );
    const wrapper = mount(AttrGroupPermissions, {
      attachTo: document.body,
      props: { enabled: true, groups: [group], selected: [] },
    });
    expect(wrapper.find('[data-test="attr-group-icon"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('合同金额');
    await wrapper.get('button').trigger('click');
    await settle();
    const body = new DOMWrapper(document.body);
    const name = body.get(`[data-test="attr-group-name-${expression}"]`);
    expect(name.text()).toBe('财务信息');
    expect(document.body.textContent).not.toContain('包含：');
    await name.trigger('mouseenter');
    await new Promise((resolve) => setTimeout(resolve, 250));
    await flushPromises();
    expect(document.body.textContent).toContain('合同金额、税率、结算账号');
    expect(document.body.textContent).not.toContain('包含：');
    expect(document.body.textContent).not.toContain(group.remark);
  });

  it('同名组显示源实体名称，勾选互相隔离', async () => {
    const otherExpression = 'example:属性组:employee.finance:试算';
    const wrapper = mount(AttrGroupPermissions, {
      attachTo: document.body,
      props: {
        enabled: true,
        groups: [
          { ...group, entityName: '合同' },
          { ...group, entityName: '员工', permissionExpr: otherExpression },
        ],
        selected: [],
      },
    });
    await wrapper.get('button').trigger('click');
    await settle();
    const body = new DOMWrapper(document.body);
    expect(body.get(`[data-test="attr-group-name-${expression}"]`).text()).toBe(
      '合同／财务信息',
    );
    expect(
      body.get(`[data-test="attr-group-name-${otherExpression}"]`).text(),
    ).toBe('员工／财务信息');
    await body.get(`[data-test="attr-group-${expression}"]`).setValue(true);
    expect(wrapper.emitted('toggle')?.at(-1)).toEqual([expression, true]);
    await wrapper.setProps({ selected: [expression] });
    expect(
      (
        body.get(`[data-test="attr-group-${expression}"]`)
          .element as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      (
        body.get(`[data-test="attr-group-${otherExpression}"]`)
          .element as HTMLInputElement
      ).checked,
    ).toBe(false);
  });

  it('悬停 0.7 秒预览已选组，组属性可继续悬停查看', async () => {
    const wrapper = mount(AttrGroupPermissions, {
      attachTo: document.body,
      props: { enabled: true, groups: [group], selected: [expression] },
    });
    await wrapper
      .get('[data-test="attr-groups-trigger"]')
      .trigger('mouseenter');
    await new Promise((resolve) => setTimeout(resolve, 750));
    await flushPromises();
    const body = new DOMWrapper(document.body);
    const selected = body.get(
      `[data-test="selected-attr-group-${expression}"]`,
    );
    expect(selected.text()).toBe('财务信息');
    await selected.trigger('mouseenter');
    await settle();
    expect(document.body.textContent).toContain('合同金额、税率、结算账号');
  });

  it('父操作未授权时禁用；选中组仅发送后端表达式', async () => {
    const wrapper = mount(AttrGroupPermissions, {
      attachTo: document.body,
      props: { enabled: false, groups: [group], selected: [] },
    });
    await wrapper.get('button').trigger('click');
    await settle();
    const input = new DOMWrapper(document.body).get(
      `[data-test="attr-group-${expression}"]`,
    );
    expect((input.element as HTMLInputElement).disabled).toBe(true);
    await wrapper.setProps({ enabled: true });
    await input.setValue(true);
    expect(wrapper.emitted('toggle')?.at(-1)).toEqual([expression, true]);
  });

  it('已保存的组权限能回显，取消父操作同步清理组', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: { permissionTree: tree, value: [action, expression] },
    });
    expect(
      wrapper.findComponent(AttrGroupPermissions).props('selected'),
    ).toEqual([action, expression]);
    await wrapper.get(`[data-test="permission-${action}"]`).setValue(false);
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([]);
  });

  it('勾选组保留操作，同表达式的多处入口共享状态', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            id: 'module',
            name: '示例',
            nodeType: 'Module',
            children: tree
              .flatMap((root) => root.children || [])
              .flatMap((resource) => [
                resource,
                { ...resource, id: 'duplicate-resource' },
              ]),
          },
        ],
        value: [action],
      },
    });
    const controls = wrapper.findAllComponents(AttrGroupPermissions);
    expect(controls).toHaveLength(2);
    const control = controls[0];
    if (!control) throw new Error('Missing attribute group control');
    control.vm.$emit('toggle', expression, true);
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([
      action,
      expression,
    ]);
    await wrapper.setProps({ value: [action, expression] });
    for (const item of controls)
      expect(item.props('selected')).toEqual([action, expression]);
    control.vm.$emit('toggle', expression, false);
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([action]);
  });

  it('资源授权弹窗的合法集合包含属性组，映射后仍保留完整表达式', () => {
    expect(collectKnownPermissionTreeValues(tree)).toEqual(
      new Set([action, expression]),
    );
    expect(
      splitMappedAndUnmappedPermissions([action, expression], [], tree),
    ).toEqual({ mapped: [action, expression], unmapped: [] });
  });

  it('旧接口级组授权保留在原操作，不自动转成实体授权', () => {
    const legacyExpression = 'example:DataAttrGroup:legacy:access';
    const legacyTree: PermissionTreeNode[] = [
      {
        id: 'operation',
        name: '查询列表',
        nodeType: 'Action',
        permissionExpr: action,
        attrGroups: [
          {
            ...group,
            entityScope: true,
            legacyPermissionExpr: legacyExpression,
            permissionExpr: entityExpression,
          },
        ],
      },
    ];
    expect(collectKnownPermissionTreeValues(legacyTree)).toEqual(
      new Set([action, entityExpression, legacyExpression]),
    );
    expect(
      splitMappedAndUnmappedPermissions(
        [action, legacyExpression],
        [],
        legacyTree,
      ),
    ).toEqual({ mapped: [action, legacyExpression], unmapped: [] });
  });
});
