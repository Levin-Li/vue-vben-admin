import { describe, expect, it } from 'vitest';

import {
  buildCrudComplexGroupInitialState,
  buildCrudComplexGroupPayload,
} from '../crud-complex-groups';

const groups = [
  {
    fieldMappings: { invoiceName: 'name', invoiceTaxNo: 'taxNo' },
    key: 'invoice',
    submitKey: 'invoiceInfo',
    title: '开票信息',
  },
  {
    fieldMappings: { contactMobile: 'mobilePhone', contactName: 'name' },
    key: 'contact',
    submitKey: 'contactInfo',
    title: '联系人信息',
  },
];

describe('复杂属性分组', () => {
  it('新建时默认收缩且不提交', () => {
    expect(buildCrudComplexGroupInitialState(groups)).toEqual({
      collapsed: { contact: true, invoice: true },
      enabled: { contact: false, invoice: false },
      flatValues: {
        contactMobile: undefined,
        contactName: undefined,
        invoiceName: undefined,
        invoiceTaxNo: undefined,
      },
    });
  });

  it('回显非空分组并仅提交已勾选分组', () => {
    const initial = buildCrudComplexGroupInitialState(groups, {
      contactInfo: null,
      invoiceInfo: { name: '示例公司', taxNo: '91350211M000100Y43' },
    });

    expect(initial.enabled).toEqual({ contact: false, invoice: true });
    expect(initial.collapsed).toEqual({ contact: true, invoice: false });
    expect(initial.flatValues).toMatchObject({
      invoiceName: '示例公司',
      invoiceTaxNo: '91350211M000100Y43',
    });
    expect(buildCrudComplexGroupPayload(groups, initial.enabled, {
      ...initial.flatValues,
      contactMobile: '13800000000',
      contactName: '不应提交',
    })).toEqual({
      invoiceInfo: { name: '示例公司', taxNo: '91350211M000100Y43' },
    });
  });
});
