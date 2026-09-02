export const TABLE_COLUMN_PREFERENCE_VERSION = 3;

export interface TableColumnPreference {
  hiddenKeys: string[];
  version: number;
}

export function getTableColumnPreferenceStorageKey(
  routeKey: string,
  listTableName?: string,
) {
  const normalizedTableName = String(listTableName || '').trim();
  const pageKey = normalizedTableName
    ? `${routeKey}:${normalizedTableName}`
    : routeKey;

  return `vben:crud-table-columns:${pageKey}`;
}

export function buildTableColumnPreference(hiddenKeys: string[]) {
  return {
    hiddenKeys: [...hiddenKeys],
    version: TABLE_COLUMN_PREFERENCE_VERSION,
  } satisfies TableColumnPreference;
}

export function readTableColumnPreference(
  rawValue: null | string,
  availableKeys: Iterable<string>,
) {
  if (!rawValue) {
    return { hasStoredPreference: false, hiddenKeys: [], invalid: false };
  }

  try {
    const preference = JSON.parse(rawValue) as Partial<TableColumnPreference>;
    const availableKeySet = new Set(availableKeys);

    return {
      hasStoredPreference: true,
      hiddenKeys: (preference.hiddenKeys || [])
        .map(String)
        .filter((key) => availableKeySet.has(key)),
      invalid: false,
    };
  } catch {
    return { hasStoredPreference: false, hiddenKeys: [], invalid: true };
  }
}
