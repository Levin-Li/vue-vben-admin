import type { RequestOptions } from '@levin/admin-framework';

export interface UserPageOrgScope {
  orgId: string;
  tenantId: string;
}

/** 单选范围通过标准orgIdList表达；服务端仍逐项校验组织归属与访问权。 */
export function withUserPageScope(
  options: RequestOptions,
  scope: undefined | UserPageOrgScope,
  actor: Record<string, unknown>,
): RequestOptions {
  if (!scope) return options;
  if (!scope.orgId || !scope.tenantId)
    throw new Error('用户管理：请选择携带租户归属的授权组织。');
  const platform = [
    'platformUser',
    'isPlatformUser',
    'platformAdmin',
    'isPlatformAdmin',
    'superAdmin',
    'isSuperAdmin',
  ].some((key) => actor[key] === true);
  if (!platform && actor.tenantId !== scope.tenantId)
    throw new Error('用户管理：所选组织不属于当前会话租户。');
  // 不使用会被公共传输清理的上下文Header；只提交已选择的一个组织，不扩为全部授权组织。
  const range = {
    orgIdList: [scope.orgId],
    ...(platform ? { tenantId: scope.tenantId } : {}),
  };
  const bind = (values: Record<string, unknown> = {}) => {
    const { tenantId, ...rest } = values;
    if (
      tenantId !== null &&
      tenantId !== undefined &&
      tenantId !== scope.tenantId
    )
      throw new Error('用户管理：请求租户与所选组织不一致。');
    return { ...rest, ...range };
  };
  const result: RequestOptions = { ...options, params: bind(options.params) };
  if (
    options.data &&
    typeof options.data === 'object' &&
    !Array.isArray(options.data)
  ) {
    result.data = bind(options.data);
    if (options.path === 'create' && !result.data.orgId)
      result.data.orgId = scope.orgId;
  }
  return result;
}
