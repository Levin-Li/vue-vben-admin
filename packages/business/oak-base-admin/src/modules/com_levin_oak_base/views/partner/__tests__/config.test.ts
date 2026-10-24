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
      partnerCommonFields.find((field) => field.key === 'orgId'),
    ).toMatchObject({
      formCreate: true,
      formEdit: false,
      type: 'select',
    });
    expect(
      partnerCommonFields.find((field) => field.key === 'orgName'),
    ).toMatchObject({
      formCreate: false,
      formEdit: true,
      disabledOnEdit: true,
    });
    expect(
      partnerCommonFields.find((field) => field.key === 'orgId')?.required,
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
    expect(
      supplierPartnerPageCrudConfig.fields.find(
        (field) => field.key === 'orgId',
      ),
    ).toMatchObject({ label: '新供应伙伴组织的内部父级' });
    expect(
      channelPartnerPageCrudConfig.fields.find(
        (field) => field.key === 'orgId',
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
});
