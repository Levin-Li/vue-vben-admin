import type {
  OrgScopeDraft,
  OrgScopeItem,
  OrgTreeNode,
  PermissionTreeNode,
  RbacModuleNode,
} from './data-permission-types';

import { RbacPermissionMatchUtils } from '../rbac-permission-match';

interface ToggleOrgInput {
  id: string;
  title?: string;
}

export const DEFAULT_TENANT_MATCHING_EXPRESSION = '_DEFAULT_TENANT_';
export const ALL_TENANT_MATCHING_EXPRESSION = '*';
export const TENANT_GROOVY_EXPRESSION_PREFIX = '#!groovy:';
export const DEFAULT_ORG_SCOPE_EXPRESSION_TYPE = 'IdPath';
export const ALL_ROOT_ORG_ID = '/*';
export const USER_DEFAULT_ORG_ID = '_USER_ORG_';

const SCOPE_EXPRESSIONS: Record<string, string> = {
  All: '/**',
  OnlyDirectChild: '/*/',
  OnlySelf: '/',
  SelfAndDirectChild: '/*',
};

export function normalizeOrgScopeExpressionType(value?: string) {
  return String(value || '').trim() || DEFAULT_ORG_SCOPE_EXPRESSION_TYPE;
}

export function normalizeOrgScopeId(value?: string) {
  return String(value || '').trim();
}

export function getTenantMatchingExpressionLabel(value?: null | string) {
  const nextValue = normalizeTenantMatchingExpression(value).trim();

  if (!nextValue) {
    return '无租户';
  }

  if (nextValue === DEFAULT_TENANT_MATCHING_EXPRESSION) {
    return '默认租户';
  }

  if (nextValue === ALL_TENANT_MATCHING_EXPRESSION) {
    return '所有租户';
  }

  if (nextValue.startsWith(TENANT_GROOVY_EXPRESSION_PREFIX)) {
    return `Groovy：${nextValue.slice(TENANT_GROOVY_EXPRESSION_PREFIX.length) || '未填写脚本'}`;
  }

  return nextValue;
}

export function getScopeKeyByExpression(expression?: string) {
  return (
    Object.entries(SCOPE_EXPRESSIONS).find(
      ([, scopeExpression]) => scopeExpression === expression,
    )?.[0] || 'Custom'
  );
}

export function normalizeScopeKey(templateKey?: string) {
  return templateKey || 'Custom';
}

export function toggleOrgScopeDraft(
  drafts: OrgScopeDraft[],
  org: ToggleOrgInput,
): OrgScopeDraft[] {
  const orgId = normalizeOrgScopeId(org.id);
  const exists = drafts.some((item) => item.orgId === orgId);

  if (exists) {
    return drafts.filter((item) => item.orgId !== orgId);
  }

  return [
    ...drafts,
    {
      isAllow: true,
      mode: 'template' as const,
      orgId,
      orgName: org.title,
      orgScopeMatchingMode: 'All',
      orgScopeExpression: '',
      orgScopeExpressionType: '',
      templateKey: 'All' as const,
      tenantMatchingExpression: DEFAULT_TENANT_MATCHING_EXPRESSION,
    },
  ];
}

export function mergeUnmappedPermissions(
  selected: string[],
  unmapped: string[],
) {
  return [...new Set([...selected, ...unmapped].filter(Boolean))];
}

export function removePermissionValue(
  permissions: string[],
  permissionToRemove: string,
) {
  return permissions.filter((item) => item !== permissionToRemove);
}

export function collectPermissionValues(checkedPermissions: string[]) {
  return [...new Set(checkedPermissions.filter(Boolean))];
}

const ORG_SCOPE_MODES = new Set([
  'All',
  'Custom',
  'OnlyDirectChild',
  'OnlySelf',
  'SelfAndDirectChild',
]);

/** 未传字段才采用模型默认值；显式null与空字符串均表示无租户。 */
export function normalizeTenantMatchingExpression(value?: null | string) {
  return value === undefined
    ? DEFAULT_TENANT_MATCHING_EXPRESSION
    : (value ?? '');
}

export function normalizeOrgScopeMatchingMode(value?: null | string) {
  return String(value ?? '').trim();
}

/** 预设模式不需要表达式；自定义规则必须显式提供类型和内容。 */
export function isOrgScopeValid(item: OrgScopeItem) {
  const mode = normalizeOrgScopeMatchingMode(item.orgScopeMatchingMode);
  return (
    Boolean(item.orgId?.trim()) &&
    ORG_SCOPE_MODES.has(mode) &&
    (mode !== 'Custom' ||
      Boolean(
        item.orgScopeExpressionType?.trim() && item.orgScopeExpression?.trim(),
      ))
  );
}

export function buildOrgScopeDraftsFromValue(
  value: OrgScopeItem[],
): OrgScopeDraft[] {
  return value.map((item) => {
    const matchingMode = normalizeOrgScopeMatchingMode(
      item.orgScopeMatchingMode,
    );
    return {
      ...item,
      orgId: normalizeOrgScopeId(item.orgId),
      orgScopeMatchingMode: matchingMode,
      orgScopeExpression: item.orgScopeExpression ?? '',
      orgScopeExpressionType: item.orgScopeExpressionType ?? '',
      tenantMatchingExpression: normalizeTenantMatchingExpression(
        item.tenantMatchingExpression,
      ),
      mode: matchingMode === 'Custom' ? 'advanced' : 'template',
      templateKey: matchingMode,
    };
  });
}

/** 只发送后端字段，不把模板键等编辑草稿属性当作权限定义。 */
export function serializeOrgScopes(
  value: OrgScopeItem[],
  isSuperAdmin: boolean,
) {
  return value.map((item) => {
    if (!isOrgScopeValid(item))
      throw new Error('请先完善组织范围的匹配模式及自定义表达式');
    const mode = normalizeOrgScopeMatchingMode(item.orgScopeMatchingMode);
    if (mode === 'Custom' && !isSuperAdmin)
      throw new Error('自定义组织范围只能由超级管理员保存');
    return {
      isAllow: item.isAllow,
      orgId: normalizeOrgScopeId(item.orgId),
      orgScopeMatchingMode: mode,
      orgScopeExpression: item.orgScopeExpression ?? '',
      orgScopeExpressionType:
        mode === 'Custom' ? item.orgScopeExpressionType : null,
      tenantMatchingExpression: normalizeTenantMatchingExpression(
        item.tenantMatchingExpression,
      ),
    };
  });
}

export function flattenOrgTree(
  nodes: OrgTreeNode[],
  depth = 0,
): Array<OrgTreeNode & { depth: number; title: string }> {
  return nodes.flatMap((node) => {
    const title = node.name || node.title || node.id;

    return [
      {
        ...node,
        depth,
        title,
      },
      ...flattenOrgTree(node.children || [], depth + 1),
    ];
  });
}

export function buildTemplateExpression(templateKey: string, _orgId: string) {
  return SCOPE_EXPRESSIONS[normalizeScopeKey(templateKey)] || '';
}

export function collectKnownPermissionValues(modules: RbacModuleNode[]) {
  const values = new Set<string>();

  for (const moduleItem of modules) {
    for (const typeItem of moduleItem.typeList || []) {
      for (const resourceItem of typeItem.resList || []) {
        for (const actionItem of resourceItem.actionList || []) {
          if (actionItem.permissionExpr) {
            values.add(actionItem.permissionExpr);
          }
        }
      }
    }
  }

  return values;
}

export function collectKnownPermissionTreeValues(nodes: PermissionTreeNode[]) {
  const values = new Set<string>();

  for (const node of nodes) {
    if (node.permissionExpr) {
      values.add(node.permissionExpr);
    }

    for (const childValue of collectKnownPermissionTreeValues([
      ...(node.children || []),
      ...(node.resourcePermissions || []),
    ])) {
      values.add(childValue);
    }
  }

  return values;
}

export function splitMappedAndUnmappedPermissions(
  value: string[],
  modules: RbacModuleNode[],
  permissionTree: PermissionTreeNode[] = [],
) {
  const treeValues = collectKnownPermissionTreeValues(permissionTree);
  const knownValues =
    treeValues.size > 0 ? treeValues : collectKnownPermissionValues(modules);
  const mapped = [...knownValues].filter((permissionExpr) =>
    RbacPermissionMatchUtils.simpleMatchList(permissionExpr, value),
  );
  const unmapped: string[] = [];

  for (const permission of value) {
    const matchedKnownPermission = [...knownValues].some((permissionExpr) =>
      RbacPermissionMatchUtils.simpleMatchList(permissionExpr, [permission]),
    );

    if (!matchedKnownPermission) {
      unmapped.push(permission);
    }
  }

  return {
    mapped,
    unmapped,
  };
}
