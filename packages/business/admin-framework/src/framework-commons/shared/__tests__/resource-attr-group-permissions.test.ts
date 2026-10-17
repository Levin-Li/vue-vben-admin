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
};
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
  it('无组时不增加入口，成员仅在悬停名称时展示', async () => {
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
    expect(document.body.textContent).toContain(
      '包含：合同金额、税率、结算账号',
    );
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
});
