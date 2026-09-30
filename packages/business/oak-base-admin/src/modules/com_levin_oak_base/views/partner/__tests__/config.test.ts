import { describe, expect, it, vi } from 'vitest';

import { partnerPageCrudConfig } from '../config';

vi.mock('../../../api/partner-service', () => ({
  partnerService: {},
}));

vi.mock('../../api-module', () => ({
  buildDictOptionsLoader: () => async () => [],
  buildEnumOptionsLoader: () => async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: 960,
  FILE_STORAGE_SINGLE_UPLOAD_PATH: '/FileStorage/uploadSingleFile',
  tenantOptionsLoader: async () => [],
  userOptionsLoader: async () => [],
  withModuleCrudConfig: (config: any) => config,
}));

describe('partner page config', () => {
  it('uses titled form groups and image uploads for certification materials', () => {
    const fields = partnerPageCrudConfig.fields;

    expect(fields.find((field) => field.key === 'category')).toMatchObject({
      layoutGroupTitle: '归属与分类',
    });
    expect(fields.find((field) => field.key === 'shortName')).toMatchObject({
      layoutGroupTitle: '主体信息',
    });
    expect(
      fields.find((field) => field.key === 'unifiedCreditNo'),
    ).toMatchObject({
      layoutGroupTitle: '主体证照与地址',
    });
    expect(
      fields.find((field) => field.key === 'investmentRelation'),
    ).toMatchObject({
      label: '投资关系',
      type: 'select',
    });
    expect(fields.find((field) => field.key === 'industries')).toMatchObject({
      type: 'tags',
    });
    for (const key of [
      'identityImg',
      'businessPremises',
      'legalIdFrontImageUrl',
      'legalIdBackImageUrl',
      'contactIdFrontImageUrl',
      'contactIdBackImageUrl',
    ]) {
      expect(fields.find((field) => field.key === key)).toMatchObject({
        type: 'image',
      });
    }
  });

  it('根据主体类型联动身份标识文案、校验和证件图片数量', () => {
    const identityField = partnerPageCrudConfig.fields.find(
      (field) => field.key === 'unifiedCreditNo',
    );
    const imageField = partnerPageCrudConfig.fields.find(
      (field) => field.key === 'identityImg',
    );

    expect(identityField?.formLabel?.({ subjectType: 'Person' })).toBe(
      '身份证号',
    );
    expect(identityField?.formLabel?.({ subjectType: 'Legal' })).toBe(
      '统一社会信用码',
    );
    expect(
      identityField?.validator?.('11010519491231002X', {
        subjectType: 'Person',
      }),
    ).toBeUndefined();
    expect(
      identityField?.validator?.('110105194912310021', {
        subjectType: 'Person',
      }),
    ).toContain('身份证号');
    expect(
      identityField?.validator?.('91350211M000100Y43', {
        subjectType: 'Legal',
      }),
    ).toBeUndefined();
    expect(imageField?.multiple).toBe(true);
    expect(imageField?.maxUploadCount?.({ subjectType: 'Person' })).toBe(2);
    expect(imageField?.maxUploadCount?.({ subjectType: 'Legal' })).toBe(1);
  });

  it('按后端字段注解语义限制城市及收货地址行政编码层级', () => {
    const fields = partnerPageCrudConfig.fields;

    expect(fields.find((field) => field.key === 'cityCode')).toMatchObject({
      areaCascader: { selectableLevels: ['city'], valueKey: 'cityCode' },
      type: 'area-cascader',
    });
    expect(
      fields.find((field) => field.key === 'shippingAreaCode'),
    ).toMatchObject({
      areaCascader: {
        selectableLevels: ['district'],
        valueKey: 'shippingAreaCode',
      },
      type: 'area-cascader',
    });
    expect(
      fields.some((field) =>
        /shipping(?:Province|City|District)Code/.test(field.key),
      ),
    ).toBe(false);
    expect(
      partnerPageCrudConfig.complexGroups?.find(
        (group) => group.key === 'shipping',
      )?.fieldMappings,
    ).toMatchObject({
      shippingAreaCode: 'areaCode',
      shippingNationCode: 'nationCode',
    });
  });

  it('以 SavePartnerReq 和级联 VO 约束确定字段与必填范围', () => {
    const field = (key: string) =>
      partnerPageCrudConfig.fields.find((item) => item.key === key);

    expect(field('level')).toMatchObject({ type: 'select', search: true });
    expect(field('logo')).toMatchObject({ type: 'image' });
    expect(field('subjectType')?.required).toBeUndefined();
    for (const key of [
      'legalName',
      'legalPhone',
      'contactName',
      'contactMobile',
      'shippingContactName',
      'shippingContactPhone',
      'shippingAddress',
      'invoiceName',
      'invoiceTaxNo',
      'taxRegisteredAddress',
      'taxRegisteredPhone',
      'bankName',
      'bankAccount',
    ]) {
      expect(field(key)?.required, key).toBe(true);
    }
    for (const key of [
      'legalEmail',
      'contactEmail',
      'invoiceEmail',
      'shippingAreaCode',
    ]) {
      expect(field(key)?.required, key).toBeFalsy();
    }
    expect(field('certificationRejectReason')).toBeUndefined();
    expect(field('lastStatusDesc')).toMatchObject({ form: false });
    expect(field('editable')).toMatchObject({ form: false });
    expect(field('containsSubjectName')).toMatchObject({
      form: false,
      search: true,
    });
  });
});
