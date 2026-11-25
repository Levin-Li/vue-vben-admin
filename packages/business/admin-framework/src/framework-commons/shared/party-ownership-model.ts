import type { PartyOwnershipChange, PartyOwnershipGroup } from './party-ownership-types';

/** 前端只依据当前授权展示；提交仍由服务端重新校验。 */
export function visiblePartyGroups(groups: PartyOwnershipGroup[]): PartyOwnershipGroup[] {
  return groups.filter((group) => group.canReadOrg || group.canReadUser || group.canWriteOrg || group.canWriteUser);
}

export function partyOperation(group: PartyOwnershipGroup): 'adjust' | 'bind' | null {
  if (!group.canWriteOrg && !group.canWriteUser) return null;
  if (group.bound) return group.canAdjust ? 'adjust' : null;
  return group.canBind ? 'bind' : null;
}

export function buildPartyChange(group: PartyOwnershipGroup, orgId?: null | string, userId?: null | string): PartyOwnershipChange {
  const operation = partyOperation(group);
  if (!operation) throw new Error('没有归属操作权限');
  const orgChanged = (orgId || null) !== (group.orgId || null);
  const userChanged = (userId || null) !== (group.userId || null);
  if (!orgChanged && !userChanged) throw new Error('归属没有变化');
  if (orgChanged && !group.canWriteOrg) throw new Error('没有组织字段权限');
  if (userChanged && !group.canWriteUser) throw new Error('没有人员字段权限');
  if (orgChanged && userId && !userChanged) throw new Error('请先清除人员再修改组织');
  if (operation === 'bind' && !orgId && !userId) throw new Error('请选择组织或人员');
  return { group: group.key, operation, orgField: group.orgField, userField: group.userField,
    orgChanged, userChanged, ...(orgChanged ? { orgId: orgId || null } : {}),
    ...(userChanged ? { userId: userId || null } : {}) };
}

/** 将实体声明、服务端绑定状态和当前用户授权组合成可展示的数据。 */
export function authorizePartyGroups(
  descriptors: import('./party-ownership-types').PartyOwnershipDescriptor[],
  record: Record<string, unknown>,
  boundStates: Record<string, boolean>,
  access: import('./party-ownership-types').PartyOwnershipAccess,
): PartyOwnershipGroup[] {
  return descriptors.flatMap((descriptor) => {
    // 不接受未知状态作为“尚未绑定”，避免受遮盖的既有归属被误判为可首次绑定。
    if (typeof boundStates[descriptor.key] !== 'boolean') return [];
    const bound = boundStates[descriptor.key]!;
    const action = bound ? 'adjust' : 'bind';
    const canReadOrg = access.canRead(descriptor.orgField);
    const canReadUser = access.canRead(descriptor.userField);
    const canWriteOrg = access.canWrite(action, descriptor.orgField);
    const canWriteUser = access.canWrite(action, descriptor.userField);
    if (!canReadOrg && !canReadUser && !canWriteOrg && !canWriteUser) return [];
    const orgId = canReadOrg && typeof record[descriptor.orgField] === 'string'
      ? record[descriptor.orgField] as string : undefined;
    const userId = canReadUser && typeof record[descriptor.userField] === 'string'
      ? record[descriptor.userField] as string : undefined;
    return [{ ...descriptor, bound, orgId, userId, canReadOrg, canReadUser, canWriteOrg, canWriteUser,
      canBind: access.canOperate('bind'), canAdjust: access.canOperate('adjust') }];
  });
}
