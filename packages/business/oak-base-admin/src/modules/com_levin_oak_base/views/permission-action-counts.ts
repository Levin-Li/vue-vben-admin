export function countConfiguredItems(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item) => {
      if (typeof item === 'string') {
        return item.trim().length > 0;
      }

      return item !== null && item !== undefined;
    }).length;
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean).length;
  }

  return 0;
}

export function getDataPermissionCount(record: Record<string, any>) {
  const counts = getDataPermissionCounts(record);
  return counts.allow + counts.deny;
}

export function getDataPermissionCounts(record: Record<string, any>) {
  return {
    allow: ['tenantScopeList', 'domainScopeList', 'orgScopeList'].reduce(
      (count, field) => count + countConfiguredItems(record[field]),
      0,
    ),
    deny: [
      'deniedTenantScopeList',
      'deniedDomainScopeList',
      'deniedOrgScopeList',
    ].reduce((count, field) => count + countConfiguredItems(record[field]), 0),
  };
}

export function getDataPermissionBadgeItems(record: Record<string, any>) {
  const { allow, deny } = getDataPermissionCounts(record);
  return [
    { count: allow, label: '允许规则', tone: 'success' as const },
    { count: deny, label: '禁止规则', tone: 'danger' as const },
  ];
}

export function getUserDataPermissionBadgeItems(
  user: Record<string, any>,
  roles: Array<Record<string, any>>,
) {
  const codes = new Set(
    (Array.isArray(user.roleList) ? user.roleList : []).map(String),
  );
  const tenantId = user.tenantId && String(user.tenantId);
  const assignedRoles = roles.filter(
    (role) =>
      codes.has(String(role.code)) &&
      (!role.tenantId || String(role.tenantId) === tenantId),
  );
  const fields = [
    'tenantScopeList',
    'deniedTenantScopeList',
    'domainScopeList',
    'deniedDomainScopeList',
    'orgScopeList',
    'deniedOrgScopeList',
  ];
  const effective = { ...user };
  for (const field of fields) {
    if (user[field] !== null && user[field] !== undefined) continue;
    effective[field] = [
      ...new Set(
        assignedRoles.flatMap((role) =>
          Array.isArray(role[field]) ? role[field].map(String) : [],
        ),
      ),
    ];
  }
  const inherited = fields.some(
    (field) => user[field] === null || user[field] === undefined,
  );
  return getDataPermissionBadgeItems(effective).map((item) => ({
    ...item,
    label:
      inherited && assignedRoles.length > 0
        ? `${item.label}（含角色继承）`
        : item.label,
  }));
}

export function getResourcePermissionCount(record: Record<string, any>) {
  return countConfiguredItems(record.permissionList);
}

export function getResourcePermissionCounts(record: Record<string, any>) {
  const raw = record.permissionList;
  let expressions: string[] = [];
  if (Array.isArray(raw))
    expressions = raw
      .filter((item) => item !== null && item !== undefined)
      .map(String);
  else if (typeof raw === 'string') expressions = raw.split(/\r?\n|,/);
  const counts = { menu: 0, action: 0, field: 0 };
  for (const expression of expressions
    .map((item) => item.trim())
    .filter(Boolean)) {
    const [, type, , action] = expression.split(':');
    if (type === '系统数据-系统菜单' && action === '展示') counts.menu++;
    else if (['@value', 'DataAttrGroup', '属性组'].includes(type || ''))
      counts.field++;
    else counts.action++;
  }
  return counts;
}

export function getResourcePermissionBadgeItems(record: Record<string, any>) {
  const { menu, action, field } = getResourcePermissionCounts(record);
  return [
    { count: menu, label: '菜单权限', tone: 'menu' as const },
    { count: action, label: '操作权限', tone: 'action' as const },
    { count: field, label: '数据字段权限', tone: 'field' as const },
  ];
}
