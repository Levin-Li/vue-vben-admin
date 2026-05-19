function addRoleIdentityValue(values: Set<string>, role: unknown) {
  if (!role) {
    return;
  }

  if (typeof role === 'string') {
    values.add(role);
    return;
  }

  if (typeof role !== 'object') {
    return;
  }

  const roleRecord = role as Record<string, unknown>;

  for (const key of ['code', 'id', 'name', 'roleCode', 'value']) {
    const value = roleRecord[key];

    if (value !== undefined && value !== null && value !== '') {
      values.add(String(value));
    }
  }
}

function collectRoleIdentityValues(userInfo: Record<string, unknown>) {
  const values = new Set<string>();

  for (const role of Array.isArray(userInfo.roles) ? userInfo.roles : []) {
    addRoleIdentityValue(values, role);
  }

  for (const role of Array.isArray(userInfo.roleList)
    ? userInfo.roleList
    : []) {
    addRoleIdentityValue(values, role);
  }

  return values;
}

export function isSuperAdminUser(userInfo: unknown) {
  if (!userInfo || typeof userInfo !== 'object') {
    return false;
  }

  const userRecord = userInfo as Record<string, unknown>;
  const roleValues = collectRoleIdentityValues(userRecord);

  return (
    userRecord.superAdmin === true ||
    userRecord.isSuperAdmin === true ||
    userRecord.sa === true ||
    userRecord.loginName === 'sa' ||
    userRecord.username === 'sa' ||
    roleValues.has('R_SA')
  );
}
