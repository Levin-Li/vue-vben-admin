import { resolveDetailFields } from '@levin/admin-framework/framework-commons/shared/detail-display';
import { describe, expect, it, vi } from 'vitest';

import { channelPartnerPageCrudConfig } from '../../channel-partner/config';
import { supplierPartnerPageCrudConfig } from '../../supplier-partner/config';
import { partnerCommonFields } from '../config';

const { optionLoaderCalls } = vi.hoisted(() => ({
  optionLoaderCalls: [] as any[],
}));

vi.mock('../../../api/supplier-partner-service', () => ({
  supplierPartnerService: {},
}));
vi.mock('../../../api/channel-partner-service', () => ({
  channelPartnerService: {},
}));
vi.mock('../../api-module', () => ({
  buildDictOptionsLoader: () => async () => [],
  buildEnumOptionsLoader: () => async () => [],
  buildModuleOptionsLoader: (...args: any[]) => {
    optionLoaderCalls.push(args);
    return async () => [];
  },
  DEFAULT_CRUD_MODAL_WIDTH: 960,
  tenantOptionsLoader: async () => [],
  userOptionsLoader: async () => [],
  withModuleCrudConfig: (config: any) => config,
}));

describe('合作关系公共资料', () => {
  it('保留行业与业务名称，移除旧身份字段', () => {
    const keys = partnerCommonFields.map((field) => field.key);
    for (const key of ['industries', 'displayName', 'shortName'])
      expect(keys).toContain(key);
    for (const key of ['category', 'subCategory', 'externalOrgId'])
      expect(keys).not.toContain(key);
    expect(keys).not.toContain('ownerId');
    expect(
      partnerCommonFields.find((field) => field.key === 'parentOrgId'),
    ).toMatchObject({
      formCreate: true,
      formEdit: false,
      type: 'select',
    });
    expect(
      partnerCommonFields.find((field) => field.key === 'subjectOrgId'),
    ).toMatchObject({
      formCreate: false,
      disabledOnEdit: true,
      omitOnEdit: true,
    });
    expect(
      partnerCommonFields.find((field) => field.key === 'parentOrgId')
        ?.required,
    ).not.toBe(true);
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
      expect(
        config.fields.find((field) => field.key === 'displayName')?.label,
      ).toBe('名称');
      expect(
        config.fields.find((field) => field.key === 'containsDisplayName')
          ?.label,
      ).toBe('名称');
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

  it('供应与渠道页面只选择新外部组织的内部父级', () => {
    const supplierTypeField = supplierPartnerPageCrudConfig.fields.find(
      (field) => field.key === 'type',
    );
    expect(supplierTypeField).toMatchObject({
      label: '供应商类型',
      required: true,
    });
    expect(supplierTypeField?.help).toBeUndefined();
    expect(
      supplierPartnerPageCrudConfig.fields.find(
        (field) => field.key === 'parentOrgId',
      ),
    ).toMatchObject({ label: '新供应伙伴组织的内部父级' });
    expect(
      channelPartnerPageCrudConfig.fields.find(
        (field) => field.key === 'parentOrgId',
      ),
    ).toMatchObject({ label: '新渠道伙伴组织的内部父级' });
    expect(optionLoaderCalls.filter((args) => args[0] === '/Org/list')).toEqual(
      [
        [
          '/Org/list',
          'name',
          'id',
          {
            pageIndex: 1,
            pageSize: 500,
            inType: [
              'Company',
              'Branch',
              'Department',
              'Team',
              'Group',
              'TempOrg',
            ],
          },
          'containsName',
        ],
        [
          '/Org/list',
          'name',
          'id',
          {
            pageIndex: 1,
            pageSize: 500,
            inType: [
              'Company',
              'Branch',
              'Department',
              'Team',
              'Group',
              'TempOrg',
            ],
          },
          'containsName',
        ],
      ],
    );
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
        'sales',
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
