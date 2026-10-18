import type {
  DataAttrValuePermission,
  PermissionTreeNode,
} from '../data-permission-types';

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
import DataAttrPermissions from '../resource-data-attr-permissions.vue';
import ResourcePermissionTreeEditor from '../resource-permission-tree-editor.vue';

enableAutoUnmount(afterEach);
const action = 'demo:伙伴::查询';
const update = 'demo:伙伴::修改';
const customer = 'demo:枚举范围:Partner.type:Customer';
const supplier = 'demo:枚举范围:Partner.type:Supplier';
const east = 'demo:枚举范围:Partner.region:East';
const attributes: [DataAttrValuePermission, DataAttrValuePermission] = [
  {
    entityClass: 'example.Partner',
    entityName: '合作伙伴',
    attribute: 'type',
    name: '客户类型',
    remark: '只允许所选类型的记录',
    values: [
      { name: 'Customer', label: '客户', permissionExpr: customer },
      { name: 'Supplier', label: '供应商', permissionExpr: supplier },
    ],
  },
  {
    entityClass: 'example.Partner',
    entityName: '合作伙伴',
    attribute: 'region',
    name: '所属区域',
    values: [{ name: 'East', label: '华东', permissionExpr: east }],
  },
];
const resource: PermissionTreeNode = {
  id: 'partner',
  name: '合作伙伴',
  nodeType: 'Resource',
  dataAttrs: attributes,
  children: [
    { id: 'query', name: '查询', nodeType: 'Action', permissionExpr: action },
    { id: 'update', name: '修改', nodeType: 'Action', permissionExpr: update },
  ],
};
const tree: [PermissionTreeNode] = [
  { id: 'demo', name: '示例', nodeType: 'Module', children: [resource] },
];
async function open(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('[data-test="data-attrs-trigger"]').trigger('click');
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 150));
  return new DOMWrapper(document.body);
}

describe('枚举记录范围授权', () => {
  it('旧资源和无有效枚举元数据不显示入口', () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: { permissionTree: [{ ...resource, dataAttrs: [] }], value: [] },
    });
    expect(wrapper.find('[data-test="data-attrs-trigger"]').exists()).toBe(
      false,
    );
    const empty = mount(DataAttrPermissions, {
      props: { attributes: [{ ...attributes[0], values: [] }], selected: [] },
    });
    expect(empty.find('button').exists()).toBe(false);
  });

  it('多字段分别显示，部分选择回显，全选只发送当前具体许可', async () => {
    const wrapper = mount(DataAttrPermissions, {
      attachTo: document.body,
      props: { attributes, selected: [customer] },
    });
    const body = await open(wrapper);
    expect(body.text()).toContain('客户类型');
    expect(body.text()).toContain('所属区域');
    expect(body.text()).toContain('未勾选表示无许可');
    expect(
      body.get('[data-test="data-attr-all-type"]').attributes('aria-checked'),
    ).not.toBe('true');
    await body.get('[data-test="data-attr-all-type"]').setValue(true);
    expect(wrapper.emitted('toggle')?.at(-1)).toEqual([
      [customer, supplier],
      true,
    ]);
    await wrapper.setProps({ selected: [customer, supplier] });
    await body.get('[data-test="data-attr-all-type"]').setValue(false);
    expect(wrapper.emitted('toggle')?.at(-1)).toEqual([
      [customer, supplier],
      false,
    ]);
  });

  it('重复字段和值去重，禁用状态不发授权事件', async () => {
    const wrapper = mount(DataAttrPermissions, {
      attachTo: document.body,
      props: {
        attributes: [...attributes, ...attributes],
        disabled: true,
        selected: [],
      },
    });
    const body = await open(wrapper);
    expect(
      body.findAll(`[data-test="data-attr-value-${customer}"]`),
    ).toHaveLength(1);
    expect(
      (
        body.get(`[data-test="data-attr-value-${customer}"]`)
          .element as HTMLInputElement
      ).disabled,
    ).toBe(true);
    expect(wrapper.emitted('toggle')).toBeUndefined();
  });

  it('资源共享一次配置，保留其它权限，不隐式授予操作，拒绝伪造表达式', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: { permissionTree: tree, value: ['legacy:other::read'] },
    });
    const control = wrapper.getComponent(DataAttrPermissions);
    control.vm.$emit('toggle', [customer, 'fake:value'], true);
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([
      'legacy:other::read',
      customer,
    ]);
    await wrapper.setProps({
      value: [action, customer, east, 'legacy:other::read'],
    });
    control.vm.$emit('toggle', [customer], false);
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([
      action,
      east,
      'legacy:other::read',
    ]);
  });

  it('取消单个操作保留范围，取消完整资源清理其范围和操作', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: tree,
        value: [action, update, customer, east, 'legacy:other::read'],
      },
    });
    await wrapper.get(`[data-test="permission-${update}"]`).setValue(false);
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([
      action,
      customer,
      east,
      'legacy:other::read',
    ]);
    await wrapper.get('[data-test="permission-node-partner"]').setValue(false);
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([
      'legacy:other::read',
    ]);
  });

  it('取消模块清理范围，勾选模块不自动全授范围', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: { permissionTree: tree, value: [action, update, customer, east] },
    });
    await wrapper.get('[data-test="permission-tree-toggle"]').setValue(false);
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([]);
    await wrapper.setProps({ value: [] });
    await wrapper.get('[data-test="permission-tree-toggle"]').setValue(true);
    expect(wrapper.emitted('update:value')?.at(-1)?.[0]).toEqual([
      action,
      update,
    ]);
  });

  it('重复资源投影合并元数据并同步已选状态，单选模式不展示范围编辑', async () => {
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: [
          {
            ...tree[0],
            children: [
              { ...resource, dataAttrs: [attributes[0]] },
              { ...resource, dataAttrs: [attributes[1]] },
            ],
          },
        ],
        value: [customer],
      },
    });
    const controls = wrapper.findAllComponents(DataAttrPermissions);
    expect(controls).toHaveLength(2);
    for (const control of controls) {
      expect(control.props('attributes')).toHaveLength(2);
      expect(control.props('selected')).toEqual([customer]);
    }
    await wrapper.setProps({ selectionMode: 'single' });
    expect(wrapper.findComponent(DataAttrPermissions).exists()).toBe(false);
  });

  it('存量通配许可按实际匹配回显枚举值和字段全选', async () => {
    const wrapper = mount(DataAttrPermissions, {
      attachTo: document.body,
      props: { attributes, selected: ['demo:枚举范围:Partner.type:*'] },
    });
    const body = await open(wrapper);
    for (const expression of [customer, supplier]) {
      expect(
        (
          body.get(`[data-test="data-attr-value-${expression}"]`)
            .element as HTMLInputElement
        ).checked,
      ).toBe(true);
    }
    expect(
      (body.get('[data-test="data-attr-all-type"]').element as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (
        body.get(`[data-test="data-attr-value-${east}"]`)
          .element as HTMLInputElement
      ).checked,
    ).toBe(false);
  });

  it('取消通配覆盖的单值解除通配并保留其它枚举、操作和存量许可', () => {
    const wildcard = 'demo:枚举范围:Partner.*:*';
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: {
        permissionTree: tree,
        value: [action, wildcard, 'legacy:other::read'],
      },
    });
    wrapper
      .getComponent(DataAttrPermissions)
      .vm.$emit('toggle', [customer], false);
    const result = wrapper.emitted('update:value')?.at(-1)?.[0];
    expect(new Set(result as string[])).toEqual(
      new Set([action, east, 'legacy:other::read', supplier]),
    );
    expect(result).not.toContain(wildcard);
    expect(result).not.toContain(customer);
  });

  it('保存映射包含完整枚举许可，未知存量许可原样保留', () => {
    expect(collectKnownPermissionTreeValues(tree)).toEqual(
      new Set([action, customer, east, supplier, update]),
    );
    expect(
      splitMappedAndUnmappedPermissions(
        [action, customer, 'legacy:other::read'],
        [],
        tree,
      ),
    ).toEqual({ mapped: [customer, action], unmapped: ['legacy:other::read'] });
  });
});
