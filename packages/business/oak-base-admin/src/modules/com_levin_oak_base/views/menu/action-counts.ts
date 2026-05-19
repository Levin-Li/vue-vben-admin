import type { MenuRecord } from './types';

export function getRequireAuthorizationCount(row: MenuRecord) {
  return (row.requireAuthorizations || []).filter((item) =>
    String(item || '').trim(),
  ).length;
}

export function getOpButtonCount(row: MenuRecord) {
  return (row.opButtonList || []).filter(
    (item) =>
      item.label?.trim() ||
      item.name?.trim() ||
      item.apiUrl?.trim() ||
      item.requireAuthorization?.trim() ||
      item.remark?.trim(),
  ).length;
}
