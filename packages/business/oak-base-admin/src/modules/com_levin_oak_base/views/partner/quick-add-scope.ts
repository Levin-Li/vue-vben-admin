export interface QuickAddScope {
  parentOrgId: string;
  tenantId: string;
}

export interface QuickAddOrgChoice {
  tenantId?: string;
  value: string;
}

// 切换租户时撤销旧组织归属，避免把其它租户的组织随表单提交。
export function changeQuickAddTenant(scope: QuickAddScope, tenantId: string) {
  if (scope.tenantId === tenantId) return false;
  scope.tenantId = tenantId;
  scope.parentOrgId = '';
  return true;
}

// 提交前核对选中项仍属于当前租户；服务端仍需独立鉴权。
export function matchesQuickAddOrg(
  scope: QuickAddScope,
  selectedOrg?: QuickAddOrgChoice,
) {
  return (
    Boolean(scope.tenantId && scope.parentOrgId) &&
    selectedOrg?.tenantId === scope.tenantId &&
    selectedOrg.value === scope.parentOrgId
  );
}
