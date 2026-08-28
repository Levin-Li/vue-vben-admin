import type { CrudComplexGroupConfig } from './types';

type CrudRecord = Record<string, any>;

function getRecordValue(record: CrudRecord | undefined, path: string) {
  return path.split('.').reduce<any>((value, key) => value?.[key], record);
}

export function buildCrudComplexGroupInitialState(
  groups: CrudComplexGroupConfig[] | undefined,
  record?: CrudRecord,
) {
  const collapsed: Record<string, boolean> = {};
  const enabled: Record<string, boolean> = {};
  const flatValues: CrudRecord = {};

  for (const group of groups || []) {
    const value = getRecordValue(record, group.submitKey);
    const hasValue = value !== null && value !== undefined;

    enabled[group.key] = hasValue;
    collapsed[group.key] = !hasValue;

    for (const [flatKey, nestedKey] of Object.entries(group.fieldMappings)) {
      flatValues[flatKey] = value?.[nestedKey];
    }
  }

  return { collapsed, enabled, flatValues };
}

export function buildCrudComplexGroupPayload(
  groups: CrudComplexGroupConfig[] | undefined,
  enabled: Record<string, boolean>,
  formState: CrudRecord,
) {
  const payload: CrudRecord = {};

  for (const group of groups || []) {
    if (!enabled[group.key]) {
      continue;
    }

    payload[group.submitKey] = Object.fromEntries(
      Object.entries(group.fieldMappings).map(([flatKey, nestedKey]) => [
        nestedKey,
        formState[flatKey],
      ]),
    );
  }

  return payload;
}
