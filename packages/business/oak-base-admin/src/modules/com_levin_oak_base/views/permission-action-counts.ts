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
  return countConfiguredItems(record.orgScopeList);
}

export function getResourcePermissionCount(record: Record<string, any>) {
  return countConfiguredItems(record.permissionList);
}
