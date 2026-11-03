export interface UserTenantOrgNode {
  children?: UserTenantOrgNode[];
  key: string;
  label: string;
  tenantId?: string;
  virtual?: boolean;
}

/** 租户切换后不沿用旧组织，避免提交跨租户的组织归属。 */
export function changeUserTenant(
  formState: Record<string, any>,
  tenantId: string,
) {
  if (formState.tenantId === tenantId) return;
  formState.tenantId = tenantId;
  formState.orgId = undefined;
}

/** 页面只列出当前授权树中归属目标租户的真实组织。 */
export function tenantOrgChoices(
  nodes: UserTenantOrgNode[],
  tenantId: string,
  inheritedTenantId = '',
): UserTenantOrgNode[] {
  const result: UserTenantOrgNode[] = [];
  for (const node of nodes) {
    const nodeTenantId = node.tenantId || inheritedTenantId;
    if (node.virtual) {
      result.push(
        ...tenantOrgChoices(node.children || [], tenantId, nodeTenantId),
      );
      continue;
    }
    if (nodeTenantId !== tenantId) continue;
    result.push({
      ...node,
      children: tenantOrgChoices(node.children || [], tenantId, nodeTenantId),
    });
  }
  return result;
}

/** 表单提交前复核组织与所选租户；服务端仍需独立授权。 */
export function assertUserTenantOrg(
  nodes: UserTenantOrgNode[],
  tenantId: string,
  orgId: string,
) {
  if (!tenantId || !orgId) throw new Error('请选择归属租户和所属组织');
  const choices = tenantOrgChoices(nodes, tenantId);
  const visit = (items: UserTenantOrgNode[]): boolean =>
    items.some((item) => item.key === orgId || visit(item.children || []));
  if (!visit(choices))
    throw new Error('所属组织不属于所选租户或不在当前授权范围');
}
