import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import ContractCounterpartyPicker from '../contract-counterparty-picker.vue';
import ContractTemplateValues from '../contract-template-values.vue';

const mocks = vi.hoisted(() => ({
  customerList: vi.fn(),
  supplierList: vi.fn(),
  channelList: vi.fn(),
  retrieveTemplate: vi.fn(),
}));

vi.mock('ant-design-vue', () => ({
  Alert: {
    name: 'Alert',
    props: ['message'],
    template: '<div>{{ message }}</div>',
  },
  Input: {
    name: 'Input',
    props: ['value'],
    template: '<input :value="value" />',
  },
  Select: { name: 'Select', props: ['options', 'value'], template: '<div />' },
}));
vi.mock('../../../api/customer-service', () => ({
  customerService: { list: mocks.customerList },
}));
vi.mock('../../../api/supplier-partner-service', () => ({
  supplierPartnerService: { list: mocks.supplierList },
}));
vi.mock('../../../api/channel-partner-service', () => ({
  channelPartnerService: { list: mocks.channelList },
}));
vi.mock('../../../api/electronic-contract-template-service', () => ({
  electronicContractTemplateService: { retrieve: mocks.retrieveTemplate },
}));

describe('电子合同新增表单专用字段', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it('选择模板后读取变量，切换模板时清空旧变量', async () => {
    mocks.retrieveTemplate
      .mockResolvedValueOnce({
        data: {
          templateFieldSchema: [
            { key: 'amount', title: '金额', required: true },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: { templateFieldSchema: [{ key: 'subject', title: '主题' }] },
      });
    const wrapper = mount(ContractTemplateValues, {
      props: { templateId: 'template-1', modelValue: { old: '旧值' } },
    });

    await flushPromises();
    expect(wrapper.text()).toContain('金额');
    expect(mocks.retrieveTemplate).toHaveBeenCalledWith({
      id: 'template-1',
      tenantId: undefined,
    });

    await wrapper.setProps({ templateId: 'template-2' });
    await flushPromises();
    expect(wrapper.text()).toContain('主题');
    expect(wrapper.text()).not.toContain('金额');
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({});
  });

  it('切换签约对方类型时清除旧 ID 并加载新类型候选', async () => {
    mocks.customerList.mockResolvedValue({
      data: { items: [{ id: 'customer-1', name: '客户甲' }] },
    });
    mocks.supplierList.mockResolvedValue({
      data: { items: [{ id: 'supplier-1', displayName: '供应商乙' }] },
    });
    const wrapper = mount(ContractCounterpartyPicker, {
      props: { kind: 'Customer', modelValue: 'customer-1' },
    });

    await flushPromises();
    expect(wrapper.findComponent({ name: 'Select' }).props('options')).toEqual([
      { label: '客户甲', value: 'customer-1' },
    ]);

    await wrapper.setProps({ kind: 'SupplierPartner' });
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('');
    expect(wrapper.findComponent({ name: 'Select' }).props('options')).toEqual([
      { label: '供应商乙', value: 'supplier-1' },
    ]);
  });
});
