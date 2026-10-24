/* 测试宿主和子组件桩在同一文件构造，以验证受控值的双向往返。 */
/* eslint-disable vue/one-component-per-file */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, onMounted, ref, toRaw } from 'vue';

import { Button, InputNumber, Select } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowDesignerService } from './workflow-designer-service';
import WorkflowGraphWorkbench from './workflow-graph-workbench.vue';
import WorkflowSimulationForm from './workflow-simulation-form.vue';
import { createStateGraph } from './workflow-state-graph';

vi.mock('@levin/admin-framework', () => ({
  RequestService: class {
    constructor(readonly basePath: string) {}
  },
  UserOrgSelector: { template: '<div />' },
}));
const fields = [
  {
    key: 'amount',
    title: '申请金额',
    type: 'integer',
    nullable: false,
    stateFieldAllowed: false,
  },
  {
    key: 'category',
    title: '业务分类',
    type: 'string',
    nullable: false,
    stateFieldAllowed: false,
    options: [
      { value: 'normal', label: '普通业务' },
      { value: 'urgent', label: '紧急业务' },
    ],
  },
  {
    key: 'confirmed',
    title: '资料确认',
    type: 'boolean',
    nullable: false,
    stateFieldAllowed: false,
  },
];

describe('模拟办理步骤表单', () => {
  it('必填提示可见，数字0、固定选项和布尔false以原类型往返', async () => {
    const value = ref<Record<string, unknown>>({});
    const host = defineComponent({
      setup: () => () =>
        h(WorkflowSimulationForm, {
          fields,
          requiredFields: ['amount', 'category', 'confirmed'],
          modelValue: value.value,
          'onUpdate:modelValue': (next) => (value.value = next),
        }),
    });
    const wrapper = mount(host);
    expect(wrapper.text()).toContain('请填写申请金额');
    wrapper.findComponent(InputNumber).vm.$emit('update:value', 0);
    await flushPromises();
    wrapper.findAllComponents(Select)[0]?.vm.$emit('update:value', 'urgent');
    await flushPromises();
    wrapper.findAllComponents(Select)[1]?.vm.$emit('update:value', 'false');
    await flushPromises();
    expect(value.value).toEqual({
      amount: 0,
      category: 'urgent',
      confirmed: false,
    });
    expect(wrapper.text()).not.toContain('请填写申请金额');
    expect(wrapper.text()).not.toContain('请填写资料确认');
    const restored = mount(WorkflowSimulationForm, {
      props: {
        fields,
        modelValue: structuredClone({ ...value.value }),
        requiredFields: ['amount', 'category', 'confirmed'],
      },
    });
    expect(restored.findComponent(InputNumber).props('value')).toBe(0);
    expect(restored.findAllComponents(Select)[0]?.props('value')).toBe(
      'urgent',
    );
    expect(restored.findAllComponents(Select)[1]?.props('value')).toBe('false');
  });
  it('工作台按办理节点展示许可字段，并将typed formData保存到真实草稿参数', async () => {
    const graph = createStateGraph(
      {
        businessEntityKey: 'example.Request',
        stateField: 'state',
        stateType: 'string',
        stateMapping: [{ value: 'Review', label: '审批中' }],
      },
      'approval',
      '审批',
    );
    const start = graph.nodes[0];
    if (!start) throw new Error('测试夹具缺少状态');
    Object.assign(start, {
      approval: {
        mode: 'NONE',
        candidateUsers: ['user_1'],
        candidateGroups: [],
        completionEvent: 'approve',
      },
      readableFields: ['amount', 'category'],
      editableFields: ['amount', 'category'],
      requiredFields: ['amount'],
    });
    graph.events = [{ id: 'approve', title: '同意', trigger: 'task' }];
    graph.simulationPolicy = {
      cases: [
        {
          name: '填单办理',
          variables: {},
          steps: [
            {
              action: 'approve',
              nodeId: start.id,
              userId: 'user_1',
              formData: {},
            },
          ],
        },
      ],
    };
    const definition = ref(graph);
    const version = ref({
      id: 'v4',
      lifecycle: 'Draft' as const,
      lowflowDefinition: structuredClone(graph),
    });
    const service = new WorkflowDesignerService();
    const save = vi
      .spyOn(service, 'saveDraft')
      .mockImplementation(async (_id, value) => ({
        id: 'v4',
        lifecycle: 'Draft',
        lowflowDefinition: structuredClone(toRaw(value)),
      }));
    const host = defineComponent({
      setup: () => () =>
        h(WorkflowGraphWorkbench, {
          definition: definition.value,
          version: version.value,
          service,
          options: {
            stateBusinessObjects: [
              {
                entityKey: 'example.Request',
                title: '申请',
                provider: 'jpa',
                selectable: true,
                fields,
              },
            ],
          },
          'onUpdate:definition': (value) => {
            if (value.schemaVersion === 4) definition.value = value;
          },
          onRefreshed: (value) => {
            version.value = value as typeof version.value;
          },
        }),
    });
    const wrapper = mount(host, {
      global: {
        stubs: {
          ACollapse: { template: '<div><slot /></div>' },
          ACollapsePanel: { template: '<div><slot /></div>' },
          Collapse: { template: '<div><slot /></div>' },
          CollapsePanel: { template: '<div><slot /></div>' },
          WorkflowGraphDesigner: defineComponent({
            emits: ['validate'],
            setup(_props, { emit }) {
              onMounted(() => emit('validate', true, []));
              return () => h('div');
            },
          }),
        },
      },
    });
    await flushPromises();
    const form = wrapper.findComponent(WorkflowSimulationForm);
    expect(form.props('fields').map((field) => field.key)).toEqual([
      'amount',
      'category',
    ]);
    expect(form.props('requiredFields')).toEqual(['amount']);
    expect(
      wrapper
        .findAllComponents(Button)
        .find((button) => button.text() === '执行检查')
        ?.props('disabled'),
    ).toBe(true);
    form.findComponent(InputNumber).vm.$emit('update:value', 0);
    await flushPromises();
    form.findComponent(Select).vm.$emit('update:value', 'urgent');
    await flushPromises();
    expect(
      definition.value.simulationPolicy?.cases[0]?.steps[0]?.formData,
    ).toEqual({ amount: 0, category: 'urgent' });
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '保存草稿')
      ?.trigger('click');
    await flushPromises();
    expect(save).toHaveBeenCalledWith(
      'v4',
      expect.objectContaining({
        simulationPolicy: {
          cases: [
            expect.objectContaining({
              steps: [
                expect.objectContaining({
                  nodeId: 'state_1',
                  formData: { amount: 0, category: 'urgent' },
                }),
              ],
            }),
          ],
        },
      }),
      undefined,
    );
    expect(
      wrapper
        .findAllComponents(Button)
        .find((button) => button.text() === '执行检查')
        ?.props('disabled'),
    ).toBe(false);
  });
  it.each([
    { formData: undefined, allowed: true },
    { formData: { amount: 0 }, allowed: false },
  ])(
    '历史人工步骤缺nodeId时仅在有表单数据时阻断模拟：$allowed',
    async ({ formData, allowed }) => {
      const graph = createStateGraph(
        {
          businessEntityKey: 'example.Request',
          stateField: 'state',
          stateType: 'string',
          stateMapping: [{ value: 'Review', label: '审批' }],
        },
        'review',
        '审批',
      );
      graph.simulationPolicy = {
        cases: [
          {
            variables: {},
            steps: [
              {
                action: 'approve',
                userId: 'user_1',
                ...(formData ? { formData } : {}),
              },
            ],
          },
        ],
      };
      const wrapper = mount(WorkflowGraphWorkbench, {
        props: {
          definition: graph,
          version: {
            id: 'v1',
            lifecycle: 'Draft',
            lowflowDefinition: structuredClone(graph),
          },
        },
        global: {
          stubs: {
            ACollapse: { template: '<div><slot /></div>' },
            ACollapsePanel: { template: '<div><slot /></div>' },
            WorkflowGraphDesigner: defineComponent({
              emits: ['validate'],
              setup(_props, { emit }) {
                onMounted(() => emit('validate', true, []));
                return () => h('div');
              },
            }),
          },
        },
      });
      await flushPromises();
      expect(
        wrapper
          .findAllComponents(Button)
          .find((button) => button.text() === '执行检查')
          ?.props('disabled'),
      ).toBe(!allowed);
      expect(wrapper.text().includes('第 1 步请选择办理状态')).toBe(!allowed);
    },
  );
});
