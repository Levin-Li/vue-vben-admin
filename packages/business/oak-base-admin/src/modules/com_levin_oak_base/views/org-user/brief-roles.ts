interface RoleAssignment {
  canAssign: boolean;
  created: boolean;
  id: string;
  previousRoles?: string[];
  roles?: string[];
  send: (id: string, roles: string[]) => Promise<unknown>;
}

/** 用户资料已保存后只处理角色；失败不能触发再次创建用户。 */
export async function assignBriefRolesAfterSave(input: RoleAssignment) {
  if (!input.roles) return undefined;
  const roles = [...new Set(input.roles.map(String))];
  const previous = [...new Set((input.previousRoles || []).map(String))];
  if (
    !input.created &&
    JSON.stringify(roles.toSorted()) === JSON.stringify(previous.toSorted())
  )
    return undefined;
  if (input.created && roles.length === 0) return undefined;
  if (!input.canAssign)
    return '用户资料已保存，角色权限已变化，请联系管理员完成分配';
  if (!input.id) return '用户资料已保存，未取得用户ID，请在列表中分配角色';
  try {
    await input.send(input.id, roles);
  } catch {
    return '用户资料已保存，角色未分配，请在列表中重试分配角色';
  }
  return undefined;
}
