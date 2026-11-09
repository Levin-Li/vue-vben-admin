import { resolveDetailFields } from '@levin/admin-framework/framework-commons/shared/detail-display';
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
  it('客户完整名称、简称和公共资料可独立维护', () => {
    for (const key of [
      'name',
      'shortName',
      'industries',
      'investmentRelation',
      'groupName',
      'expiredTime',
    ]) {
      const field = customerPageCrudConfig.fields.find(
        (item) => item.key === key,
      );
      expect(field, key).toBeDefined();
      expect(field?.form).not.toBe(false);
      expect(field?.formEdit).not.toBe(false);
    }
    const fullName = customerPageCrudConfig.fields.find(
      (item) => item.key === 'name',
    );
    expect(fullName).toMatchObject({ required: true, table: true });
    expect(
      customerPageCrudConfig.fields.some((item) => item.key === 'displayName'),
    ).toBe(false);
    expect(
      customerPageCrudConfig.fields.find((item) => item.key === 'containsName'),
    ).toMatchObject({ search: true, form: false });
    expect(
      customerPageCrudConfig.fields.some((item) => item.key === 'customerName'),
    ).toBe(false);
  });
  it('对方联系人和财务、收寄资料使用独立的授权资料组', () => {
    const groups = customerPageCrudConfig.complexGroups || [];
    expect(
      groups.filter((group) => group.submitKey === 'contactInfo'),
    ).toHaveLength(1);
    expect(
      groups.filter((group) => group.submitKey === 'shippingInfo'),
    ).toHaveLength(1);
    expect(groups.map((group) => group.submitKey)).toEqual(
      expect.arrayContaining([
        'bankAccount',
        'invoiceInfo',
        'contactInfo',
        'shippingInfo',
      ]),
    );
    for (const key of [
      'partyContactName',
      'shippingAddress',
      'settlementBankAccount',
      'invoiceTaxNo',
    ]) {
      expect(
        customerPageCrudConfig.fields.find((field) => field.key === key),
      ).toMatchObject({ table: false, export: false });
    }
    expect(
      customerPageCrudConfig.fields.some(
        (field) => field.key === 'contactName',
      ),
    ).toBe(true);
  });
  it('使用客户业务保存接口并独立维护联系人和运营字段', () => {
    const field = (key: string) =>
      customerPageCrudConfig.fields.find((item) => item.key === key);

    expect(customerPageCrudConfig.apiBase).toBe('/Customer');
    expect(customerPageCrudConfig.allowDelete).toBe(false);
    expect(customerPageCrudConfig.createPath).toBe('/Customer/saveCustomer');
    expect(customerPageCrudConfig.updatePath).toBe('/Customer/updateCustomer');
    expect(field('legalSubjectId')).toMatchObject({
      type: 'select',
    });
    expect(field('legalSubjectId')?.required).not.toBe(true);
    expect(field('legalSubjectId')?.disabledOnEdit).not.toBe(true);
    expect(field('legalSubjectName')).toMatchObject({
      form: false,
      table: true,
    });
    expect(field('type')).toMatchObject({ disabledOnEdit: true });
    expect(field('parentOrgId')).toBeUndefined();
    expect(field('subjectOrgId')).toMatchObject({
      label: '主体方组织',
      formCreate: false,
      disabledOnEdit: true,
      omitOnEdit: true,
    });
    expect(field('businessOrgId')).toMatchObject({ label: '商务对接部门' });
    expect(field('businessUserId')).toMatchObject({ label: '商务对接人' });
    expect(field('tenantId')).toMatchObject({
      visibleForPlatformUser: true,
      disabledOnEdit: true,
    });
    expect(field('tenantId')?.omitOnEdit).not.toBe(true);
    expect(field('ownerId')).toBeUndefined();
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

  it('普通新增与新增我的都要求完整名称', () => {
    const nameField = customerPageCrudConfig.fields.find(
      (item) => item.key === 'name',
    );
    expect(nameField).toMatchObject({
      required: true,
    });
    expect(nameField?.validator?.('', {})).toBe('请输入完整名称');
    expect(nameField?.validator?.('甲客户', {})).toBeUndefined();
    expect(nameField?.validator?.('   ', {})).toBe('请输入完整名称');
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
  it('客户详情保留五方 ID 展示而不重复显示关联对象和版本字段', () => {
    const record: Record<string, unknown> = {
      optimisticLock: 1,
      legalSubject: {},
      channelPartner: {},
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
    const fields = resolveDetailFields(record, customerPageCrudConfig.fields);
    expect(fields).toHaveLength(10);
    expect(fields.every((field) => /(?:OrgId|UserId)$/.test(field.key))).toBe(
      true,
    );
  });
  it('客户完整名称用于列表和详情识别，旧组织名称字段不再作为新增输入', () => {
    expect(
      customerPageCrudConfig.fields.find((field) => field.key === 'name'),
    ).toMatchObject({
      label: '完整名称',
      required: true,
      table: true,
      detail: true,
      width: 220,
    });
  });
});
