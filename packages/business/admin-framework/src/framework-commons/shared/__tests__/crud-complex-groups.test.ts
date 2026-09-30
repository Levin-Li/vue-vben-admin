import { describe, expect, it } from 'vitest';

import {
  buildCrudComplexGroupInitialState,
  buildCrudComplexGroupPayload,
  getCrudComplexGroupFieldValue,
  isCrudComplexGroupEnabled,
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

const nestedGroups = [
  {
    fieldMappings: { oneTitle: 'title' },
    key: 'one',
    submitKey: 'nestedObject',
    title: '第一层',
  },
  {
    fieldMappings: { twoName: 'name' },
    key: 'two',
    parentKey: 'one',
    submitKey: 'nestedObject.levelTwo',
    title: '第二层',
  },
  {
    fieldMappings: { threeLabel: 'label' },
    key: 'three',
    parentKey: 'two',
    submitKey: 'nestedObject.levelTwo.levelThree',
    title: '第三层',
  },
  {
    fieldMappings: { fourValue: 'value' },
    key: 'four',
    parentKey: 'three',
    submitKey: 'nestedObject.levelTwo.levelThree.levelFour',
    title: '第四层',
  },
];

describe('复杂属性分组', () => {
  it('新建时默认勾选并展开对象', () => {
    expect(buildCrudComplexGroupInitialState(groups)).toEqual({
      collapsed: { contact: false, invoice: false },
      enabled: { contact: true, invoice: true },
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

    expect(initial.enabled).toEqual({ contact: true, invoice: true });
    expect(initial.collapsed).toEqual({ contact: false, invoice: false });
    expect(initial.flatValues).toMatchObject({
      invoiceName: '示例公司',
      invoiceTaxNo: '91350211M000100Y43',
    });
    expect(
      buildCrudComplexGroupPayload(
        groups,
        { contact: false, invoice: true },
        {
          ...initial.flatValues,
          contactMobile: '13800000000',
          contactName: '不应提交',
        },
      ),
    ).toEqual({
      invoiceInfo: { name: '示例公司', taxNo: '91350211M000100Y43' },
    });
  });

  it('列表从返回对象的联系人属性读取已声明的列值', () => {
    expect(
      getCrudComplexGroupFieldValue(
        { contactInfo: { mobilePhone: '13800000000' } },
        'contactMobile',
        'contact',
        groups,
      ),
    ).toBe('13800000000');
    expect(
      getCrudComplexGroupFieldValue({}, 'contactMobile', 'contact', groups),
    ).toBeUndefined();
  });

  it('四层对象按真实路径回显和提交，不产生带点号的顶层键', () => {
    const record = {
      nestedObject: {
        title: '一级',
        levelTwo: {
          name: '二级',
          levelThree: { label: '三级', levelFour: { value: '四级' } },
        },
      },
    };
    const initial = buildCrudComplexGroupInitialState(nestedGroups, record);

    expect(initial.flatValues).toMatchObject({
      oneTitle: '一级',
      twoName: '二级',
      threeLabel: '三级',
      fourValue: '四级',
    });
    expect(
      buildCrudComplexGroupPayload(
        nestedGroups,
        initial.enabled,
        initial.flatValues,
      ),
    ).toEqual(record);
    expect(
      getCrudComplexGroupFieldValue(record, 'fourValue', 'four', nestedGroups),
    ).toBe('四级');
  });

  it('取消第一层省略整支，取消任意子层清空对应对象及后代', () => {
    const values = {
      oneTitle: '一级',
      twoName: '二级',
      threeLabel: '三级',
      fourValue: '四级',
    };

    expect(
      buildCrudComplexGroupPayload(
        nestedGroups,
        { one: false, two: true, three: true, four: true },
        values,
      ),
    ).toEqual({});
    expect(
      buildCrudComplexGroupPayload(
        nestedGroups,
        { one: true, two: true, three: false, four: true },
        values,
      ),
    ).toEqual({
      nestedObject: {
        title: '一级',
        levelTwo: { name: '二级', levelThree: null },
      },
    });
    expect(
      isCrudComplexGroupEnabled('four', nestedGroups, {
        one: true,
        two: true,
        three: false,
        four: true,
      }),
    ).toBe(false);
  });
});
