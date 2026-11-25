import { describe, expect, it } from 'vitest';
import type { PartyOwnershipGroup } from '../party-ownership-types';
import { authorizePartyGroups, buildPartyChange, partyOperation, visiblePartyGroups } from '../party-ownership-model';

function group(overrides: Partial<PartyOwnershipGroup> = {}): PartyOwnershipGroup {
  return { key: 'operation', label: '运营', orgLabel: '运营团队', userLabel: '运营人员',
    orgField: 'operationOrgId', userField: 'operationUserId', bound: false,
    canReadOrg: true, canReadUser: true, canWriteOrg: true, canWriteUser: true,
    canBind: true, canAdjust: false, ...overrides };
}

describe('归属管理授权模型', () => {
  it('动态权限限定字段和操作，不暴露无读权限的值', () => {
    const d = group();
    const access = { canRead: (field: string) => field === d.orgField,
      canWrite: (action: string, field: string) => action === 'bind' && field === d.orgField,
      canOperate: (action: string) => action === 'bind' };
    const values = authorizePartyGroups([d], { operationOrgId: 'a', operationUserId: 'secret' }, { operation: false }, access);
    expect(values).toHaveLength(1);
    expect(values[0]?.orgId).toBe('a');
    expect(values[0]?.userId).toBeUndefined();
    expect(values[0]?.canWriteOrg).toBe(true);
    expect(values[0]?.canWriteUser).toBe(false);
    expect(authorizePartyGroups([d], {}, {}, access)).toEqual([]);
    expect(authorizePartyGroups([d], {}, { operation: true }, access)[0]?.canAdjust).toBe(false);
  });
  it('仅展示当前有字段权限的组', () => {
    const hidden = group({ key: 'secret', canReadOrg: false, canReadUser: false, canWriteOrg: false, canWriteUser: false });
    expect(visiblePartyGroups([hidden, group()]).map((item) => item.key)).toEqual(['operation']);
  });
  it('绑定与调整权限独立，已绑定但无调整权限时不可操作', () => {
    expect(partyOperation(group())).toBe('bind');
    expect(partyOperation(group({ bound: true }))).toBeNull();
    expect(partyOperation(group({ bound: true, canBind: false, canAdjust: true }))).toBe('adjust');
  });
  it('仅提交改变的获授权字段，拒绝无字段权限的修改', () => {
    const current = group({ bound: true, orgId: 'a', userId: null, canAdjust: true, canWriteUser: false });
    expect(buildPartyChange(current, 'b', null)).toEqual({ group: 'operation', operation: 'adjust',
      orgField: 'operationOrgId', userField: 'operationUserId', orgChanged: true, userChanged: false, orgId: 'b' });
    expect(() => buildPartyChange(current, 'a', 'v')).toThrow('没有人员字段权限');
  });
  it('人员存在时不能单独更改组织', () => {
    expect(() => buildPartyChange(group({ bound: true, orgId: 'a', userId: 'u', canAdjust: true }), 'b', 'u')).toThrow('请先清除人员');
  });
  it('拒绝空绑定和无变化提交', () => {
    expect(() => buildPartyChange(group(), null, null)).toThrow();
  });
});
