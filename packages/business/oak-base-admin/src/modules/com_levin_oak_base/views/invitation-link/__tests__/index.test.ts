import { buildCrudQueryItems } from '@levin/admin-framework/framework-commons/shared/crud-query-items';
import { describe, expect, it } from 'vitest';

import {
  createInvitationLinkCrudConfig,
  invitationCreateActions,
  normalizeInvitationListQuery,
  projectInvitationDetail,
} from '../config';

const apiService = {
  list: async () => ({ items: [], totals: 0 }),
  create: async () => ({ id: 'new', url: 'https://example.test/invite' }),
  retrieve: async () => ({ id: 'new' }),
};

describe('邀请链接公共 CRUD 配置', () => {
  it('平台详情保留租户及外部邀请适用字段，排除其它目标字段', () => {
    const detail = projectInvitationDetail(
      {
        id: 'id',
        tenantId: 'tenant-a',
        targetOrgId: 'org-a',
        targetOrgName: '甲组织',
        targetType: 'SupplierPartner',
        organizationMode: 'CreateChildOrg',
        childOrgType: 'SupplierPartner',
        status: 'Active',
        userType: 'Administrator',
        usageMode: 'Limited',
        maxRegistrations: 5,
        organizationCategory: 'org-category',
        accountType: 'account-type',
        supplierPartnerType: 'Goods',
        channelPartnerType: 'Agent',
        customerType: 'DirectCustomer',
        url: 'secret',
        requiresExternalOrganization: true,
      },
      true,
    );
    expect(detail).toMatchObject({
      tenantId: 'tenant-a',
      targetOrgName: '甲组织',
      status: '有效',
      userType: 'Administrator',
      maxRegistrations: 5,
      organizationCategory: 'org-category',
      accountType: 'account-type',
      supplierPartnerType: 'Goods',
    });
    for (const key of [
      'id',
      'targetOrgId',
      'url',
      'requiresExternalOrganization',
      'channelPartnerType',
      'customerType',
      'childOrgType',
    ]) {
      expect(detail).not.toHaveProperty(key);
    }
  });

  it('内部邀请创建子组织时保留可读类型，详情状态按现有中文选项显示', () => {
    const detail = projectInvitationDetail(
      {
        targetType: 'Internal',
        organizationMode: 'CreateChildOrg',
        childOrgType: 'Department',
        status: 'Exhausted',
      },
      false,
    );
    expect(detail).toMatchObject({
      childOrgType: 'Department',
      status: '次数已用尽',
    });
  });

  it('外部详情优先展示服务端字典名称，名称不可用时保留原编码', () => {
    const detail = projectInvitationDetail(
      {
        targetType: 'Customer',
        organizationCategory: 'org-code',
        organizationCategoryName: '企业组织',
        accountType: 'user-code',
        accountTypeName: '',
      },
      true,
    );
    expect(detail).toMatchObject({
      organizationCategory: '企业组织',
      accountType: 'user-code',
    });
    expect(detail).not.toHaveProperty('organizationCategoryName');
    expect(detail).not.toHaveProperty('accountTypeName');
  });

  it('将六个查询条件交给真实列表接口，不丢弃分页和过滤条件', () => {
    expect(
      normalizeInvitationListQuery({
        pageIndex: 2,
        pageSize: 30,
        targetType: 'Customer',
        userType: 'Employee',
        registrationChannel: 'Email',
        usageMode: 'Limited',
        expiresAfter: '2026-11-01',
        expiresBefore: '2026-12-01',
        status: 'ignored',
      }),
    ).toEqual({
      pageIndex: 2,
      pageSize: 30,
      targetType: 'Customer',
      userType: 'Employee',
      registrationChannel: 'Email',
      usageMode: 'Limited',
      expiresAfter: '2026-11-01',
      expiresBefore: '2026-12-01',
    });
  });

  it('使用公共查询、新增、详情和列表工具，并关闭无后端动作的编辑删除', () => {
    const config = createInvitationLinkCrudConfig({
      apiService,
      canCreate: true,
      canInviteChildAdmin: false,
      target: 'Internal',
    });
    expect(config.apiBase).toBe('/InvitationLink');
    expect(config.allowCreate).toBe(true);
    expect(config.allowRetrieve).toBe(true);
    expect(config.allowEdit).toBe(false);
    expect(config.allowDelete).toBe(false);
    expect(
      config.fields.find((field) => field.key === 'targetOrgId'),
    ).toMatchObject({
      label: '邀请到哪个组织',
      form: true,
      required: true,
    });
    expect(config.createSubmitKeys).toContain('targetOrgId');
    expect(
      config.fields.find((field) => field.key === 'targetOrgName'),
    ).toMatchObject({
      label: '目标组织',
      form: false,
      table: true,
    });
    expect(config.dataAttrTargets?.create?.path).toContain(
      '/InvitationLink/createInternal',
    );
    expect(
      config.fields.filter((field) => field.search).map((field) => field.key),
    ).toEqual([
      'targetType',
      'userType',
      'registrationChannel',
      'usageMode',
      'expiresAfter',
      'expiresBefore',
    ]);
    expect(
      buildCrudQueryItems(config.fields.filter((field) => field.search)).at(-1),
    ).toEqual({
      kind: 'range',
      key: 'expiresAfter__expiresBefore',
      label: '到期日期',
      format: 'date',
      startKey: 'expiresAfter',
      endKey: 'expiresBefore',
    });
    expect(
      config.fields.find((field) => field.key === 'userType')?.options,
    ).toEqual([
      { label: '普通用户', value: 'Employee' },
      { label: '管理员', value: 'Administrator' },
    ]);
    expect(config.fields.find((field) => field.key === 'userType')?.label).toBe(
      '账号身份',
    );
  });

  it('内部员工在列表显示普通员工，外部身份及查询值不变', () => {
    const config = createInvitationLinkCrudConfig({
      apiService,
      canCreate: true,
      canInviteChildAdmin: true,
      target: 'Internal',
    });
    const field = config.fields.find((item) => item.key === 'userType');
    expect(
      field?.tableValue?.({ targetType: 'Internal', userType: 'Employee' }),
    ).toBe('普通员工');
    expect(
      field?.tableValue?.({ targetType: 'Customer', userType: 'Employee' }),
    ).toBe('Employee');
    expect(
      field?.tableValue?.({
        targetType: 'Customer',
        userType: 'Administrator',
      }),
    ).toBe('Administrator');
    expect(
      normalizeInvitationListQuery({ userType: 'Employee' }).userType,
    ).toBe('Employee');
  });

  it('只把服务端返回的可选目标组织放入创建表单', () => {
    const config = createInvitationLinkCrudConfig({
      apiService,
      canCreate: true,
      canInviteChildAdmin: false,
      target: 'Customer',
      targetOrganizations: [
        { id: 'org-a', name: '华东公司' },
        { id: 'org-b', name: '华南公司' },
      ],
    });
    expect(
      config.fields.find((field) => field.key === 'targetOrgId')?.options,
    ).toEqual([
      { label: '华东公司', value: 'org-a' },
      { label: '华南公司', value: 'org-b' },
    ]);
    expect(config.defaultFormValues?.targetOrgId).toBeUndefined();
    const one = createInvitationLinkCrudConfig({
      apiService,
      canCreate: true,
      canInviteChildAdmin: false,
      target: 'Internal',
      targetOrganizations: [{ id: 'org-a', name: '华东公司' }],
    });
    expect(one.defaultFormValues?.targetOrgId).toBe('org-a');
  });

  it('不同目标采用对应创建方法和条件字段，不复用别的目标属性策略', () => {
    const customer = createInvitationLinkCrudConfig({
      apiService,
      canCreate: true,
      canInviteChildAdmin: true,
      target: 'Customer',
    });
    const member = createInvitationLinkCrudConfig({
      apiService,
      canCreate: true,
      canInviteChildAdmin: false,
      target: 'Member',
    });
    expect(customer.dataAttrTargets?.create?.path).toContain(
      '/InvitationLink/createCustomer',
    );
    expect(member.dataAttrTargets?.create?.path).toContain(
      '/InvitationLink/createMember',
    );
    expect(
      customer.fields.find((field) => field.key === 'customerType')?.form,
    ).toBe(true);
    expect(
      member.fields.find((field) => field.key === 'customerType')?.form,
    ).toBe(false);
    expect(member.defaultFormValues?.userType).toBe('Employee');
    expect(customer.createFormTitle).toBe('新增客户邀请链接');
    expect(member.createFormTitle).toBe('新增会员用户邀请链接');
    const partnerField = customer.fields.find(
      (field) => field.key === 'channelPartnerId',
    ) as
      | undefined
      | { formVisibleWhen?: (state: Record<string, any>) => boolean };
    expect(
      partnerField?.formVisibleWhen?.({ customerType: 'DirectCustomer' }),
    ).toBe(false);
    expect(
      partnerField?.formVisibleWhen?.({ customerType: 'ChannelCustomer' }),
    ).toBe(true);
  });
  it('五个签发动作来自API元数据且不显示泛化新增', () => {
    const actions = invitationCreateActions(async () => {});
    expect(actions.map((action) => action.label)).toEqual([
      '创建内部用户邀请',
      '创建会员用户邀请',
      '创建客户邀请',
      '创建供应伙伴邀请',
      '创建渠道伙伴邀请',
    ]);
    expect(
      actions.every(
        (action) =>
          action.opRefTargetType === 'None' &&
          action.successMessage === false &&
          action.successAction === 'None' &&
          action.reloadAfterAction === false,
      ),
    ).toBe(true);
    expect(
      createInvitationLinkCrudConfig({
        apiService,
        canCreate: true,
        canInviteChildAdmin: false,
        target: 'Internal',
      }).createButtonVisible,
    ).toBe(false);
  });

  it('可空到期日期与限定人数遵循后端边界', () => {
    const fields = createInvitationLinkCrudConfig({
      apiService,
      canCreate: true,
      canInviteChildAdmin: false,
      target: 'Internal',
    }).fields;
    const expires = fields.find(
      (field) => field.key === 'expiresAt',
    )?.validator;
    const count = fields.find(
      (field) => field.key === 'maxRegistrations',
    )?.validator;
    if (!expires || !count) throw new Error('邀请校验缺失');
    expect(fields.find((field) => field.key === 'expiresAt')).toMatchObject({
      type: 'date',
      required: false,
      placeholder: '留空表示永不过期',
    });
    expect(expires(null, {})).toBeUndefined();
    expect(expires('invalid', {})).toBeTruthy();
    expect(expires('2026-02-31', {})).toBeTruthy();
    const future = new Date();
    future.setDate(future.getDate() + 2);
    const futureDate = [
      future.getFullYear(),
      String(future.getMonth() + 1).padStart(2, '0'),
      String(future.getDate()).padStart(2, '0'),
    ].join('-');
    expect(
      expires(
        new Date(Date.now() + 367 * 86_400_000).toISOString().slice(0, 10),
        {},
      ),
    ).toBeTruthy();
    expect(expires(futureDate, {})).toBeUndefined();
    expect(count(10_000, {})).toBeUndefined();
    expect(count(10_001, {})).toBeTruthy();
    expect(count(1.5, {})).toBeTruthy();
  });

  it('伙伴类型用中文展示并保持原枚举值', () => {
    const supplier = createInvitationLinkCrudConfig({
      apiService,
      canCreate: true,
      canInviteChildAdmin: false,
      target: 'SupplierPartner',
    });
    const channel = createInvitationLinkCrudConfig({
      apiService,
      canCreate: true,
      canInviteChildAdmin: false,
      target: 'ChannelPartner',
    });
    expect(supplier.createFormTitle).toBe('新增供应伙伴邀请链接');
    expect(
      supplier.fields.find((field) => field.key === 'supplierPartnerType')
        ?.options,
    ).toContainEqual({ label: '内容与版权', value: 'ContentAndCopyright' });
    expect(
      channel.fields.find((field) => field.key === 'channelPartnerType')
        ?.options,
    ).toContainEqual({ label: '经销商', value: 'Dealer' });
  });
});
