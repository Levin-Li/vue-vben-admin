import { flushPromises, mount } from '@vue/test-utils';

import { Popconfirm } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import WorkflowStateEvents from './workflow-state-events.vue';

describe('状态事件操作', () => {
  it('失败重试使用同一幂等键，切换状态访问后创建新命令', async () => {
    // 模拟请求结果丢失，用户重试不能产生第二次流转。
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('请求超时'))
      .mockResolvedValue({});
    const wrapper = mount(WorkflowStateEvents, {
      props: {
        instanceId: 'instance',
        visitId: 'visit-1',
        events: [{ value: 'cancel', label: '取消申请' }],
        execute,
      },
    });
    wrapper.findComponent(Popconfirm).vm.$emit('confirm');
    await flushPromises();
    expect(wrapper.text()).toContain('请求超时');
    wrapper.findComponent(Popconfirm).vm.$emit('confirm');
    await flushPromises();
    expect(execute.mock.calls[0]?.[0]).toEqual(execute.mock.calls[1]?.[0]);
    expect(execute.mock.calls[0]?.[0]).toMatchObject({
      instanceId: 'instance',
      eventId: 'cancel',
      expectedVisitId: 'visit-1',
    });
    expect(Object.keys(execute.mock.calls[0]?.[0]).toSorted()).toEqual([
      'eventId',
      'expectedVisitId',
      'idempotencyKey',
      'instanceId',
    ]);
    await wrapper.setProps({ visitId: 'visit-2' });
    wrapper.findComponent(Popconfirm).vm.$emit('confirm');
    await flushPromises();
    expect(execute.mock.calls[2]?.[0].idempotencyKey).not.toBe(
      execute.mock.calls[0]?.[0].idempotencyKey,
    );
    wrapper.unmount();
  });

  it('撤回动作授权后不继续显示按钮，迟到结果不刷新新目标', async () => {
    let resolve!: (value: unknown) => void;
    const execute = vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const wrapper = mount(WorkflowStateEvents, {
      props: {
        instanceId: 'first',
        visitId: 'visit-1',
        events: [{ value: 'submit', label: '提交' }],
        execute,
      },
    });
    wrapper.findComponent(Popconfirm).vm.$emit('confirm');
    await wrapper.setProps({
      instanceId: 'second',
      visitId: 'visit-2',
      events: [],
    });
    resolve({});
    await flushPromises();
    expect(wrapper.find('button').exists()).toBe(false);
    expect(wrapper.emitted('completed')).toBeUndefined();
    wrapper.unmount();
  });
});
