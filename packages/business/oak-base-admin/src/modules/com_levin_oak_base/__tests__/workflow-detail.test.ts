import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkflowRequestDetail from '../views/workflow-request/detail.vue';

const api = vi.hoisted(() => ({ retrieve: vi.fn() }));
vi.mock('../api/workflow-request-service', () => ({
  workflowRequestService: api,
}));

describe('待办中的业务申请详情', () => {
  beforeEach(() => vi.clearAllMocks());

  it('读取真实授权详情，仅展示声明的业务字段', async () => {
    api.retrieve.mockResolvedValue({
      id: 'one',
      title: '采购申请',
      amount: 12,
      category: '采购',
      documentsComplete: false,
      resultSummary: '待办理',
      tenantId: 'hidden-tenant',
    });
    const wrapper = mount(WorkflowRequestDetail, {
      props: {
        businessReference: {
          businessType: 'workflow-request',
          businessId: 'one',
        },
      },
    });
    await flushPromises();
    expect(api.retrieve).toHaveBeenCalledWith({ id: 'one' });
    expect(wrapper.text()).toContain('采购申请');
    expect(wrapper.text()).toContain('否');
    expect(wrapper.text()).not.toContain('hidden-tenant');
    expect(wrapper.findAll('input, textarea')).toHaveLength(0);
    wrapper.unmount();
  });

  it('切换对象后忽略迟到响应，避免显示上一条业务资料', async () => {
    let resolveOld!: (value: unknown) => void;
    api.retrieve.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    api.retrieve.mockResolvedValueOnce({
      id: 'two',
      title: '当前申请',
      category: '采购',
      documentsComplete: true,
    });
    const wrapper = mount(WorkflowRequestDetail, {
      props: {
        businessReference: {
          businessType: 'workflow-request',
          businessId: 'one',
        },
      },
    });
    await wrapper.setProps({
      businessReference: {
        businessType: 'workflow-request',
        businessId: 'two',
      },
    });
    await flushPromises();
    resolveOld({ id: 'one', title: '旧申请敏感内容' });
    await flushPromises();
    expect(wrapper.text()).toContain('当前申请');
    expect(wrapper.text()).not.toContain('旧申请敏感内容');
    wrapper.unmount();
  });

  it('授权失败显示错误而不是伪造空业务数据', async () => {
    api.retrieve.mockRejectedValue(new Error('当前申请不可访问'));
    const wrapper = mount(WorkflowRequestDetail, {
      props: {
        businessReference: {
          businessType: 'workflow-request',
          businessId: 'one',
        },
      },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('当前申请不可访问');
    expect(wrapper.text()).not.toContain('申请金额');
    wrapper.unmount();
  });
});
