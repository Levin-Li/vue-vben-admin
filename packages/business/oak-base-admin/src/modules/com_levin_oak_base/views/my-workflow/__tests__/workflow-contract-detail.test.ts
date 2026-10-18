import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkflowContractDetail from '../workflow-contract-detail.vue';

const { documentReference, retrieve } = vi.hoisted(() => ({
  documentReference: vi.fn(),
  retrieve: vi.fn(),
}));
vi.mock('../../../api/electronic-contract-service', () => ({
  electronicContractService: { documentReference, retrieve },
}));
vi.mock('../../electronic-contract/contract-preview-panel.vue', () => ({
  default: {
    name: 'ContractPreviewPanel',
    props: ['contract'],
    template: '<div>{{ contract.name }}</div>',
  },
}));
vi.mock('ant-design-vue', () => ({
  Alert: { props: ['message'], template: '<p role="alert">{{ message }}</p>' },
  Spin: { template: '<div><slot /></div>' },
}));
const reference = (id: string) => ({
  businessType: 'electronic-contract',
  businessId: id,
  tenantId: 'tenant-a',
  orgId: 'org-a',
});
const metadata = (id: string) => ({
  id,
  name: `在线合同${id}`,
  optimisticLock: 1,
  hasOriginal: true,
  hasSigned: false,
  status: 'Draft',
});

// 审批工作台读取最小引用，通用详情及其在线签名地址不会进入组件。
describe('审批合同最小文档引用', () => {
  beforeEach(() => vi.clearAllMocks());
  it('只调用最小引用接口，正常元数据即可展示在线材料', async () => {
    documentReference.mockResolvedValue(metadata('one'));
    const wrapper = mount(WorkflowContractDetail, {
      props: { businessReference: reference('one') },
    });
    await flushPromises();
    expect(documentReference).toHaveBeenCalledWith({
      id: 'one',
      tenantId: 'tenant-a',
      orgId: 'org-a',
    });
    expect(retrieve).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('在线合同one');
    expect(
      wrapper.findComponent({ name: 'ContractPreviewPanel' }).props('contract'),
    ).not.toHaveProperty('fileUrl');
    wrapper.unmount();
  });
  it('换对象立即清旧内容，迟到引用不能盖过无权错误', async () => {
    let finish!: (value: unknown) => void;
    documentReference
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            finish = done;
          }),
      )
      .mockRejectedValueOnce(new Error('线上文档无读取权限'));
    const wrapper = mount(WorkflowContractDetail, {
      props: { businessReference: reference('old') },
    });
    await wrapper.setProps({ businessReference: reference('denied') });
    await flushPromises();
    finish(metadata('old'));
    await flushPromises();
    expect(
      wrapper.findComponent({ name: 'ContractPreviewPanel' }).exists(),
    ).toBe(false);
    expect(wrapper.text()).toContain('线上文档无读取权限');
    wrapper.unmount();
  });
  it('链接失效时明确提示，并在关闭后忽略引用响应', async () => {
    documentReference.mockRejectedValueOnce(
      new Error('链接已失效，请更新合同文档'),
    );
    const wrapper = mount(WorkflowContractDetail, {
      props: { businessReference: reference('expired') },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('链接已失效');
    let finish!: (value: unknown) => void;
    documentReference.mockImplementationOnce(
      () =>
        new Promise((done) => {
          finish = done;
        }),
    );
    await wrapper.setProps({ businessReference: reference('after') });
    wrapper.unmount();
    finish(metadata('after'));
    await flushPromises();
    expect(
      wrapper.findComponent({ name: 'ContractPreviewPanel' }).exists(),
    ).toBe(false);
  });
});
