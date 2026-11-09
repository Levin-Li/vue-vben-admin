import { resolveDetailFields } from '@levin/admin-framework/framework-commons/shared/detail-display';
import { describe, expect, it, vi } from 'vitest';

import { channelPartnerPageCrudConfig } from '../../channel-partner/config';
import { customerPageCrudConfig } from '../../customer/config';
import { supplierPartnerPageCrudConfig } from '../../supplier-partner/config';
import { partnerCommonFields } from '../config';

vi.mock('../../../api/supplier-partner-service', () => ({
  supplierPartnerService: {},
}));
vi.mock('../../../api/channel-partner-service', () => ({
  channelPartnerService: {},
}));
vi.mock('../../../api/customer-service', () => ({
  customerService: {},
}));
vi.mock('../../api-module', () => ({
  buildDictOptionsLoader: () => async () => [],
  buildEnumOptionsLoader: () => async () => [],
  buildModuleOptionsLoader: () => async () => [],
  confidentialLevelOptionsLoader: async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: 960,
  tenantOptionsLoader: async () => [],
  userOptionsLoader: async () => [],
  withModuleCrudConfig: (config: any) => config,
}));

describe('合作关系公共资料', () => {
  it('三个伙伴子类型共用自描述 JSON 扩展信息字段', () => {
    for (const config of [
      customerPageCrudConfig,
      supplierPartnerPageCrudConfig,
      channelPartnerPageCrudConfig,
    ]) {
      expect(
        config.fields.find((field) => field.key === 'extensionInfo'),
      ).toMatchObject({
        jsonSchemaEditor: true,
        jsonSchemaMode: 'popup',
        layoutGroup: 'extension',
        table: false,
        export: false,
      });
    }
  });

  it('渠道与供应伙伴均提供受控联系人、收寄及有效期字段', () => {
    for (const config of [
      channelPartnerPageCrudConfig,
      supplierPartnerPageCrudConfig,
    ]) {
      expect(
        config.complexGroups
          ?.filter((group) =>
            ['contactInfo', 'shippingInfo'].includes(group.submitKey || ''),
          )
          .map((group) => group.submitKey),
      ).toEqual(['contactInfo', 'shippingInfo']);
      for (const key of [
        'partyContactName',
        'shippingAddress',
        'confidentialLevel',
        'expiredTime',
      ])
        expect(config.fields.some((field) => field.key === key)).toBe(true);
    }
  });
  it('保留完整名称、简称及行业，移除旧业务名称', () => {
    const keys = partnerCommonFields.map((field) => field.key);
    for (const key of ['industries', 'name', 'shortName'])
      expect(keys).toContain(key);
    expect(keys).not.toContain('displayName');
    for (const key of ['category', 'subCategory', 'externalOrgId'])
      expect(keys).not.toContain(key);
    expect(keys).not.toContain('ownerId');
    expect(
      partnerCommonFields.find((field) => field.key === 'tenantId'),
    ).toMatchObject({ visibleForPlatformUser: true, disabledOnEdit: true });
    expect(
      partnerCommonFields.find((field) => field.key === 'tenantId')?.omitOnEdit,
    ).not.toBe(true);
    expect(
      partnerCommonFields.find((field) => field.key === 'name'),
    ).toMatchObject({
      label: '完整名称',
      required: true,
      table: true,
    });
    expect(
      partnerCommonFields.find((field) => field.key === 'parentOrgId'),
    ).toBeUndefined();
    expect(
      partnerCommonFields.find((field) => field.key === 'subjectOrgId'),
    ).toMatchObject({
      formCreate: false,
      disabledOnEdit: true,
      omitOnEdit: true,
    });
    expect(
      partnerCommonFields.find((field) => field.key === 'legalSubjectId')
        ?.required,
    ).not.toBe(true);
    expect(
      partnerCommonFields.find((field) => field.key === 'legalSubjectId')
        ?.disabledOnEdit,
    ).not.toBe(true);
  });

  it('供应与渠道页面的名称及名称查询统一使用名称标签', () => {
    // 两个页面复用伙伴字段，但仍逐一验证最终页面配置。
    for (const config of [
      supplierPartnerPageCrudConfig,
      channelPartnerPageCrudConfig,
    ]) {
      expect(config.fields.find((field) => field.key === 'name')?.label).toBe(
        '完整名称',
      );
      expect(
        config.fields.find((field) => field.key === 'containsName')?.label,
      ).toBe('完整名称');
    }
  });

  it('伙伴列表标明法律主体待完善并通过业务服务加载详情', () => {
    const subjectField = partnerCommonFields.find(
      (field) => field.key === 'legalSubjectStatus',
    );
    expect(subjectField?.tableValue?.({ legalSubjectId: null })).toBe('待完善');
    expect(
      subjectField?.tableValue?.({
        legalSubjectId: 'subject-1',
        legalSubjectName: '甲公司',
      }),
    ).toBe('已关联');
    expect(supplierPartnerPageCrudConfig.detailPath).toBeUndefined();
    expect(channelPartnerPageCrudConfig.detailPath).toBeUndefined();
  });

  it('供应与渠道普通新增不选择新外部组织的父级', () => {
    const supplierTypeField = supplierPartnerPageCrudConfig.fields.find(
      (field) => field.key === 'type',
    );
    expect(supplierTypeField).toMatchObject({
      label: '供应商类型',
      required: true,
    });
    expect(supplierTypeField?.help).toBeUndefined();
    expect(
      supplierPartnerPageCrudConfig.fields.some(
        (field) => field.key === 'parentOrgId',
      ),
    ).toBe(false);
    expect(
      channelPartnerPageCrudConfig.fields.some(
        (field) => field.key === 'parentOrgId',
      ),
    ).toBe(false);
  });
  it.each([supplierPartnerPageCrudConfig, channelPartnerPageCrudConfig])(
    '伙伴详情不重复显示五方关联对象及内部字段',
    (config) => {
      const record: Record<string, unknown> = {
        optimisticLock: 1,
        creator: 'u1',
        actionLog: [],
        supportEventsByCurrentStatus: [],
        legalSubject: {},
      };
      for (const party of [
        'subject',
        'business',
        'presales',
        'aftersales',
        'finance',
      ]) {
        record[`${party}OrgId`] = 'org-1';
        record[`${party}UserId`] = 'u1';
        record[`${party}Org`] = {};
        record[`${party}User`] = {};
      }
      const fields = resolveDetailFields(record, config.fields);
      expect(fields).toHaveLength(10);
      expect(fields.every((field) => /(?:OrgId|UserId)$/.test(field.key))).toBe(
        true,
      );
    },
  );
});
