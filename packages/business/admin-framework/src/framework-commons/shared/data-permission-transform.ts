import type {
  OrgScopeDraft,
  OrgScopeItem,
  OrgTreeNode,
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

const LEGACY_EXPRESSION_TYPE_MAP: Record<string, string> = {
  IdAntPath: 'IdPath',
  NameAntPath: 'NamePath',
};

const SCOPE_EXPRESSIONS: Record<string, string> = {
  All: '/**',
  OnlyDirectChild: '/*/',
  OnlySelf: '/',
  SelfAndDirectChild: '/*',
};

export function normalizeOrgScopeExpressionType(value?: string) {
  const nextValue = String(value || '').trim();
  return (
    LEGACY_EXPRESSION_TYPE_MAP[nextValue] ||
    nextValue ||
    DEFAULT_ORG_SCOPE_EXPRESSION_TYPE
  );
}

export function normalizeOrgScopeId(value?: string) {
  const nextValue = String(value || '').trim();

  if (
    nextValue === '*' ||
    nextValue === '_ALL_ORG_' ||
    nextValue === '_ALL_ROOT_ORG_' ||
    nextValue === ALL_ROOT_ORG_ID
  ) {
    return ALL_ROOT_ORG_ID;
  }

  return nextValue;
}

export function getTenantMatchingExpressionLabel(value?: string) {
  const nextValue = String(value ?? DEFAULT_TENANT_MATCHING_EXPRESSION).trim();

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
  if (templateKey === 'current-only') {
    return 'OnlySelf';
  }

  if (templateKey === 'direct-children') {
    return 'OnlyDirectChild';
  }

  if (templateKey === 'self-and-direct-children') {
    return 'SelfAndDirectChild';
  }

  if (templateKey === 'current-and-children') {
    return 'All';
  }

  if (templateKey === 'custom') {
    return 'Custom';
  }

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
      orgScopeExpression: '/**',
      orgScopeExpressionType: DEFAULT_ORG_SCOPE_EXPRESSION_TYPE,
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

export function buildOrgScopeDraftsFromValue(value: OrgScopeItem[]) {
  return value.map((item) => {
    const orgScopeExpressionType = normalizeOrgScopeExpressionType(
      item.orgScopeExpressionType || item.expressionType,
    );
    const templateKey = getScopeKeyByExpression(item.orgScopeExpression);

    return {
      ...item,
      orgId: normalizeOrgScopeId(item.orgId),
      orgScopeExpressionType,
      tenantMatchingExpression:
        item.tenantMatchingExpression ||
        item.tenantExpression ||
        DEFAULT_TENANT_MATCHING_EXPRESSION,
      mode:
        templateKey === 'Custom'
          ? ('advanced' as const)
          : ('template' as const),
      templateKey,
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

export function splitMappedAndUnmappedPermissions(
  value: string[],
  modules: RbacModuleNode[],
) {
  const knownValues = collectKnownPermissionValues(modules);
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
