import type { WorkflowBusinessType } from '@levin/bpm-designer';

/** 业务实体与专用契约的显式别名；其它资源只接受目录里的同名契约。 */
const aliases: Record<string, string> = {
  EContract: 'electronic-contract',
  User: 'user-state',
  WorkflowExpense: 'workflow-expense',
};

export function workflowCrudContracts(
  apiBase: string,
  catalog: WorkflowBusinessType[],
) {
  const resource = /^\/?([A-Z][A-Za-z0-9]*)\/?$/.exec(apiBase)?.[1];
  // 申请样例已有完整的专用流程面板，不能再叠加第二个入口。
  if (!resource || resource === 'WorkflowRequest') return [];
  const type = aliases[resource] || resource;
  return catalog
    .filter((entry) => entry.businessType === type)
    .toSorted((left, right) =>
      String(right.contractVersion).localeCompare(
        String(left.contractVersion),
        undefined,
        { numeric: true },
      ),
    );
}

/** 引用只取当前行主键与归属；普通用户可补本人租户，平台用户必须使用行上的租户。 */
export function workflowCrudReference(
  record: Record<string, unknown>,
  identityField: string,
  businessType: string,
  actor: Record<string, unknown>,
) {
  const businessId = record[identityField];
  const platform = [
    'platformUser',
    'isPlatformUser',
    'platformAdmin',
    'isPlatformAdmin',
    'superAdmin',
    'isSuperAdmin',
  ].some((key) => actor[key] === true);
  const tenantId = record.tenantId || (!platform && actor.tenantId);
  const orgId = record.orgId;
  if (
    typeof businessId !== 'string' ||
    !businessId.trim() ||
    typeof tenantId !== 'string' ||
    !tenantId.trim() ||
    typeof orgId !== 'string' ||
    !orgId.trim()
  )
    return undefined;
  if (!platform && actor.tenantId !== tenantId) return undefined;
  return { businessId, businessType, tenantId, orgId };
}
