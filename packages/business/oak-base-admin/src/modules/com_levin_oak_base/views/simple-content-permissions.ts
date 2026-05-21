export function normalizePermissionValues(value: any) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getRequireAuthorizationCount(record: Record<string, any>) {
  return normalizePermissionValues(record.requireAuthorizations).length;
}
