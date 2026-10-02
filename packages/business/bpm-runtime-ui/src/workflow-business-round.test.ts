import type { WorkflowInstanceView, WorkflowRoundState } from './types';
import type { WorkflowRuntimeService } from './workflow-runtime-service';

import { flushPromises, shallowMount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import WorkflowBusinessPanel from './workflow-business-panel.vue';

vi.mock('@levin/admin-framework', () => ({
  RequestService: class {
    basePath = '';
  },
}));

// 只替换展示外壳；确认、权限、异步准备及提交均执行真实组件逻辑。
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
  'a-alert': {
    props: ['message'],
    template: '<div>{{ message }}<slot name="action"/></div>',
  },
  'a-empty': { template: '<div />' },
  'a-divider': { template: '<div><slot/></div>' },
  'a-space': { template: '<div><slot/></div>' },
  'a-tag': { template: '<span><slot/></span>' },
};

const failedRun: WorkflowInstanceView = {
  instanceId: 'instance-1',
  runId: 'run-1',
  purposeKey: 'review',
  roundId: 'round-1',
  status: 'Completed',
  executionStatus: 'Completed',
  outcome: 'Rejected',
  effectStatus: 'Applied',
  businessContractVersion: '1',
  attemptNo: 2,
};
const state: WorkflowRoundState = {
  active: false,
  contractVersion: '1',
  revision: 'current-revision',
  currentRoundId: 'round-1',
  resubmittableRunIds: ['run-1'],
  reasons: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function setup(
  options: {
    canNewRound?: boolean;
    canResubmit?: boolean;
    contractVersion?: string;
  } = {},
) {
  const api = {
    eligibility: vi.fn().mockResolvedValue([]),
    history: vi.fn().mockResolvedValue([failedRun]),
    roundState: vi.fn().mockResolvedValue(state),
    newRound: vi.fn().mockResolvedValue('round-2'),
    resubmit: vi
      .fn()
      .mockResolvedValue({ instanceId: 'instance-2', status: 'Running' }),
  };
  const wrapper = shallowMount(WorkflowBusinessPanel, {
    props: {
      businessReference: {
        businessType: 'request',
        businessId: '1',
        tenantId: 't1',
        orgId: 'o1',
      },
      contractVersion: '1',
      canNewRound: true,
      canResubmit: true,
      ...options,
      service: api as unknown as WorkflowRuntimeService,
    },
    global: { stubs },
  });
  const button = (label: string) =>
    wrapper.findAll('button').find((item) => item.text() === label);
  const click = async (label: string) => {
    expect(button(label), label).toBeDefined();
    await button(label)?.trigger('click');
    await flushPromises();
  };
  return { api, wrapper, button, click };
}

describe('业务轮次与显式重提交互', () => {
  it('拆分面板时全局资格只读取用途，契约历史只读取历史和轮次', async () => {
    const global = setup({ contractVersion: undefined });
    await global.wrapper.setProps({ showHistory: false });
    await flushPromises();
    global.api.eligibility.mockClear();
    global.api.history.mockClear();
    await global.wrapper.vm.refresh();
    await flushPromises();
    expect(global.api.eligibility).toHaveBeenCalledTimes(1);
    expect(global.api.history).not.toHaveBeenCalled();
    expect(global.button('重新提交')).toBeUndefined();
    global.wrapper.unmount();

    const version = setup({ contractVersion: '1' });
    await version.wrapper.setProps({ showEligibility: false });
    await flushPromises();
    version.api.eligibility.mockClear();
    version.api.history.mockClear();
    await version.wrapper.vm.refresh();
    await flushPromises();
    expect(version.api.eligibility).not.toHaveBeenCalled();
    expect(version.api.history).toHaveBeenCalledTimes(1);
    expect(version.button('发起流程')).toBeUndefined();
    expect(version.button('重新提交')).toBeDefined();
    version.wrapper.unmount();
  });

  it('缺少明确契约或独立写权限时不猜历史契约、不开放命令', async () => {
    const noContract = setup({ contractVersion: undefined });
    await flushPromises();
    expect(noContract.api.roundState).not.toHaveBeenCalled();
    expect(noContract.button('开启新办理轮次')).toBeUndefined();
    expect(noContract.button('重新提交')).toBeUndefined();
    noContract.wrapper.unmount();

    const noPermission = setup({ canNewRound: false, canResubmit: false });
    await flushPromises();
    expect(noPermission.api.roundState).not.toHaveBeenCalled();
    expect(noPermission.button('开启新办理轮次')).toBeUndefined();
    expect(noPermission.button('重新提交')).toBeUndefined();
    noPermission.wrapper.unmount();
  });

  it('异步授予轮次权限后重新读取服务端资格，撤销后清除旧按钮', async () => {
    const { api, wrapper, button } = setup({
      canNewRound: false,
      canResubmit: false,
    });
    await flushPromises();
    expect(api.roundState).not.toHaveBeenCalled();
    await wrapper.setProps({ canResubmit: true });
    await flushPromises();
    expect(api.roundState).toHaveBeenCalledWith(
      expect.objectContaining({ contractVersion: '1' }),
    );
    expect(button('重新提交')).toBeDefined();
    await wrapper.setProps({ canResubmit: false });
    expect(button('重新提交')).toBeUndefined();
    wrapper.unmount();
  });

  it('只展示服务端许可的同轮已完成已应用失败来源，任意失败历史不能重提', async () => {
    const { api, wrapper } = setup();
    api.history.mockResolvedValue([
      failedRun,
      { ...failedRun, runId: 'old-run', attemptNo: 1 },
      { ...failedRun, runId: 'old-round', roundId: 'round-old' },
      { ...failedRun, runId: 'other-version', businessContractVersion: '2' },
      { ...failedRun, runId: 'approved', outcome: 'Approved' },
      {
        ...failedRun,
        runId: 'pending',
        executionStatus: 'PendingEffects',
        effectStatus: 'Pending',
      },
    ]);
    await flushPromises();
    await wrapper.vm.refresh();
    await flushPromises();
    expect(
      wrapper.findAll('button').filter((item) => item.text() === '重新提交'),
    ).toHaveLength(1);
    expect(wrapper.text()).not.toContain('other-version');
    wrapper.unmount();
  });

  it('契约2只读取自身轮次并按冻结版本重提，契约1来源不可借用资格', async () => {
    const { api, wrapper, click } = setup({ contractVersion: '2' });
    api.history.mockResolvedValue([
      failedRun,
      {
        ...failedRun,
        instanceId: 'instance-2',
        runId: 'run-2',
        businessContractVersion: '2',
      },
    ]);
    api.roundState.mockResolvedValue({
      ...state,
      contractVersion: '2',
      resubmittableRunIds: ['run-1', 'run-2'],
    });
    await wrapper.vm.refresh();
    await flushPromises();
    expect(wrapper.text()).not.toContain('instance-1');
    expect(wrapper.text()).toContain('instance-2');
    expect(api.roundState).toHaveBeenCalledWith(
      expect.objectContaining({ contractVersion: '2' }),
    );
    await click('重新提交');
    await click('确认');
    expect(api.resubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        contractVersion: '2',
        sourceRunId: 'run-2',
      }),
    );
    wrapper.unmount();
  });

  it.each(['Rejected', 'Withdrawn', 'Terminated'])(
    '%s重提引用runId与宿主契约、当前修订；其他用途活动不错误阻断',
    async (outcome) => {
      const { api, wrapper, click } = setup();
      api.history.mockResolvedValue([{ ...failedRun, outcome }]);
      api.roundState.mockResolvedValue({ ...state, active: true });
      await flushPromises();
      await wrapper.vm.refresh();
      await flushPromises();
      await click('重新提交');
      expect(api.resubmit).not.toHaveBeenCalled();
      await click('确认');
      expect(api.resubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceRunId: 'run-1',
          purposeKey: 'review',
          contractVersion: '1',
          expectedRevision: 'current-revision',
          expectedRoundId: 'round-1',
          tenantId: 't1',
          orgId: 'o1',
          idempotencyKey: expect.any(String),
        }),
      );
      expect(wrapper.emitted('started')).toHaveLength(1);
      wrapper.unmount();
    },
  );

  it('准备时来源已不再是最新许可尝试则拒绝确认并显示原因', async () => {
    const { api, wrapper, click, button } = setup();
    await flushPromises();
    api.roundState.mockResolvedValue({
      ...state,
      resubmittableRunIds: [],
      reasons: ['该用途已有新的办理尝试'],
    });
    await click('重新提交');
    expect(wrapper.text()).toContain('该用途已有新的办理尝试');
    expect(button('确认')?.attributes('disabled')).toBeDefined();
    await click('确认');
    expect(api.resubmit).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it.each(['开启新办理轮次', '重新提交'])(
    '准备%s时阻止连点，取消后的迟到结果不能恢复确认',
    async (label) => {
      const { api, wrapper, button, click } = setup();
      await flushPromises();
      const pending = deferred<WorkflowRoundState>();
      api.roundState.mockReturnValueOnce(pending.promise);
      await button(label)?.trigger('click');
      await button(label)?.trigger('click');
      expect(api.roundState).toHaveBeenCalledTimes(2);
      expect(button('确认')?.attributes('disabled')).toBeDefined();
      await click('取消');
      pending.resolve(state);
      await flushPromises();
      expect(button('确认')).toBeUndefined();
      expect(api.newRound).not.toHaveBeenCalled();
      expect(api.resubmit).not.toHaveBeenCalled();
      wrapper.unmount();
    },
  );

  it('准备后已出现活动实例时展示服务端阻断原因且不能换轮', async () => {
    const { api, wrapper, click, button } = setup();
    await flushPromises();
    api.roundState.mockResolvedValue({
      ...state,
      active: true,
      reasons: ['当前仍有待交付结果'],
    });
    await click('开启新办理轮次');
    expect(wrapper.text()).toContain('当前仍有待交付结果');
    expect(button('确认')?.attributes('disabled')).toBeDefined();
    await click('确认');
    expect(api.newRound).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it.each(['newRound', 'resubmit'] as const)(
    '%s网络失败后保留完整原命令，取消刷新后重试也不换键',
    async (method) => {
      const { api, wrapper, click } = setup();
      await flushPromises();
      api[method].mockRejectedValueOnce(new Error('响应丢失'));
      await click(method === 'newRound' ? '开启新办理轮次' : '重新提交');
      await click('确认');
      const original = api[method].mock.calls[0]?.[0];
      expect(wrapper.text()).toContain('重试保留原轮次');
      await click('取消');
      api.roundState.mockResolvedValue({
        ...state,
        active: true,
        revision: 'changed',
        resubmittableRunIds: [],
      });
      await click('刷新');
      await click(method === 'newRound' ? '开启新办理轮次' : '重试原提交');
      await click('确认');
      expect(api[method].mock.calls[1]?.[0]).toEqual(original);
      expect(
        wrapper.emitted(method === 'newRound' ? 'roundChanged' : 'started'),
      ).toHaveLength(1);
      wrapper.unmount();
    },
  );

  it('准备请求跨对象迟到不显示旧确认或错误，当前对象可正常换轮', async () => {
    const { api, wrapper, click, button } = setup();
    await flushPromises();
    const pending = deferred<WorkflowRoundState>();
    api.roundState.mockReturnValueOnce(pending.promise);
    await button('开启新办理轮次')?.trigger('click');
    await wrapper.setProps({
      businessReference: { businessType: 'request', businessId: '2' },
    });
    await flushPromises();
    pending.reject(new Error('旧对象错误'));
    await flushPromises();
    expect(wrapper.emitted('error')).toBeUndefined();
    expect(button('确认')).toBeUndefined();
    await click('开启新办理轮次');
    await click('确认');
    expect(api.newRound).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: '2' }),
    );
    wrapper.unmount();
  });

  it('旧提交迟到不污染新对象busy状态、事件和刷新', async () => {
    const { api, wrapper, click, button } = setup();
    await flushPromises();
    const pending = deferred<string>();
    api.newRound.mockReturnValueOnce(pending.promise);
    await click('开启新办理轮次');
    await button('确认')?.trigger('click');
    await wrapper.setProps({
      businessReference: { businessType: 'request', businessId: '2' },
    });
    await flushPromises();
    expect(button('开启新办理轮次')?.attributes('disabled')).toBeUndefined();
    const historyCount = api.history.mock.calls.length;
    pending.resolve('old-round');
    await flushPromises();
    expect(wrapper.emitted('roundChanged')).toBeUndefined();
    expect(api.history).toHaveBeenCalledTimes(historyCount);
    await click('开启新办理轮次');
    await click('确认');
    expect(wrapper.emitted('roundChanged')).toEqual([['round-2']]);
    wrapper.unmount();
  });

  it('准备后撤销权限不能继续确认，卸载后也不再发出迟到事件', async () => {
    const first = setup();
    await flushPromises();
    await first.click('重新提交');
    await first.wrapper.setProps({ canResubmit: false });
    expect(first.button('确认')).toBeUndefined();
    expect(first.api.resubmit).not.toHaveBeenCalled();
    first.wrapper.unmount();

    const second = setup();
    await flushPromises();
    const pending = deferred<WorkflowInstanceView>();
    second.api.resubmit.mockReturnValueOnce(pending.promise);
    await second.click('重新提交');
    await second.button('确认')?.trigger('click');
    second.wrapper.unmount();
    pending.resolve({ instanceId: 'late', status: 'Running' });
    await flushPromises();
    expect(second.wrapper.emitted('started')).toBeUndefined();
    expect(second.api.history).toHaveBeenCalledTimes(1);
  });
});
