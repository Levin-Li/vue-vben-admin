import { describe, expect, it } from 'vitest';

import {
  createInvitationLinkCrudConfig,
  normalizeInvitationListQuery,
} from '../config';

const apiService = {
  list: async () => ({ items: [], totals: 0 }),
  create: async () => ({ id: 'new', url: 'https://example.test/invite' }),
  retrieve: async () => ({ id: 'new' }),
};

describe('邀请链接公共 CRUD 配置', () => {
  it('将六个查询条件交给真实列表接口，不丢弃分页和过滤条件', () => {
    expect(
      normalizeInvitationListQuery({
        pageIndex: 2,
        pageSize: 30,
        targetType: 'Customer',
        userType: 'Employee',
        registrationChannel: 'Email',
        usageMode: 'Limited',
        expiresAfter: '2026-11-01T00:00:00',
        expiresBefore: '2026-12-01T00:00:00',
        status: 'ignored',
      }),
    ).toEqual({
      pageIndex: 2,
      pageSize: 30,
      targetType: 'Customer',
      userType: 'Employee',
      registrationChannel: 'Email',
      usageMode: 'Limited',
      expiresAfter: '2026-11-01T00:00:00',
      expiresBefore: '2026-12-01T00:00:00',
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
      config.fields.find((field) => field.key === 'userType')?.options,
    ).toEqual([{ label: '普通用户', value: 'Employee' }]);
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
});
