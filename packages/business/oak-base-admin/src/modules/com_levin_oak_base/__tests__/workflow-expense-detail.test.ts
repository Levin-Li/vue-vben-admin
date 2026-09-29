import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkflowExpenseDetail from '../views/my-workflow/workflow-expense-detail.vue';

const api = vi.hoisted(() => ({ retrieve: vi.fn() }));
vi.mock('../api/workflow-expense-service', () => ({
  workflowExpenseService: api,
}));

const reference = {
  businessType: 'workflow-expense',
  businessId: 'expense-1',
  tenantId: 'tenant-a',
  orgId: 'org-a',
};

describe('工作台报销详情', () => {
  beforeEach(() => vi.resetAllMocks());

  it('读取真实授权范围，显示六个业务字段并保持核定零值和票据false', async () => {
    api.retrieve.mockResolvedValue({
      id: 'expense-1',
      subject: '差旅报销',
      claimedAmount: '125.50',
      receiptsReady: false,
      verifiedAmount: 0,
      reviewNote: '票据待核验',
      resultSummary: '已拒绝',
      claimantId: 'hidden-user',
      tenantId: 'hidden-tenant',
      privateData: 'hidden-secret',
    });
    const wrapper = mount(WorkflowExpenseDetail, {
      props: { businessReference: reference },
    });
    await flushPromises();
    expect(api.retrieve).toHaveBeenCalledWith({
      id: 'expense-1',
      tenantId: 'tenant-a',
      orgId: 'org-a',
    });
    for (const label of [
      '差旅报销',
      '125.50',
      '否',
      '核定金额',
      '0',
      '票据待核验',
      '已拒绝',
    ])
      expect(wrapper.text()).toContain(label);
    for (const hidden of [
      'hidden-user',
      'hidden-tenant',
      'hidden-secret',
      '尚未核定',
    ])
      expect(wrapper.text()).not.toContain(hidden);
    expect(wrapper.findAll('input, textarea, button')).toHaveLength(0);
    wrapper.unmount();
  });

  it('类型不匹配不发送费用读取请求', async () => {
    const wrapper = mount(WorkflowExpenseDetail, {
      props: {
        businessReference: { ...reference, businessType: 'workflow-request' },
      },
    });
    await flushPromises();
    expect(api.retrieve).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('当前业务类型不适用报销详情');
    wrapper.unmount();
  });

  it('对象或组织变化丢弃旧响应，只展示当前授权对象', async () => {
    let resolveOld: (value: unknown) => void = () => {};
    api.retrieve.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    api.retrieve.mockResolvedValueOnce({
      subject: '当前报销',
      claimedAmount: 5,
      receiptsReady: true,
    });
    const wrapper = mount(WorkflowExpenseDetail, {
      props: { businessReference: reference },
    });
    await wrapper.setProps({
      businessReference: {
        ...reference,
        businessId: 'expense-2',
        orgId: 'org-b',
      },
    });
    await flushPromises();
    resolveOld({ subject: '旧对象机密' });
    await flushPromises();
    expect(api.retrieve).toHaveBeenLastCalledWith({
      id: 'expense-2',
      tenantId: 'tenant-a',
      orgId: 'org-b',
    });
    expect(wrapper.text()).toContain('当前报销');
    expect(wrapper.text()).toContain('尚未核定');
    expect(wrapper.text()).not.toContain('旧对象机密');
    wrapper.unmount();
  });

  it('权限读取失败显示错误，不回填伪造业务详情', async () => {
    api.retrieve.mockRejectedValue(new Error('当前报销不可访问'));
    const wrapper = mount(WorkflowExpenseDetail, {
      props: { businessReference: reference },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('当前报销不可访问');
    expect(wrapper.text()).not.toContain('申报金额');
    wrapper.unmount();
  });
});
