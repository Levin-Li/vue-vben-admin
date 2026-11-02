import { describe, expect, it, vi } from 'vitest';

import {
  buildMasterPartyFields,
  customerPartnerParties,
} from '../master-party-fields';

const { users } = vi.hoisted(() => ({
  users: vi.fn(async () => [
    { label: '跨部门负责人', value: 'user-2', orgId: 'another-org' },
  ]),
}));
vi.mock('../api-module', () => ({ userOptionsLoader: users }));

// 同方组织不能被前端作为负责人候选的额外限制。
describe('主档参与组织与负责人', () => {
  it('客户和伙伴的五方均使用独立用户选择，保留跨部门候选', async () => {
    const fields = buildMasterPartyFields(customerPartnerParties, true);
    for (const party of [
      'subject',
      'sales',
      'presales',
      'aftersales',
      'finance',
    ]) {
      const user = fields.find((field) => field.key === `${party}UserId`);
      expect(await user?.loadOptions?.('负责人')).toEqual([
        { label: '跨部门负责人', value: 'user-2', orgId: 'another-org' },
      ]);
      expect(users).toHaveBeenLastCalledWith('负责人');
    }
    expect(fields.every((field) => field.search === false)).toBe(true);
    expect(fields.some((field) => field.key === 'orgId')).toBe(false);
    expect(fields.some((field) => field.key === 'ownerId')).toBe(false);
  });

  it('自身外部节点只读而职能组织可编辑，表格显示各自关联对象名称', () => {
    const fields = buildMasterPartyFields(customerPartnerParties, true);
    const subject = fields.find((field) => field.key === 'subjectOrgId');
    const sales = fields.find((field) => field.key === 'salesOrgId');
    const financeUser = fields.find((field) => field.key === 'financeUserId');
    expect(subject).toMatchObject({
      formCreate: false,
      disabledOnEdit: true,
      omitOnEdit: true,
    });
    expect(typeof sales?.disabledOnEdit).toBe('function');
    expect(
      sales?.tableValue?.({ salesOrgId: 'o1', salesOrg: { name: '销售一部' } }),
    ).toBe('销售一部');
    expect(
      financeUser?.tableValue?.({
        financeUserId: 'u1',
        financeUser: { name: '财务负责人' },
      }),
    ).toBe('财务负责人');
  });
  it('普通用户只读参与方分派，可信管理员可编辑但不能换绑主体节点', () => {
    const fields = buildMasterPartyFields(customerPartnerParties, true);
    const disabled = (key: string, userInfo: unknown) => {
      const rule = fields.find((field) => field.key === key)?.disabledOnEdit;
      return typeof rule === 'function' ? rule({ userInfo }) : rule === true;
    };
    for (const field of fields) {
      expect(disabled(field.key, { admin: false })).toBe(true);
      expect(
        disabled(field.key, { name: '管理员', roleList: ['管理员'] }),
      ).toBe(true);
      if (field.key !== 'subjectOrgId') {
        expect(disabled(field.key, { admin: true })).toBe(false);
        expect(disabled(field.key, { isAdmin: true })).toBe(false);
      }
    }
    expect(disabled('subjectOrgId', { admin: true })).toBe(true);
  });
});
