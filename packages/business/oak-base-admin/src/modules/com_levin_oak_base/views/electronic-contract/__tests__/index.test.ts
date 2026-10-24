import { shallowMount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import { electronicContractPageCrudConfig } from '../config';
import ContractPage from '../index.vue';

vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => true }),
}));
vi.mock('ant-design-vue', () => ({
  Button: { name: 'Button', template: '<button><slot /></button>' },
  Modal: { name: 'Modal', template: '<div><slot /></div>', info: vi.fn() },
  message: { error: vi.fn() },
}));
vi.mock('../../crud-page.vue', () => ({
  default: {
    name: 'CrudPage',
    props: ['config'],
    template: '<div data-testid="crud-page" />',
  },
}));
vi.mock('../contract-counterparty-picker.vue', () => ({ default: {} }));
vi.mock('../contract-template-values.vue', () => ({ default: {} }));

describe('电子合同管理页', () => {
  it('直接使用一张标准 CRUD 页面，新增字段作为表单插槽', () => {
    const wrapper = shallowMount(ContractPage);
    const crud = wrapper.findComponent({ name: 'CrudPage' });

    expect(crud.exists()).toBe(true);
    expect(crud.props('config')).toBe(electronicContractPageCrudConfig);
    expect(Object.keys(crud.vm.$slots)).toEqual(
      expect.arrayContaining([
        'form-field-counterpartyId',
        'form-field-templateValues',
      ]),
    );
    expect(wrapper.html()).not.toContain('两方签约模拟流程');
    expect(wrapper.html()).not.toContain('合同文档预览与模拟签章');
  });
});
