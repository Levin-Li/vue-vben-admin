import type { PermissionTreeNode } from '../data-permission-types';

import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from '@vue/test-utils';

import { afterEach, describe, expect, it } from 'vitest';

import {
  collectKnownPermissionTreeValues,
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
  it('实体节点集中展示同一组，勾选不改变接口操作', async () => {
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
    expect(wrapper.findAll('[data-test="entity-attr-groups"]')).toHaveLength(1);
    expect(wrapper.find('[data-test="attr-group-icon"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-test="attr-groups-trigger"]')).toHaveLength(
      0,
    );
    const entityCheckbox = wrapper.get(
      `[data-test="entity-attr-group-${entityExpression}"]`,
    );
    expect(entityCheckbox.element.closest('label')?.textContent).toContain(
      '财务信息',
    );
    await entityCheckbox.setValue(true);
    expect(
      new Set(wrapper.emitted('update:value')?.at(-1)?.[0] as string[]),
    ).toEqual(new Set([entityExpression, firstAction, secondAction]));
    await wrapper.setProps({
      value: [firstAction, secondAction, entityExpression],
    });
    await wrapper
      .get(`[data-test="permission-${firstAction}"]`)
      .setValue(false);
    const afterFirstRemoval = wrapper
      .emitted('update:value')
      ?.at(-1)?.[0] as string[];
    expect(afterFirstRemoval).toContain(entityExpression);
    await wrapper.setProps({ value: afterFirstRemoval });
    await wrapper
      .get(`[data-test="permission-${secondAction}"]`)
      .setValue(false);
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([
      entityExpression,
    ]);
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
