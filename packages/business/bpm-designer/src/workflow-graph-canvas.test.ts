import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import WorkflowGraphCanvas from './workflow-graph-canvas.vue';

const props = {
  nodes: [
    { id: 'draft', name: '草稿', x: 60, y: 100 },
    { id: 'review', name: '审批中', x: 380, y: 100 },
    { id: 'end', name: '已结束', terminal: true, x: 700, y: 100 },
  ],
  edges: [
    { id: 'a', source: 'draft', target: 'end', label: '取消' },
    { id: 'b', source: 'review', target: 'end', label: '取消' },
    { id: 'c', source: 'review', target: 'draft', label: '退回' },
    { id: 'd', source: 'review', target: 'review', label: '重新核验' },
  ],
};
describe('真实状态图画布', () => {
  it('共享目标只画一个节点，显示多条入线与回环，选中保持原身份', async () => {
    const wrapper = mount(WorkflowGraphCanvas, { props });
    expect(wrapper.findAll('[data-node-id="end"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-edge-id]')).toHaveLength(4);
    expect(wrapper.get('[data-edge-id="d"] path').attributes('d')).toContain(
      'L',
    );
    await wrapper.get('[data-edge-id="b"] .edge-hit').trigger('click');
    expect(wrapper.emitted('edgeClick')?.[0]).toEqual(['b']);
    await wrapper
      .get('button[aria-label="从 审批中 添加路线"]')
      .trigger('click');
    expect(wrapper.emitted('addFrom')?.[0]).toEqual(['review']);
  });
  it('只读图关闭编辑和新增，不从节点排序推测路线', async () => {
    const wrapper = mount(WorkflowGraphCanvas, {
      props: { ...props, readOnly: true },
    });
    expect(wrapper.find('.add-node').exists()).toBe(false);
    await wrapper.get('[data-edge-id="c"] .edge-hit').trigger('click');
    expect(wrapper.emitted('edgeClick')).toBeUndefined();
    const node = wrapper.get('button[aria-label="查看状态 审批中"]');
    expect(node.attributes('disabled')).toBeDefined();
    await node.trigger('click');
    await node.trigger('pointerdown', { button: 0, clientX: 0, clientY: 0 });
    await node.trigger('pointermove', { clientX: 50, clientY: 50 });
    expect(wrapper.emitted('nodeClick')).toBeUndefined();
    expect(wrapper.emitted('moveNode')).toBeUndefined();
    expect(wrapper.findAll('[data-edge-id]')).toHaveLength(props.edges.length);
  });
  it('只读设计显式允许查看选择，仍禁止拖动和新增', async () => {
    const wrapper = mount(WorkflowGraphCanvas, {
      props: { ...props, readOnly: true, allowSelection: true },
    });
    const node = wrapper.get('button[aria-label="查看状态 审批中"]');
    expect(node.attributes('disabled')).toBeUndefined();
    await node.trigger('click');
    expect(wrapper.emitted('nodeClick')?.[0]).toEqual(['review']);
    const route = wrapper.get('[data-edge-id="b"] .edge-hit');
    expect(route.attributes('aria-label')).toBe('查看路线 取消');
    await route.trigger('click');
    expect(wrapper.emitted('edgeClick')?.[0]).toEqual(['b']);
    await node.trigger('pointerdown', { button: 0, clientX: 0, clientY: 0 });
    await node.trigger('pointermove', { clientX: 50, clientY: 50 });
    expect(wrapper.emitted('moveNode')).toBeUndefined();
    expect(wrapper.find('.add-node').exists()).toBe(false);
  });
  it('点击和布局产生的零位移或松开后的pointermove不应把缺省坐标写回图', async () => {
    const wrapper = mount(WorkflowGraphCanvas, {
      props: { nodes: [{ id: 'draft', name: '草稿' }], edges: [] },
    });
    const button = wrapper.get('button[aria-label="配置状态 草稿"]');
    Object.defineProperty(button.element, 'setPointerCapture', {
      value: () => {},
    });
    await button.trigger('pointerdown', {
      button: 0,
      buttons: 1,
      clientX: 100,
      clientY: 100,
    });
    await button.trigger('pointermove', {
      buttons: 1,
      clientX: 100,
      clientY: 100,
    });
    expect(wrapper.emitted('moveNode')).toBeUndefined();
    await button.trigger('lostpointercapture');
    await button.trigger('pointermove', {
      buttons: 0,
      clientX: 160,
      clientY: 140,
    });
    expect(wrapper.emitted('moveNode')).toBeUndefined();
  });

  it('实际按住移动超过阈值才提交新坐标，松开后不再提交', async () => {
    const wrapper = mount(WorkflowGraphCanvas, {
      props: { nodes: [{ id: 'draft', name: '草稿' }], edges: [] },
    });
    const button = wrapper.get('button[aria-label="配置状态 草稿"]');
    Object.defineProperty(button.element, 'setPointerCapture', {
      value: () => {},
    });
    await button.trigger('pointerdown', {
      button: 0,
      buttons: 1,
      clientX: 100,
      clientY: 100,
    });
    await button.trigger('pointermove', {
      buttons: 1,
      clientX: 112,
      clientY: 106,
    });
    expect(wrapper.emitted('moveNode')?.[0]).toEqual(['draft', 72, 106]);
    await button.trigger('pointerup');
    await button.trigger('pointermove', {
      buttons: 0,
      clientX: 160,
      clientY: 140,
    });
    expect(wrapper.emitted('moveNode')).toHaveLength(1);
  });
});

// 连接点手势必须产生真实起终点，不能混入节点移动。
describe('拖线创建流转路线', () => {
  function canvas() {
    const wrapper = mount(WorkflowGraphCanvas, { props });
    return wrapper;
  }
  it('连接点显示预览线，松开到另一节点只创建一次路线', async () => {
    const wrapper = canvas();
    const port = wrapper.get('[data-node-id="draft"] .connect-port');
    await port.trigger('pointerdown', {
      button: 0,
      pointerId: 8,
      clientX: 240,
      clientY: 132,
    });
    const surface = wrapper.get('.graph-surface');
    await surface.trigger('pointermove', {
      buttons: 1,
      pointerId: 8,
      clientX: 400,
      clientY: 130,
    });
    expect(wrapper.get('.connection-preview').attributes('d')).toContain('400');
    expect(wrapper.get('[data-node-id="review"]').classes()).toContain(
      'connection-target',
    );
    await surface.trigger('pointerup', {
      pointerId: 8,
      clientX: 400,
      clientY: 130,
    });
    expect(wrapper.emitted('connect')).toEqual([['draft', 'review']]);
    expect(wrapper.find('.connection-preview').exists()).toBe(false);
    expect(wrapper.emitted('moveNode')).toBeUndefined();
  });
  it('空处释放、取消、Escape 均不产生路线', async () => {
    const wrapper = canvas();
    const port = wrapper.get('[data-node-id="draft"] .connect-port');
    const surface = wrapper.get('.graph-surface');
    for (const ending of ['pointerup', 'pointercancel', 'keydown']) {
      await port.trigger('pointerdown', { button: 0, pointerId: 8 });
      await surface.trigger('pointermove', {
        buttons: 1,
        pointerId: 8,
        clientX: 300,
        clientY: 300,
      });
      await surface.trigger(ending, {
        pointerId: 8,
        clientX: 300,
        clientY: 300,
        key: 'Escape',
      });
      expect(wrapper.find('.connection-preview').exists()).toBe(false);
    }
    expect(wrapper.emitted('connect')).toBeUndefined();
  });
  it('缩放后正确命中目标，开始节点不能作为目标', async () => {
    const wrapper = canvas();
    await wrapper.setProps({
      nodes: props.nodes.map((n) => ({
        ...n,
        type:
          n.id === 'review' ? ('startEvent' as const) : ('userTask' as const),
      })),
    });
    await wrapper.get('[aria-label="放大流程图"]').trigger('click');
    const port = wrapper.get('[data-node-id="draft"] .connect-port');
    const surface = wrapper.get('.graph-surface');
    await port.trigger('pointerdown', { button: 0, pointerId: 8 });
    await surface.trigger('pointerup', {
      pointerId: 8,
      clientX: 440,
      clientY: 143,
    });
    expect(wrapper.emitted('connect')).toBeUndefined();
    await port.trigger('pointerdown', { button: 0, pointerId: 8 });
    await surface.trigger('pointerup', {
      pointerId: 8,
      clientX: 792,
      clientY: 143,
    });
    expect(wrapper.emitted('connect')).toEqual([['draft', 'end']]);
  });
  it('切换只读取消连接，结束节点没有连接点', async () => {
    const wrapper = canvas();
    expect(wrapper.find('[data-node-id="end"] .connect-port').exists()).toBe(
      false,
    );
    await wrapper
      .get('[data-node-id="draft"] .connect-port')
      .trigger('pointerdown', { button: 0, pointerId: 8 });
    await wrapper.setProps({ readOnly: true, allowSelection: true });
    expect(wrapper.find('.connection-preview').exists()).toBe(false);
    expect(wrapper.find('.connect-port').exists()).toBe(false);
    await wrapper
      .get('.graph-surface')
      .trigger('pointerup', { pointerId: 8, clientX: 400, clientY: 130 });
    expect(wrapper.emitted('connect')).toBeUndefined();
  });
  it('显示任务图类型与并行区域高亮', () => {
    const wrapper = mount(WorkflowGraphCanvas, {
      props: {
        edges: [],
        highlightNodeIds: ['fork'],
        nodes: [
          { id: 'start', name: '开始', type: 'startEvent' },
          { id: 'end', name: '结束', type: 'endEvent' },
          { id: 'condition', name: '按金额分路', type: 'exclusiveGateway' },
          { id: 'fork', name: '同时办理', type: 'parallelGateway' },
          { id: 'user', name: '财务会签', type: 'userTask' },
          { id: 'auto', name: '更新状态', type: 'serviceTask' },
        ],
      },
    });
    expect(wrapper.get('[data-node-id="condition"]').classes()).toContain(
      'gateway',
    );
    expect(wrapper.get('[data-node-id="fork"]').classes()).toContain(
      'highlighted',
    );
    expect(wrapper.text()).toContain('人工办理');
    expect(wrapper.text()).toContain('自动处理');
    expect(wrapper.find('[data-node-id="end"] .connect-port').exists()).toBe(
      false,
    );
  });
});

// 视图缩放只改变显示，不得把坐标和缩放写回业务设计。
describe('画布适应与原始比例', () => {
  function viewport(
    wrapper: ReturnType<typeof mount>,
    width: number,
    height: number,
  ) {
    const scroll = wrapper.get('.graph-scroll').element;
    Object.defineProperty(scroll, 'clientWidth', {
      configurable: true,
      value: width,
    });
    Object.defineProperty(scroll, 'clientHeight', {
      configurable: true,
      value: height,
    });
  }
  it('初始保持100%，显式适应按可见宽高和内容边界计算，并可恢复100%', async () => {
    const wrapper = mount(WorkflowGraphCanvas, {
      props: { nodes: props.nodes, edges: [] },
    });
    viewport(wrapper, 434, 300);
    expect(wrapper.get('.graph-controls').text()).toContain('100%');
    await wrapper.get('[aria-label="适应画布"]').trigger('click');
    expect(wrapper.get('.graph-controls').text()).toContain('50%');
    expect(wrapper.emitted('moveNode')).toBeUndefined();
    expect(wrapper.emitted('connect')).toBeUndefined();
    await wrapper.get('[aria-label="恢复100%比例"]').trigger('click');
    expect(wrapper.get('.graph-controls').text()).toContain('100%');
  });
  it('只读也可适应，纵向内容参与缩放，小图不自动放大', async () => {
    const wrapper = mount(WorkflowGraphCanvas, {
      props: {
        nodes: [
          { id: 'a', name: '开始', x: 60, y: 100 },
          { id: 'b', name: '结束', x: 60, y: 700 },
        ],
        edges: [],
        readOnly: true,
      },
    });
    viewport(wrapper, 1000, 371);
    await wrapper.get('[aria-label="适应画布"]').trigger('click');
    expect(wrapper.get('.graph-controls').text()).toContain('50%');
    expect(wrapper.emitted('moveNode')).toBeUndefined();
    await wrapper.setProps({
      nodes: [{ id: 'a', name: '开始', x: 60, y: 100 }],
    });
    await wrapper.get('[aria-label="适应画布"]').trigger('click');
    expect(wrapper.get('.graph-controls').text()).toContain('100%');
  });
  it('回环伸出节点的路线也计入适应边界', async () => {
    const wrapper = mount(WorkflowGraphCanvas, {
      props: {
        nodes: [{ id: 'a', name: '重新办理', x: 60, y: 100 }],
        edges: [{ id: 'loop', source: 'a', target: 'a' }],
      },
    });
    viewport(wrapper, 130, 300);
    await wrapper.get('[aria-label="适应画布"]').trigger('click');
    expect(wrapper.get('.graph-controls').text()).toContain('50%');
    expect(wrapper.emitted('moveNode')).toBeUndefined();
  });
  it('适应后拖线仍按显示比例命中真实目标', async () => {
    const wrapper = mount(WorkflowGraphCanvas, {
      props: { nodes: props.nodes, edges: [] },
    });
    viewport(wrapper, 434, 300);
    await wrapper.get('[aria-label="适应画布"]').trigger('click');
    await wrapper
      .get('[data-node-id="draft"] .connect-port')
      .trigger('pointerdown', { button: 0, pointerId: 8 });
    await wrapper
      .get('.graph-surface')
      .trigger('pointerup', { pointerId: 8, clientX: 200, clientY: 65 });
    expect(wrapper.emitted('connect')).toEqual([['draft', 'review']]);
  });
});
