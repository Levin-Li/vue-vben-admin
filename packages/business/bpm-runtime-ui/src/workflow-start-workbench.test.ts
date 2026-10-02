import type { WorkflowRuntimeService } from './workflow-runtime-service';

import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import WorkflowStartWorkbench from './workflow-start-workbench.vue';

vi.mock('@levin/admin-framework', () => ({
  RequestService: class {
    basePath = '';
  },
}));

// 保留真实 Ant 控件及共享业务面板，验证分页、资格、启动命令和失效响应。
const purpose = {
  businessType: 'request',
  contractVersion: '2',
  purposeKey: 'review',
  purposeName: '资料审核',
  definitionName: '申请审核',
};
const record = {
  businessType: 'request',
  businessId: 'r1',
  businessTitle: '申请甲',
  tenantId: 't1',
  orgId: 'o1',
};
function setup(overrides = {}) {
  const api = {
    manualStarts: vi
      .fn()
      .mockResolvedValue({ items: [purpose], pageIndex: 1, hasMore: true }),
    businessRecords: vi
      .fn()
      .mockResolvedValue({ items: [record], pageIndex: 1, hasMore: true }),
    eligibility: vi.fn().mockResolvedValue([
      {
        purposeKey: 'review',
        purposeName: '资料审核',
        eligible: true,
        startMode: 'manual',
      },
    ]),
    start: vi.fn().mockResolvedValue({ instanceId: 'p1', status: 'Running' }),
  };
  const wrapper = mount(WorkflowStartWorkbench, {
    props: {
      service: api as unknown as typeof api & WorkflowRuntimeService,
      canReadCatalog: true,
      canReadRecords: true,
      canReadEligibility: true,
      canStart: true,
      tenantId: 't1',
      ...overrides,
    },
  });
  const button = (name: string) =>
    wrapper
      .findAll('button')
      .find((item) => item.text().replaceAll(/\s/g, '') === name);
  return { api, wrapper, button };
}
async function choose(wrapper: ReturnType<typeof setup>['wrapper']) {
  await flushPromises();
  await wrapper.get('[aria-label="选择流程资料审核"]').trigger('click');
  await flushPromises();
  await wrapper.get('[aria-label="选择记录申请甲"]').trigger('click');
  await flushPromises();
}

describe('独立发起流程与业务对象启动命令共用', () => {
  it('流程目录和记录逐页有界读取，不自动选择或加载全量记录', async () => {
    const { wrapper, api, button } = setup();
    await flushPromises();
    expect(api.manualStarts).toHaveBeenCalledWith({
      tenantId: 't1',
      pageIndex: 1,
      pageSize: 20,
    });
    expect(api.businessRecords).not.toHaveBeenCalled();
    await wrapper.get('[aria-label="选择流程资料审核"]').trigger('click');
    await flushPromises();
    expect(api.businessRecords).toHaveBeenCalledWith({
      tenantId: 't1',
      businessType: 'request',
      contractVersion: '2',
      pageIndex: 1,
      pageSize: 20,
    });
    expect(api.eligibility).not.toHaveBeenCalled();
    api.businessRecords.mockResolvedValueOnce({
      items: [],
      pageIndex: 2,
      hasMore: true,
    });
    await button('下一页记录')?.trigger('click');
    await flushPromises();
    expect(api.businessRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageIndex: 2 }),
    );
    expect(button('下一页记录')?.attributes('disabled')).toBeUndefined();
    expect(wrapper.text()).toContain('当前页没有有权查看的业务记录');
    wrapper.unmount();
  });

  it('资格只展示所选用途和脱敏原因，启动失败重放完整同一命令', async () => {
    const { wrapper, api, button } = setup();
    api.eligibility.mockResolvedValue([
      {
        purposeKey: 'review',
        purposeName: '资料审核',
        eligible: true,
        startMode: 'manual',
      },
      {
        purposeKey: 'other',
        purposeName: '其它用途',
        eligible: true,
        startMode: 'manual',
      },
    ]);
    api.start.mockRejectedValueOnce(new Error('响应丢失'));
    await choose(wrapper);
    expect(wrapper.text()).not.toContain('其它用途');
    expect(api.eligibility).toHaveBeenCalledWith(
      expect.objectContaining({ contractVersion: '2', businessId: 'r1' }),
    );
    await button('发起流程')?.trigger('click');
    await flushPromises();
    await button('发起流程')?.trigger('click');
    await flushPromises();
    expect(api.start).toHaveBeenCalledTimes(2);
    expect(api.start.mock.calls[1]).toEqual(api.start.mock.calls[0]);
    expect(api.start).toHaveBeenCalledWith(
      expect.objectContaining({
        businessType: 'request',
        businessId: 'r1',
        contractVersion: '2',
        tenantId: 't1',
        orgId: 'o1',
        purposeKey: 'review',
        idempotencyKey: expect.any(String),
      }),
    );
    expect(wrapper.emitted('started')).toHaveLength(1);
    wrapper.unmount();
  });

  it('并发点击只发送一次启动，自动用途没有手动发起按钮', async () => {
    const first = setup();
    let resolveStart!: (value: { instanceId: string; status: string }) => void;
    first.api.start.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStart = resolve;
        }),
    );
    await choose(first.wrapper);
    await first.button('发起流程')?.trigger('click');
    await first.button('发起流程')?.trigger('click');
    expect(first.api.start).toHaveBeenCalledTimes(1);
    resolveStart({ instanceId: 'p1', status: 'Running' });
    await flushPromises();
    first.wrapper.unmount();
    const second = setup();
    second.api.eligibility.mockResolvedValue([
      {
        purposeKey: 'review',
        purposeName: '资料审核',
        eligible: true,
        startMode: 'event',
      },
    ]);
    await choose(second.wrapper);
    expect(second.button('发起流程')).toBeUndefined();
    expect(second.wrapper.text()).toContain('由事件触发');
    expect(second.api.start).not.toHaveBeenCalled();
    second.wrapper.unmount();
  });

  it('撤销目录、记录或启动权立即清除旧对象和在途记录响应', async () => {
    const { wrapper, api } = setup();
    let finishRecords!: (value: {
      hasMore: boolean;
      items: (typeof record)[];
      pageIndex: number;
    }) => void;
    api.businessRecords.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRecords = resolve;
        }),
    );
    await flushPromises();
    await wrapper.get('[aria-label="选择流程资料审核"]').trigger('click');
    await wrapper.setProps({ canReadRecords: false });
    finishRecords({ items: [record], pageIndex: 1, hasMore: false });
    await flushPromises();
    expect(wrapper.text()).not.toContain('申请甲');
    expect(api.eligibility).not.toHaveBeenCalled();
    await wrapper.setProps({ canStart: false });
    await flushPromises();
    expect(wrapper.text()).toContain(
      '当前没有查询手动流程目录或发起流程的权限',
    );
    expect(wrapper.find('[aria-label="选择流程资料审核"]').exists()).toBe(
      false,
    );
    wrapper.unmount();
  });

  it('租户切换忽略旧目录响应，资格失败不能沿用旧可启动结果', async () => {
    const { wrapper, api, button } = setup();
    await choose(wrapper);
    api.eligibility.mockRejectedValueOnce(new Error('业务对象撤权'));
    await button('刷新')?.trigger('click');
    await flushPromises();
    expect(button('发起流程')).toBeUndefined();
    expect(wrapper.text()).toContain('流程信息加载失败');
    let finishCatalog!: (value: {
      hasMore: boolean;
      items: (typeof purpose)[];
      pageIndex: number;
    }) => void;
    api.manualStarts.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCatalog = resolve;
        }),
    );
    await wrapper.setProps({ tenantId: 't2' });
    api.manualStarts.mockResolvedValueOnce({
      items: [],
      pageIndex: 1,
      hasMore: false,
    });
    await wrapper.setProps({ tenantId: 't3' });
    finishCatalog({ items: [purpose], pageIndex: 1, hasMore: false });
    await flushPromises();
    expect(wrapper.text()).not.toContain('资料审核');
    expect(wrapper.text()).toContain('当前没有有权发起的手动流程');
    wrapper.unmount();
  });

  it('条件未满足保持不可发起并展示固定原因', async () => {
    const { wrapper, api, button } = setup();
    api.eligibility.mockResolvedValue([
      {
        purposeKey: 'review',
        purposeName: '资料审核',
        eligible: false,
        startMode: 'manual',
        reasons: ['前置业务结果未应用'],
      },
    ]);
    await choose(wrapper);
    expect(wrapper.text()).toContain('前置业务结果未应用');
    expect(button('发起流程')?.attributes('disabled')).toBeDefined();
    await button('发起流程')?.trigger('click');
    expect(api.start).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
