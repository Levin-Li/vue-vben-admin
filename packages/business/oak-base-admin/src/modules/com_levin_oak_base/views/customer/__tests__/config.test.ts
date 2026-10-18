import { describe, expect, it, vi } from 'vitest';

import { customerPageCrudConfig } from '../config';

vi.mock('../../../api/customer-service', () => ({ customerService: {} }));
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

describe('独立客户页面', () => {
  it('使用客户业务保存接口并独立维护联系人和运营字段', () => {
    const field = (key: string) =>
      customerPageCrudConfig.fields.find((item) => item.key === key);

    expect(customerPageCrudConfig.apiBase).toBe('/Customer');
    expect(customerPageCrudConfig.allowDelete).toBe(false);
    expect(customerPageCrudConfig.createPath).toBe('/Customer/saveCustomer');
    expect(customerPageCrudConfig.updatePath).toBe('/Customer/updateCustomer');
    expect(field('legalSubjectId')).toMatchObject({
      disabledOnEdit: true,
      required: true,
      type: 'select',
    });
    expect(field('legalSubjectName')).toMatchObject({
      form: false,
      table: true,
    });
    for (const key of ['type', 'orgId', 'ownerId']) {
      expect(field(key), key).toMatchObject({ disabledOnEdit: true });
    }
    expect(field('channelPartnerId')).toMatchObject({ disabledOnEdit: true });
    expect(field('channelPartnerName')).toMatchObject({
      form: false,
      table: true,
    });
    for (const key of [
      'contactName',
      'contactPhone',
      'contactEmail',
      'level',
      'industries',
      'confidentialLevel',
      'groupName',
      'investmentRelation',
      'expiredTime',
    ]) {
      expect(field(key), key).toBeDefined();
    }
    expect(field('contactName')?.complexGroupKey).toBeUndefined();
    expect(field('subjectName')).toBeUndefined();
    expect(field('subCategory')).toBeUndefined();
  });

  it('渠道客户要求渠道伙伴，直接客户提交时移除该关联', async () => {
    const channelField = customerPageCrudConfig.fields.find(
      (item) => item.key === 'channelPartnerId',
    );
    expect(
      channelField?.validator?.(undefined, { type: 'ChannelCustomer' }),
    ).toBe('渠道客户请选择渠道伙伴');
    expect(
      channelField?.validator?.('partner-1', { type: 'ChannelCustomer' }),
    ).toBeUndefined();
    expect(
      channelField?.validator?.(undefined, { type: 'DirectCustomer' }),
    ).toBeUndefined();
    expect(
      await customerPageCrudConfig.transformSubmit?.(
        { type: 'DirectCustomer', channelPartnerId: 'partner-1' },
        null,
      ),
    ).toEqual({ type: 'DirectCustomer' });
    expect(
      await customerPageCrudConfig.transformSubmit?.(
        { type: 'ChannelCustomer', channelPartnerId: 'partner-1' },
        null,
      ),
    ).toEqual({ type: 'ChannelCustomer', channelPartnerId: 'partner-1' });
  });
});
