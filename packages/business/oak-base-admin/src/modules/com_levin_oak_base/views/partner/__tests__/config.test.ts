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
      disabledOnEdit: true,
      required: true,
      type: 'select',
    });
  });

  it('供应与渠道页面分别绑定自身的外部组织节点', () => {
    expect(
      supplierPartnerPageCrudConfig.fields.find(
        (field) => field.key === 'orgId',
      ),
    ).toMatchObject({ label: '供应伙伴组织节点' });
    expect(
      channelPartnerPageCrudConfig.fields.find(
        (field) => field.key === 'orgId',
      ),
    ).toMatchObject({ label: '渠道伙伴组织节点' });
    for (const type of ['SupplierPartner', 'ChannelPartner']) {
      expect(optionLoaderCalls).toContainEqual([
        '/Org/list',
        'name',
        'id',
        { pageIndex: 1, pageSize: 500, type },
        'containsName',
      ]);
    }
  });
});
