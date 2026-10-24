/* eslint-disable vue/one-component-per-file -- 测试需要多个受控宿主验证重挂载与独立任务图。 */
/* 多个受控测试宿主用于模拟窗口保留挂载和重新挂载。 */

import type { WorkflowDefinitionVersion } from './types';
import type { WorkflowStateGraph } from './workflow-state-graph';
import type { WorkflowTaskGraph } from './workflow-task-graph';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';

import { Button, Input } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import { definitionFingerprint } from './definition-model';
import WorkflowDefinitionWorkbench from './workflow-definition-workbench.vue';
import { WorkflowDesignerService } from './workflow-designer-service';
import { createTaskGraph } from './workflow-task-graph';

vi.mock('@levin/admin-framework', () => ({
  RequestService: class {
    constructor(readonly basePath: string) {}
  },
  UserOrgSelector: {
    name: 'UserOrgSelector',
    props: ['modelValue', 'disabled', 'selectedRecords'],
    template: '<div />',
  },
}));
function definition(): WorkflowStateGraph {
  return {
    schemaVersion: 4,
    name: '真实审批',
    processKey: 'proof_review',
    businessBinding: {
      businessEntityKey: 'example.Order',
      stateField: 'state',
      stateType: 'string',
      stateMapping: [
        { value: 'Draft', label: '草稿' },
        { value: 'Review', label: '审批' },
        { value: 'Done', label: '完成' },
      ],
    },
    startNodeId: 'draft',
    nodes: [
      { id: 'draft', name: '草稿', stateValue: 'Draft' },
      {
        id: 'review',
        name: '审批',
        stateValue: 'Review',
        approval: {
          mode: 'NONE',
          candidateUsers: ['u'],
          candidateGroups: [],
          completionEvent: 'approved',
        },
      },
      {
        id: 'done',
        name: '完成',
        stateValue: 'Done',
        terminal: true,
        outcome: 'Approved',
      },
    ],
    events: [
      { id: 'submit', title: '提交', trigger: 'manual' },
      { id: 'approved', title: '同意', trigger: 'task' },
    ],
    edges: [
      { id: 'a', source: 'draft', event: 'submit', target: 'review' },
      { id: 'b', source: 'review', event: 'approved', target: 'done' },
    ],
    simulationPolicy: {
      cases: [
        {
          variables: {},
          steps: [{ event: 'submit' }, { action: 'approve', userId: 'u' }],
        },
      ],
    },
  };
}

describe('固定版本模拟证明与查看状态', () => {
  it('真实组件模拟refreshed后缩窄、关闭重开及重挂载不产生坐标或别名修改，真实编辑仍撤销发布资格', async () => {
    const graph = definition();
    const current = ref<WorkflowDefinitionVersion>({
      id: 'v2',
      lifecycle: 'Draft',
      lowflowDefinition: structuredClone(graph),
    });
    const model = ref<WorkflowStateGraph>(structuredClone(graph));
    const key = ref(0);
    const open = ref(true);
    const width = ref('1280px');
    const service = new WorkflowDesignerService();
    // 服务响应对象键顺序与打开前不同，语义相同仍应是未修改状态。
    const responseGraph = {
      ...graph,
      nodes: graph.nodes.map(
        (node) =>
          Object.fromEntries(Object.entries(node).toReversed()) as typeof node,
      ),
    };
    vi.spyOn(service, 'startSimulation').mockResolvedValue({
      id: 'v2',
      lifecycle: 'Testing',
      lowflowDefinition: structuredClone(responseGraph),
      simulationReport: {
        successful: true,
        coveredBranches: ['a', 'b'],
        uncoveredBranches: [],
      },
    });
    const host = defineComponent({
      setup: () => () =>
        h(
          'div',
          { style: { display: open.value ? '' : 'none', width: width.value } },
          [
            h(WorkflowDefinitionWorkbench, {
              key: key.value,
              definition: model.value,
              version: current.value,
              service,
              options: {
                users: [{ id: 'u', label: '办理人' }],
                stateBusinessObjects: [
                  {
                    entityKey: 'example.Order',
                    title: '订单',
                    provider: 'jpa',
                    selectable: true,
                    fields: [
                      {
                        key: 'workflowStatus',
                        title: '业务状态',
                        type: 'string',
                        nullable: false,
                        stateFieldAllowed: true,
                        conditionAllowed: true,
                      },
                    ],
                  },
                ],
              },
              onRefreshed: (value) => {
                current.value = value;
              },
              'onUpdate:definition': (value) => {
                if (value.schemaVersion === 4) model.value = value;
              },
            }),
          ],
        ),
    });
    const wrapper = mount(host);
    await flushPromises();
    const button = (text: string) =>
      wrapper
        .findAllComponents(Button)
        .find((item) => item.text().replaceAll(/\s/g, '') === text);
    expect(button('保存草稿')?.props('disabled')).toBe(true);
    await button('执行检查')?.trigger('click');
    await flushPromises();
    expect(button('发布')?.props('disabled')).toBe(false);
    expect(model.value).not.toBe(current.value.lowflowDefinition);
    const snapshot = definitionFingerprint(model.value);
    wrapper
      .findAllComponents(Input)
      .find((input) => input.props('value') === '草稿')
      ?.vm.$emit('update:value', '草稿');
    await flushPromises();
    expect(definitionFingerprint(model.value)).toBe(snapshot);
    const node = wrapper.get('button[aria-label="配置状态 草稿"]');
    Object.defineProperty(node.element, 'setPointerCapture', {
      value: () => {},
    });
    await node.trigger('pointerdown', {
      button: 0,
      buttons: 1,
      clientX: 100,
      clientY: 100,
    });
    await node.trigger('pointermove', {
      buttons: 1,
      clientX: 100,
      clientY: 100,
    });
    await node.trigger('lostpointercapture');
    width.value = '700px';
    open.value = false;
    await flushPromises();
    await node.trigger('pointermove', {
      buttons: 0,
      clientX: 160,
      clientY: 140,
    });
    open.value = true;
    await flushPromises();
    key.value++;
    await flushPromises();
    expect(definitionFingerprint(model.value)).toBe(snapshot);
    expect(model.value.nodes[0]).not.toHaveProperty('x');
    expect(model.value.variables).toBeUndefined();
    expect(button('保存草稿')?.props('disabled')).toBe(true);
    expect(button('发布')?.props('disabled')).toBe(false);
    wrapper
      .findAllComponents(Input)
      .find((input) => input.props('value') === '草稿')
      ?.vm.$emit('update:value', '草稿修改');
    await flushPromises();
    expect(button('保存草稿')?.props('disabled')).toBe(false);
    expect(button('发布')?.props('disabled')).toBe(true);
    const saved = current.value.lowflowDefinition;
    expect(saved?.schemaVersion === 4 ? saved.nodes[0]?.name : undefined).toBe(
      '草稿',
    );
  });
});

// 新任务图同样必须保留已保存证明，查看字段目录不能成为一次设计修改。
describe('任务图工作台证明边界', () => {
  it('测试通过的任务图打开保持可发布，真实修改撤销发布资格且不污染版本', async () => {
    const graph = createTaskGraph(
      definition().businessBinding,
      'task_proof',
      '任务审批',
    );
    const current = ref<WorkflowDefinitionVersion>({
      id: 'task-v1',
      lifecycle: 'Testing',
      lowflowDefinition: structuredClone(graph),
      simulationReport: { successful: true },
    });
    const model = ref<WorkflowTaskGraph>(structuredClone(graph));
    const service = new WorkflowDesignerService();
    vi.spyOn(service, 'saveDraft').mockRejectedValue({
      msg: '草稿修订已改变，请刷新后重试。',
    });
    const host = defineComponent({
      setup: () => () =>
        h(WorkflowDefinitionWorkbench, {
          definition: model.value,
          version: current.value,
          service,
          options: {
            stateBusinessObjects: [
              {
                entityKey: 'example.Order',
                title: '订单',
                provider: 'jpa',
                selectable: true,
                fields: [
                  {
                    key: 'amount',
                    title: '金额',
                    type: 'integer',
                    stateFieldAllowed: false,
                    nullable: false,
                    conditionAllowed: true,
                  },
                ],
              },
            ],
          },
          'onUpdate:definition': (value) => {
            if (value.schemaVersion === 5) model.value = value;
          },
        }),
    });
    const wrapper = mount(host);
    await flushPromises();
    const button = (text: string) =>
      wrapper
        .findAllComponents(Button)
        .find((item) => item.text().replaceAll(/\s/g, '') === text);
    expect(button('保存草稿')?.props('disabled')).toBe(true);
    expect(button('发布')?.props('disabled')).toBe(false);
    expect(model.value.variables).toEqual({});
    wrapper
      .findAllComponents(Input)
      .find((input) => input.props('value') === '开始')
      ?.vm.$emit('update:value', '开始申请');
    await flushPromises();
    expect(button('保存草稿')?.props('disabled')).toBe(false);
    expect(button('发布')?.props('disabled')).toBe(true);
    const saved = current.value.lowflowDefinition;
    expect(saved?.schemaVersion === 5 ? saved.nodes[0]?.name : undefined).toBe(
      '开始',
    );
    await button('保存草稿')?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('草稿修订已改变，请刷新后重试。');
    expect(model.value.nodes[0]?.name).toBe('开始申请');
    expect(button('保存草稿')?.props('disabled')).toBe(false);
    wrapper.unmount();
  });
});
