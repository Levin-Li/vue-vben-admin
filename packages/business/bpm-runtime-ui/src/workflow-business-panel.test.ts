import type { WorkflowEligibility } from './types';
import type { WorkflowRuntimeService } from './workflow-runtime-service';

import { flushPromises, mount, shallowMount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import { unwrapServiceResp } from '../../admin-framework/src/framework-commons/app/api/service-resp';
import WorkflowBusinessPanel from './workflow-business-panel.vue';

vi.mock('@levin/admin-framework', () => ({
  RequestService: class {
    basePath = '';
  },
}));

// 仅替换展示组件，真实点击、请求与错误恢复逻辑由待测组件执行。
const stubs = {
  'a-card': { template: '<section><slot/><slot name="extra"/></section>' },
  'a-spin': { template: '<section><slot/></section>' },
  'a-list': {
    props: ['dataSource'],
    template:
      '<div><slot v-for="item in dataSource" name="renderItem" :item="item"/></div>',
  },
  'a-list-item': { template: '<article><slot/></article>' },
  'a-list-item-meta': {
    props: ['title', 'description'],
    template:
      '<div>{{ title }} {{ description }}<slot name="description"/></div>',
  },
  'a-button': {
    props: ['disabled'],
    template:
      '<button :disabled="disabled" @click="$emit(\'click\')"><slot/></button>',
  },
  'a-alert': { props: ['message'], template: '<div>{{ message }}</div>' },
  'a-empty': {
    props: ['description'],
    template: '<div>{{ description }}</div>',
  },
  'a-divider': { template: '<div><slot/></div>' },
  'a-space': { template: '<div><slot/></div>' },
  'a-tag': { template: '<span><slot/></span>' },
};
function setup(
  items: WorkflowEligibility[] = [{ purposeKey: 'review', eligible: true }],
) {
  const api = {
    eligibility: vi.fn().mockResolvedValue(items),
    history: vi.fn().mockResolvedValue([]),
    retry: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue({ instanceId: 'p1', status: 'Running' }),
  };
  const wrapper = shallowMount(WorkflowBusinessPanel, {
    props: {
      businessReference: { businessType: 'request', businessId: '1' },
      service: api as unknown as WorkflowRuntimeService,
    },
    global: { stubs },
  });
  return { api, wrapper };
}

describe('业务流程资格与发起', () => {
  it('业务历史刷新失败后不继续显示上一次授权取得的记录', async () => {
    const { api, wrapper } = setup();
    api.history.mockResolvedValueOnce([
      { instanceId: 'previous-run', status: 'PendingEffects' },
    ]);
    await wrapper.vm.refresh();
    await flushPromises();
    expect(wrapper.text()).toContain('previous-run');

    api.history.mockRejectedValueOnce(new Error('access revoked'));
    await wrapper.vm.refresh();
    await flushPromises();
    expect(wrapper.text()).toContain('流程信息加载失败');
    expect(wrapper.text()).not.toContain('previous-run');
  });

  it('事件启动用途仅展示状态，不作为普通手动发起按钮', async () => {
    const { api, wrapper } = setup([
      { purposeKey: 'auto-review', eligible: true, startMode: 'event' },
    ]);
    await flushPromises();
    const button = wrapper
      .findAll('button')
      .find((item) => item.text() === '由事件触发');
    expect(button).toBeUndefined();
    expect(wrapper.text()).toContain('由事件触发');
    expect(api.start).not.toHaveBeenCalled();
  });

  it('真实ApiResp解包后无需宿主全局注册Ant组件也能显示八项资格和发起按钮', async () => {
    // 复现浏览器code0/data数组；沿用真实请求层解包，不给面板伪造另一种协议。
    const rows = Array.from({ length: 8 }, (_, index) => ({
      purposeKey: index === 0 ? 'ui-e2e-0927-1505' : `purpose-${index}`,
      eligible: index === 0,
      reasons: index === 0 ? [] : ['前置条件未满足'],
    }));
    const api = {
      eligibility: vi
        .fn()
        .mockResolvedValue(unwrapServiceResp({ code: 0, data: rows })),
      history: vi
        .fn()
        .mockResolvedValue(unwrapServiceResp({ code: 0, data: [] })),
      start: vi.fn().mockResolvedValue(
        unwrapServiceResp({
          code: 0,
          data: { instanceId: 'p1', status: 'Running' },
        }),
      ),
    };
    // 不提供外观stub或全局Ant插件，公共包必须自行注册它使用的组件。
    const wrapper = mount(WorkflowBusinessPanel, {
      props: {
        businessReference: {
          businessType: 'workflow-request',
          businessId: '7217331591876394840',
          tenantId: '7217531496834260913',
          orgId: '7217531496834260901',
        },
        service: api as unknown as WorkflowRuntimeService,
      },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('ui-e2e-0927-1505');
    const buttons = wrapper
      .findAll('button')
      .filter((button) => button.text() === '发起流程');
    expect(buttons).toHaveLength(8);
    expect(
      buttons.filter((button) => button.attributes('disabled') === undefined),
    ).toHaveLength(1);
    await buttons[0]?.trigger('click');
    await flushPromises();
    expect(api.start).toHaveBeenCalledWith(
      expect.objectContaining({
        businessType: 'workflow-request',
        businessId: '7217331591876394840',
        tenantId: '7217531496834260913',
        orgId: '7217531496834260901',
        purposeKey: 'ui-e2e-0927-1505',
      }),
    );
    wrapper.unmount();
  });

  it.each(['tenantId', 'orgId'] as const)(
    '切换%s后清除旧资格并使用新作用域，丢弃迟到查询',
    async (scopeField) => {
      const { api, wrapper } = setup([
        { purposeKey: 'old-purpose', eligible: true },
      ]);
      await flushPromises();
      let resolveOld: (items: WorkflowEligibility[]) => void = () => {};
      api.eligibility.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      );
      await wrapper.setProps({
        businessReference: {
          businessType: 'request',
          businessId: '1',
          [scopeField]: 'old-scope',
        },
      });
      expect(wrapper.text()).not.toContain('old-purpose');
      api.eligibility.mockResolvedValueOnce([
        { purposeKey: 'new-purpose', eligible: true },
      ]);
      await wrapper.setProps({
        businessReference: {
          businessType: 'request',
          businessId: '1',
          [scopeField]: 'new-scope',
        },
      });
      await flushPromises();
      resolveOld([{ purposeKey: 'stale-purpose', eligible: true }]);
      await flushPromises();
      expect(api.history).toHaveBeenLastCalledWith({
        businessType: 'request',
        businessId: '1',
        [scopeField]: 'new-scope',
      });
      expect(wrapper.text()).toContain('new-purpose');
      expect(wrapper.text()).not.toContain('stale-purpose');
    },
  );

  it('作用域切换后旧启动成功不触发事件或刷新，且不同scope使用不同幂等键', async () => {
    const { api, wrapper } = setup();
    await wrapper.setProps({
      businessReference: {
        businessType: 'request',
        businessId: '1',
        tenantId: 't1',
        orgId: 'o1',
      },
    });
    await flushPromises();
    let resolveStart: (value: unknown) => void = () => {};
    api.start.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStart = resolve;
        }),
    );
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '发起流程')
      ?.trigger('click');
    await wrapper.setProps({
      businessReference: {
        businessType: 'request',
        businessId: '1',
        tenantId: 't1',
        orgId: 'o2',
      },
    });
    await flushPromises();
    expect(wrapper.emitted('started')).toBeUndefined();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '发起流程')
      ?.trigger('click');
    await flushPromises();
    expect(api.start.mock.calls[0]?.[0]).toMatchObject({
      tenantId: 't1',
      orgId: 'o1',
    });
    expect(api.start.mock.calls[1]?.[0]).toMatchObject({
      tenantId: 't1',
      orgId: 'o2',
    });
    expect(api.start.mock.calls[0]?.[0].idempotencyKey).not.toBe(
      api.start.mock.calls[1]?.[0].idempotencyKey,
    );
    const queryCount = api.history.mock.calls.length;
    resolveStart({ instanceId: 'old', status: 'Running' });
    await flushPromises();
    expect(api.history).toHaveBeenCalledTimes(queryCount);
    expect(wrapper.emitted('started')).toHaveLength(1);
  });

  it('作用域切换后旧重试成功不触发事件或刷新新对象', async () => {
    const { api, wrapper } = setup();
    api.history.mockResolvedValue([
      { instanceId: 'p1', status: 'PendingEffects', pendingDispatchId: 'd1' },
    ]);
    await wrapper.setProps({
      canRetry: true,
      businessReference: {
        businessType: 'request',
        businessId: '1',
        tenantId: 't1',
        orgId: 'o1',
      },
    });
    await flushPromises();
    let resolveRetry: () => void = () => {};
    api.retry.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveRetry = resolve;
        }),
    );
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '重试业务处理')
      ?.trigger('click');
    await wrapper.setProps({
      businessReference: {
        businessType: 'request',
        businessId: '1',
        tenantId: 't2',
        orgId: 'o2',
      },
    });
    await flushPromises();
    const queryCount = api.history.mock.calls.length;
    resolveRetry();
    await flushPromises();
    expect(api.retry).toHaveBeenCalledWith({
      businessType: 'request',
      businessId: '1',
      tenantId: 't1',
      orgId: 'o1',
      dispatchId: 'd1',
    });
    expect(wrapper.emitted('retried')).toBeUndefined();
    expect(api.history).toHaveBeenCalledTimes(queryCount);
  });

  it('重试必须同时取得宿主权限和服务端交付标识，并展示脱敏失败原因', async () => {
    const { api, wrapper } = setup();
    api.history.mockResolvedValue([
      {
        instanceId: 'p1',
        status: 'PendingEffects',
        pendingDispatchId: 'd1',
        lastError: '业务版本冲突',
        effectStatus: 'Failed',
      },
    ]);
    await wrapper.vm.refresh();
    await flushPromises();
    expect(wrapper.text()).toContain('业务版本冲突');
    expect(wrapper.text()).not.toContain('重试业务处理');
    await wrapper.setProps({ canRetry: true });
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '重试业务处理')
      ?.trigger('click');
    await flushPromises();
    expect(api.retry).toHaveBeenCalledWith({
      businessType: 'request',
      businessId: '1',
      dispatchId: 'd1',
    });
    expect(wrapper.emitted('retried')).toEqual([['p1']]);

    // 即使宿主有全局重试权限，服务端未提供该对象交付标识时也不得开放。
    api.history.mockResolvedValue([
      { instanceId: 'p1', status: 'PendingEffects', effectStatus: 'Failed' },
    ]);
    await wrapper.vm.refresh();
    await flushPromises();
    expect(wrapper.text()).not.toContain('重试业务处理');
  });

  it('重试进行中不重复发命令，失败保留原交付并提供错误反馈', async () => {
    const { api, wrapper } = setup();
    api.history.mockResolvedValue([
      { instanceId: 'p1', status: 'PendingEffects', pendingDispatchId: 'd1' },
    ]);
    await wrapper.setProps({ canRetry: true });
    await wrapper.vm.refresh();
    await flushPromises();
    let rejectRequest: (reason: Error) => void = () => {};
    api.retry.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRequest = reject;
        }),
    );
    const button = wrapper
      .findAll('button')
      .find((item) => item.text() === '重试业务处理');
    await button?.trigger('click');
    await button?.trigger('click');
    expect(api.retry).toHaveBeenCalledTimes(1);
    rejectRequest(new Error('conflict'));
    await flushPromises();
    expect(wrapper.emitted('retried')).toBeUndefined();
    expect(wrapper.text()).toContain('业务处理重试未成功');
    expect(wrapper.text()).toContain('重试业务处理');
  });

  it('读取资格不会自动发起，未满足条件不允许手动启动', async () => {
    const { api, wrapper } = setup([
      { purposeKey: 'sign', eligible: false, reasons: ['前置审核未通过'] },
    ]);
    await flushPromises();
    expect(wrapper.text()).toContain('前置审核未通过');
    expect(api.start).not.toHaveBeenCalled();
    const button = wrapper
      .findAll('button')
      .find((item) => item.text() === '发起流程');
    expect(button?.attributes('disabled')).toBeDefined();
    await button?.trigger('click');
    expect(api.start).not.toHaveBeenCalled();
  });

  it('网络失败保留同一请求标识，重试不会另起新命令', async () => {
    const { api, wrapper } = setup();
    api.start.mockRejectedValueOnce(new Error('network unavailable'));
    await flushPromises();
    const button = wrapper
      .findAll('button')
      .find((item) => item.text() === '发起流程');
    await button?.trigger('click');
    await flushPromises();
    expect(wrapper.emitted('error')).toHaveLength(1);
    expect(wrapper.emitted('started')).toBeUndefined();
    await button?.trigger('click');
    await flushPromises();
    expect(api.start).toHaveBeenCalledTimes(2);
    expect(api.start.mock.calls[0]?.[0]).toEqual(api.start.mock.calls[1]?.[0]);
    expect(api.start.mock.calls[0]?.[0]).toMatchObject({
      businessType: 'request',
      businessId: '1',
      purposeKey: 'review',
    });
    expect(wrapper.emitted('started')).toHaveLength(1);
  });

  it('业务引用改变后丢弃上一对象的迟到资格响应', async () => {
    const { api, wrapper } = setup();
    await flushPromises();
    let resolveOld: (items: WorkflowEligibility[]) => void = () => {};
    api.eligibility.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    await wrapper.setProps({
      businessReference: { businessType: 'request', businessId: 'old' },
    });
    api.eligibility.mockResolvedValueOnce([
      { purposeKey: 'current', eligible: false, reasons: ['当前对象'] },
    ]);
    await wrapper.setProps({
      businessReference: { businessType: 'request', businessId: 'new' },
    });
    await flushPromises();
    resolveOld([{ purposeKey: 'stale', eligible: true }]);
    await flushPromises();
    expect(wrapper.text()).toContain('当前对象');
    expect(wrapper.text()).not.toContain('stale');
  });

  it('业务处理失败保留其状态，不伪装成审批成功', async () => {
    const { api, wrapper } = setup();
    api.history.mockResolvedValue([
      {
        instanceId: 'p1',
        status: 'Completed',
        executionStatus: 'PendingEffects',
        outcome: 'Approved',
        effectStatus: 'Failed',
      },
    ]);
    await wrapper.vm.refresh();
    await flushPromises();
    expect(wrapper.text()).toContain('等待业务处理');
    expect(wrapper.text()).toContain('结果：通过');
    expect(wrapper.text()).toContain('业务处理：处理失败');
  });
});

// API 启动权须与资格分别校验，服务端 eligible 不会恢复被宿主撤销的启动按钮。
describe('业务对象发起权限', () => {
  it('撤销启动权后继续只读展示资格且没有可调用的启动按钮', async () => {
    const { api, wrapper } = setup();
    await flushPromises();
    await wrapper.setProps({ canStart: false });
    await flushPromises();
    expect(
      wrapper.findAll('button').some((button) => button.text() === '发起流程'),
    ).toBe(false);
    expect(api.start).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
