import type {
  CrudExportTemplateConfig,
  CrudExportTemplateContext,
  CrudExportTemplateRecord,
} from './types';

import { isTopSuperAdminUser } from './user-identity';

export type CrudTemplateSaveScope = 'org' | 'personal' | 'platform' | 'tenant';

export function normalizeCrudTemplateList(
  result:
    | CrudExportTemplateRecord[]
    | undefined
    | { items?: CrudExportTemplateRecord[] },
) {
  if (!result) {
    return [];
  }

  return Array.isArray(result) ? result : result.items || [];
}

export function normalizeCrudTemplateConfig(
  value: CrudExportTemplateRecord['config'],
): CrudExportTemplateConfig {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) || {};
    } catch {
      return {};
    }
  }

  return value;
}

export function normalizeCreatedCrudTemplate(
  value: any,
): Partial<CrudExportTemplateRecord> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const nested =
    value.data || value.item || value.record || value.result || value.entity;

  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested;
  }

  return value;
}

export function getCrudTemplateValue(template: CrudExportTemplateRecord) {
  if (template.id !== undefined && template.id !== null) {
    return String(template.id);
  }

  const code = String(template.code || '').trim();

  return code || undefined;
}

export function isSameCrudTemplate(
  template: CrudExportTemplateRecord,
  target: CrudExportTemplateRecord,
) {
  const templateValue = getCrudTemplateValue(template);
  const targetValue = getCrudTemplateValue(target);

  if (templateValue && targetValue && templateValue === targetValue) {
    return true;
  }

  return Boolean(
    template.code &&
    target.code &&
    String(template.code) === String(target.code),
  );
}

export function dedupeCrudTemplates(templates: CrudExportTemplateRecord[]) {
  const seen = new Set<string>();
  const result: CrudExportTemplateRecord[] = [];

  for (const template of templates) {
    const key =
      getCrudTemplateValue(template) ||
      String(template.code || '').trim() ||
      `${template.targetType || ''}:${template.name}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(template);
  }

  return result;
}

export function removeCrudTemplateFromList(
  templates: CrudExportTemplateRecord[],
  template: CrudExportTemplateRecord,
) {
  return templates.filter((item) => !isSameCrudTemplate(item, template));
}

export function getCrudTemplateDeleteParams(
  template: CrudExportTemplateRecord,
) {
  const value = getCrudTemplateValue(template);

  return value ? { id: value } : { code: template.code };
}

export function buildCrudTemplateCode(
  prefix: string,
  context: CrudExportTemplateContext,
  name: string,
  extra = '',
) {
  const source = [context.targetType, extra, name, Date.now().toString()].join(
    ':',
  );
  let hash = 0;

  for (const char of source) {
    hash = (hash * 31 + (char.codePointAt(0) || 0)) >>> 0;
  }

  return `${prefix}-${Date.now().toString(36)}-${hash.toString(36)}`.slice(
    0,
    128,
  );
}

export function normalizeCrudTemplateOwnerValue(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();

  return text || null;
}

export function getCurrentCrudTemplateUserValue(
  userInfo: Record<string, any> | undefined,
  ...keys: string[]
) {
  const source = userInfo || {};

  for (const key of keys) {
    const value = normalizeCrudTemplateOwnerValue(source[key]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

export function getCurrentCrudTemplateOrgValue(
  userInfo: Record<string, any> | undefined,
) {
  const source = userInfo || {};
  const directValue = getCurrentCrudTemplateUserValue(
    source,
    'orgId',
    'organizationId',
    'deptId',
    'currentOrgId',
    'defaultOrgId',
  );

  if (directValue !== null) {
    return directValue;
  }

  const org = source.org || source.organization || source.dept;

  if (org && typeof org === 'object') {
    const orgRecord = org as Record<string, any>;

    return normalizeCrudTemplateOwnerValue(orgRecord.id ?? orgRecord.value);
  }

  return null;
}

export function collectCrudTemplateUserRoleValues(
  userInfo: Record<string, any> | undefined,
) {
  const source = userInfo || {};
  const values = new Set<string>();
  const addValue = (value: unknown) => {
    if (value !== undefined && value !== null && value !== '') {
      values.add(String(value));
    }
  };

  for (const role of [
    ...(Array.isArray(source.roles) ? source.roles : []),
    ...(Array.isArray(source.roleList) ? source.roleList : []),
  ]) {
    if (typeof role === 'string') {
      addValue(role);
    } else if (role && typeof role === 'object') {
      const roleRecord = role as Record<string, any>;

      for (const key of ['code', 'id', 'name', 'roleCode', 'value']) {
        addValue(roleRecord[key]);
      }
    }
  }

  return values;
}

function hasAnyCrudTemplateUserRole(
  userInfo: Record<string, any> | undefined,
  ...candidates: string[]
) {
  const roles = collectCrudTemplateUserRoleValues(userInfo);

  return candidates.some((candidate) => roles.has(candidate));
}

export function isCrudTemplateTenantAdmin(
  userInfo: Record<string, any> | undefined,
) {
  const source = userInfo || {};

  return (
    source.tenantAdmin === true ||
    source.isTenantAdmin === true ||
    hasAnyCrudTemplateUserRole(
      source,
      'TenantAdmin',
      'R_TENANT_ADMIN',
      'TENANT_ADMIN',
    )
  );
}

export function isCrudTemplateOrgAdmin(
  userInfo: Record<string, any> | undefined,
) {
  const source = userInfo || {};

  return (
    source.orgAdmin === true ||
    source.organizationAdmin === true ||
    source.isOrgAdmin === true ||
    hasAnyCrudTemplateUserRole(source, 'OrgAdmin', 'R_ORG_ADMIN', 'ORG_ADMIN')
  );
}

export function canDeleteCrudTemplateByOwnership(
  template: CrudExportTemplateRecord,
  userInfo: Record<string, any> | undefined,
) {
  if (template.editable === false) {
    return false;
  }

  if (isTopSuperAdminUser(userInfo)) {
    return true;
  }

  const ownerId = normalizeCrudTemplateOwnerValue(template.ownerId);
  const tenantId = normalizeCrudTemplateOwnerValue(template.tenantId);
  const orgId = normalizeCrudTemplateOwnerValue(template.orgId);
  const currentUserId = getCurrentCrudTemplateUserValue(
    userInfo,
    'userId',
    'id',
  );
  const currentTenantId = getCurrentCrudTemplateUserValue(userInfo, 'tenantId');
  const currentOrgId = getCurrentCrudTemplateOrgValue(userInfo);

  if (ownerId && ownerId === currentUserId) {
    return true;
  }

  if (!tenantId && !ownerId && template.tenantShared && template.orgShared) {
    return false;
  }

  if (
    tenantId &&
    tenantId === currentTenantId &&
    isCrudTemplateTenantAdmin(userInfo)
  ) {
    return true;
  }

  if (orgId && orgId === currentOrgId && isCrudTemplateOrgAdmin(userInfo)) {
    return true;
  }

  return false;
}

export function canShowCrudTemplateDelete(options: {
  hasDeletePermission: boolean;
  template: CrudExportTemplateRecord;
  userInfo?: Record<string, any>;
}) {
  return (
    options.hasDeletePermission &&
    canDeleteCrudTemplateByOwnership(options.template, options.userInfo)
  );
}

export function buildCrudTemplateScopePayload(
  scope: CrudTemplateSaveScope,
  userInfo: Record<string, any> | undefined,
) {
  const tenantId = getCurrentCrudTemplateUserValue(userInfo, 'tenantId');
  const orgId = getCurrentCrudTemplateOrgValue(userInfo);
  const ownerId = getCurrentCrudTemplateUserValue(userInfo, 'userId', 'id');

  if (scope === 'platform') {
    return {
      orgId: null,
      orgShared: true,
      ownerId: null,
      tenantId: null,
      tenantShared: true,
    };
  }

  if (scope === 'tenant') {
    return {
      orgId: null,
      orgShared: true,
      ownerId: null,
      tenantId,
      tenantShared: false,
    };
  }

  if (scope === 'org') {
    return {
      orgId,
      orgShared: false,
      ownerId: null,
      tenantId,
      tenantShared: false,
    };
  }

  return {
    orgId,
    orgShared: false,
    ownerId,
    tenantId,
    tenantShared: false,
  };
}
