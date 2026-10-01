import type { FlowNode } from './nodes/type';

import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import FlowDesign from './index.vue';

const process: FlowNode = {
  id: 'start-1',
  name: '发起',
  type: 'start',
  nextEdgeId: 'edge-start',
  next: {
    id: 'gateway-1',
    name: '金额判断',
    type: 'exclusiveGateway',
    joinId: 'join-1',
    branches: [
      {
        id: 'branch:edge-low',
        name: '低额',
        type: 'condition',
        edgeId: 'edge-low',
        condition: { field: 'amount' },
        next: {
          id: 'task-low',
          name: '主管审批',
          type: 'userTask',
          nextEdgeId: 'edge-low-join',
          nextTargetId: 'join-1',
        },
      },
      {
        id: 'branch:edge-default',
        name: '其他',
        type: 'condition',
        edgeId: 'edge-default',
        default: true,
        next: {
          id: 'task-high',
          name: '财务审批',
          type: 'userTask',
          nextEdgeId: 'edge-high-join',
          nextTargetId: 'join-1',
        },
      },
    ],
    next: {
      id: 'join-1',
      name: '汇聚',
      type: 'exclusiveGateway',
      nextEdgeId: 'edge-end',
      next: { id: 'end-1', name: '完成', type: 'end' },
    },
  },
};

describe('copied lowflow FlowDesign canvas', () => {
  it('renders every branch and the real join once, with server supplied status only', () => {
    const wrapper = mount(FlowDesign, {
      props: {
        process,
        readOnly: true,
        nodeStatuses: { 'task-low': 'active' },
      },
    });

    expect(wrapper.findAll('[data-node-id="join-1"]')).toHaveLength(1);
    expect(
      wrapper.find('[data-node-id="task-low"]').attributes('data-status'),
    ).toBe('active');
    expect(
      wrapper.find('[data-node-id="task-high"]').attributes('data-status'),
    ).toBeUndefined();
    expect(wrapper.find('[data-edge-id="edge-low"]').exists()).toBe(true);
    expect(wrapper.find('[data-edge-id="edge-high-join"]').exists()).toBe(true);
    expect(wrapper.find('[data-join-id="join-1"]').exists()).toBe(true);

    wrapper.find('[data-node-id="task-low"]').trigger('click');
    wrapper.find('[data-node-id="branch:edge-low"]').trigger('click');
    expect(wrapper.emitted('nodeClick')).toBeUndefined();
    expect(wrapper.emitted('edgeClick')).toBeUndefined();
  });

  it('emits stable node and edge IDs for the host property controls', async () => {
    const wrapper = mount(FlowDesign, { props: { process } });

    await wrapper.find('[data-node-id="task-low"]').trigger('click');
    await wrapper.find('[data-node-id="branch:edge-low"]').trigger('click');

    expect(wrapper.emitted('nodeClick')?.[0]).toEqual(['task-low']);
    expect(wrapper.emitted('edgeClick')?.[0]).toEqual(['edge-low']);
    await wrapper.setProps({ selectedEdgeId: 'edge-low' });
    expect(
      wrapper
        .find('[data-node-id="branch:edge-low"]')
        .attributes('aria-pressed'),
    ).toBe('true');
  });

  it('在同一画布内承载宿主属性栏并沿用主题布局', () => {
    const wrapper = mount(FlowDesign, {
      props: { process },
      slots: {
        properties: '<section aria-label="节点属性">受控节点设置</section>',
      },
    });

    expect(wrapper.get('[data-flow-design]').classes()).toContain(
      'with-properties',
    );
    expect(
      wrapper
        .find('[data-flow-design] > .designer-main .canvas-content')
        .exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-flow-design] > .designer-properties').exists(),
    ).toBe(true);
    expect(wrapper.get('[aria-label="节点属性"]').text()).toBe('受控节点设置');
  });
});
