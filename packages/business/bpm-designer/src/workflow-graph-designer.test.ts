/* 测试中以多个受控宿主验证独立组件的状态往返。 */
/* eslint-disable vue/one-component-per-file */
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';

import { Select } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import WorkflowConditionEditor from './workflow-condition-editor.vue';
import WorkflowGraphDesigner from './workflow-graph-designer.vue';
import { createStateGraph } from './workflow-state-graph';

vi.mock('@levin/admin-framework', () => ({
  UserOrgSelector: {
    name: 'UserOrgSelector',
    props: ['modelValue', 'disabled', 'selectedRecords'],
    template: '<div data-user-selector />',
  },
}));
function setup(readonly = false) {
  const graph = createStateGraph(
    {
      businessEntityKey: 'example.Order',
      stateField: 'state',
      stateType: 'integer',
      stateMapping: [
        { value: 0, label: '草稿' },
        { value: 1, label: '审批中' },
        { value: 2, label: '已结束' },
      ],
    },
    'order',
    '订单流程',
  );
  graph.nodes = graph.businessBinding.stateMapping.map((state, index) => ({
    id: `state_${index + 1}`,
    name: state.label,
    stateValue: state.value,
    x: 60 + index * 320,
    y: 100,
  }));
  const terminal = graph.nodes[2];
  if (!terminal) throw new Error('测试夹具缺少结束状态');
  terminal.terminal = true;
  graph.events = [{ id: 'cancel', title: '取消', trigger: 'manual' }];
  graph.edges = [
    { id: 'a', source: 'state_1', target: 'state_3', event: 'cancel' },
    { id: 'b', source: 'state_2', target: 'state_3', event: 'cancel' },
  ];
  const value = ref(graph);
  const host = defineComponent({
    components: { WorkflowGraphDesigner },
    setup: () => ({
      value,
      readonly,
      options: {
        stateBusinessObjects: [
          {
            entityKey: 'example.Order',
            title: '订单',
            provider: 'jpa',
            selectable: true,
            fields: [
              {
                key: 'state',
                title: '状态',
                type: 'integer',
                nullable: false,
                stateFieldAllowed: true,
              },
              {
                key: 'category',
                title: '订单分类',
                type: 'integer',
                nullable: false,
                stateFieldAllowed: false,
                conditionAllowed: true,
                options: [
                  { value: 0, label: '普通订单' },
                  { value: 1, label: '特急订单' },
                ],
              },
            ],
          },
        ],
      },
    }),
    template:
      '<WorkflowGraphDesigner v-model="value" :readonly="readonly" :options="options" />',
  });
  return { wrapper: mount(host), value };
}
describe('状态图上下文编辑', () => {
  it('节点旁添加路线连接原有目标，不复制已有状态', async () => {
    const { wrapper, value } = setup();
    await wrapper.get('button[aria-label="从 草稿 添加路线"]').trigger('click');
    expect(value.value.nodes).toHaveLength(3);
    expect(value.value.edges).toHaveLength(3);
    expect(wrapper.text()).toContain('流转条件');
    const target = wrapper
      .findAllComponents(Select)
      .find(
        (select) =>
          select
            .props('options')
            ?.some((option) => option.value === 'state_3') &&
          select.props('value') === 'state_2',
      );
    target?.vm.$emit('update:value', 'state_3');
    await flushPromises();
    expect(value.value.edges.at(-1)?.target).toBe('state_3');
    expect(
      value.value.nodes.filter((node) => node.id === 'state_3'),
    ).toHaveLength(1);
  });
  it('点击节点显示同一状态多条进入路线及OA配置入口', async () => {
    const { wrapper } = setup();
    await wrapper.get('button[aria-label="配置状态 已结束"]').trigger('click');
    expect(wrapper.text()).toContain('进入路线（2）');
    expect(wrapper.text()).toContain('进入 / 离开通知');
    expect(wrapper.text()).toContain('抄送（只知会，不阻塞审批）');
    await wrapper.get('button[aria-label="配置状态 审批中"]').trigger('click');
    expect(wrapper.text()).toContain('办理人和审批方式');
    expect(wrapper.text()).toContain('表单权限');
  });
  it('字典比较值显示中文标签并提交整数0', async () => {
    const wrapper = mount(WorkflowConditionEditor, {
      props: {
        modelValue: { eq: [{ variable: 'category' }, { literal: 1 }] },
        variables: {
          category: {
            source: 'business.category',
            readAt: 'node',
            type: 'integer',
          },
        },
        variableLabels: { category: '订单分类' },
        variableOptions: {
          category: [
            { value: 0, label: '普通订单' },
            { value: 1, label: '特急订单' },
          ],
        },
      },
    });
    expect(wrapper.text()).toContain('普通订单');
    await wrapper.get('select[aria-label="条件比较值"]').setValue('0');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      { eq: [{ variable: 'category' }, { literal: 0 }] },
    ]);
  });
  it('发布版本的只读图关闭新增和属性编辑', () => {
    const { wrapper, value } = setup(true);
    expect(wrapper.find('.add-node').exists()).toBe(false);
    const before = JSON.stringify(value.value);
    expect(
      wrapper
        .findAllComponents(Select)
        .every((select) => select.props('disabled')),
    ).toBe(true);
    expect(JSON.stringify(value.value)).toBe(before);
  });
  it('已发布设计可以选择审批状态和路线查看配置，但不能修改保存值', async () => {
    const { wrapper, value } = setup(true);
    const review = value.value.nodes.find((node) => node.id === 'state_2');
    if (!review) throw new Error('测试夹具缺少审批状态');
    review.approval = {
      mode: 'ALL',
      candidateUsers: ['saved_user'],
      candidateGroups: ['role:manager'],
      completionEvent: 'cancel',
    };
    review.readableFields = ['category'];
    review.editableFields = ['category'];
    review.requiredFields = ['category'];
    await flushPromises();
    const before = JSON.stringify(value.value);
    await wrapper.get('button[aria-label="查看状态 审批中"]').trigger('click');
    const mode = wrapper
      .findAllComponents(Select)
      .find((select) => select.props('value') === 'ALL');
    expect(mode?.props('disabled')).toBe(true);
    expect(wrapper.find('[data-user-selector]').exists()).toBe(true);
    const userSelector = wrapper.findComponent({ name: 'UserOrgSelector' });
    // 真实选择器在本测试中使用组件桩，检查已保存的人员仍交给只读控件显示。
    expect(userSelector.props('modelValue')).toEqual(['saved_user']);
    expect(userSelector.props('disabled')).toBe(true);
    mode?.vm.$emit('update:value', 'ANY');
    await flushPromises();
    expect(JSON.stringify(value.value)).toBe(before);
    await wrapper.get('[data-edge-id="b"] .edge-hit').trigger('click');
    expect(wrapper.text()).toContain('流转条件');
    expect(
      wrapper
        .findAllComponents(Select)
        .every((select) => select.props('disabled')),
    ).toBe(true);
    expect(wrapper.find('.add-node').exists()).toBe(false);
  });
  it('前缀人员值使用授权候选中文名，目录刷新更新显示但未知ID仍保留', async () => {
    const graph = createStateGraph(
      {
        businessEntityKey: 'example.Order',
        stateField: 'state',
        stateType: 'integer',
        stateMapping: [{ value: 1, label: '审批' }],
      },
      'review',
      '审批',
    );
    const node = graph.nodes[0];
    if (!node) throw new Error('测试夹具缺少审批状态');
    node.approval = {
      mode: 'SEQUENTIAL',
      candidateUsers: ['user:known', 'user:unknown'],
      candidateGroups: [],
      completionEvent: 'done',
    };
    const wrapper = mount(WorkflowGraphDesigner, {
      props: { modelValue: graph, readonly: true, options: { users: [] } },
    });
    const selector = wrapper.findComponent({ name: 'UserOrgSelector' });
    expect(selector.props('selectedRecords')).toEqual([]);
    await wrapper.setProps({
      options: { users: [{ id: 'known', label: '超级管理员', kind: 'user' }] },
    });
    expect(selector.props('selectedRecords')).toEqual([
      { id: 'known', kind: 'user', name: '超级管理员' },
    ]);
    expect(selector.props('modelValue')).toEqual([
      'user:known',
      'user:unknown',
    ]);
    expect(wrapper.text()).toContain('超级管理员');
    expect(wrapper.text()).toContain('user:unknown');
    await wrapper.setProps({
      options: {
        users: [{ id: 'known', label: '管理员（更新）', kind: 'user' }],
      },
    });
    expect(selector.props('selectedRecords')).toEqual([
      { id: 'known', kind: 'user', name: '管理员（更新）' },
    ]);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
  it('公开workflowStatus字段使用安全别名建立条件，真实来源不变且处理普通字段碰撞', async () => {
    const graph = createStateGraph(
      {
        businessEntityKey: 'example.Order',
        stateField: 'state',
        stateType: 'string',
        stateMapping: [{ value: 'Draft', label: '草稿' }],
      },
      'review',
      '审批',
    );
    graph.events = [{ id: 'check', title: '检查', trigger: 'manual' }];
    graph.edges = [
      { id: 'route', source: 'state_1', target: 'state_1', event: 'check' },
    ];
    const value = ref(graph);
    const host = defineComponent({
      setup: () => () =>
        h(WorkflowGraphDesigner, {
          modelValue: value.value,
          options: {
            stateBusinessObjects: [
              {
                entityKey: 'example.Order',
                title: '订单',
                provider: 'jpa',
                selectable: true,
                fields: [
                  {
                    key: 'workflowStatus',
                    title: '业务阶段',
                    type: 'string',
                    nullable: false,
                    stateFieldAllowed: true,
                    conditionAllowed: true,
                  },
                  {
                    key: 'business_workflowStatus',
                    title: '其它字段',
                    type: 'string',
                    nullable: false,
                    stateFieldAllowed: true,
                    conditionAllowed: true,
                  },
                ],
              },
            ],
          },
          'onUpdate:modelValue': (next) => (value.value = next),
        }),
    });
    const wrapper = mount(host);
    await wrapper.get('[data-edge-id="route"] .edge-hit').trigger('click');
    const condition = wrapper.findComponent(WorkflowConditionEditor);
    const variables = condition.props('variables') ?? {};
    expect(variables.business_workflowStatus_2?.source).toBe(
      'business.workflowStatus',
    );
    expect(variables.business_workflowStatus?.source).toBe(
      'business.business_workflowStatus',
    );
    condition.vm.$emit('update:modelValue', {
      eq: [{ variable: 'business_workflowStatus_2' }, { literal: 'Open' }],
    });
    await flushPromises();
    expect(value.value.variables?.business_workflowStatus_2?.source).toBe(
      'business.workflowStatus',
    );
    expect(value.value.variables).not.toHaveProperty('workflowStatus');
    expect(value.value.edges[0]?.condition).toEqual({
      eq: [{ variable: 'business_workflowStatus_2' }, { literal: 'Open' }],
    });
  });
});
