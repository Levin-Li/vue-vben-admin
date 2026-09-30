import type { CrudComplexGroupConfig } from './types';

type CrudRecord = Record<string, any>;

function getRecordValue(record: CrudRecord | undefined, path: string) {
  let value: any = record;
  for (const key of path.split('.')) value = value?.[key];
  return value;
}

function setRecordValue(record: CrudRecord, path: string, value: any) {
  const segments = path.split('.');
  if (
    segments.some(
      (segment) =>
        !segment || ['__proto__', 'constructor', 'prototype'].includes(segment),
    )
  ) {
    throw new Error(`无效的复杂对象属性路径：${path}`);
  }
  const leaf = segments.at(-1);
  if (!leaf) throw new Error(`无效的复杂对象属性路径：${path}`);
  let target = record;
  for (const segment of segments.slice(0, -1)) {
    const current = target[segment];
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      target[segment] = {};
    }
    target = target[segment];
  }
  target[leaf] = value;
}

/** 子对象只有在自身和所有祖先对象均已勾选时才参与校验与提交。 */
export function isCrudComplexGroupEnabled(
  key: string,
  groups: CrudComplexGroupConfig[] | undefined,
  enabled: Record<string, boolean>,
) {
  const byKey = new Map((groups || []).map((group) => [group.key, group]));
  const visited = new Set<string>();
  let current: string | undefined = key;
  while (current && !visited.has(current)) {
    if (!enabled[current]) return false;
    visited.add(current);
    current = byKey.get(current)?.parentKey;
  }
  return current === undefined;
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
    enabled[group.key] = true;
    collapsed[group.key] = false;

    for (const [flatKey, nestedKey] of Object.entries(group.fieldMappings)) {
      flatValues[flatKey] = getRecordValue(value, nestedKey);
    }
  }

  return { collapsed, enabled, flatValues };
}

/** 列表展示按声明的响应对象路径读取子字段，不假定接口返回同名顶层属性。 */
export function getCrudComplexGroupFieldValue(
  record: CrudRecord,
  flatKey: string,
  groupKey: string | undefined,
  groups: CrudComplexGroupConfig[] | undefined,
) {
  const group = groups?.find((item) => item.key === groupKey);
  const nestedKey = group?.fieldMappings[flatKey];
  return group && nestedKey
    ? getRecordValue(record, `${group.submitKey}.${nestedKey}`)
    : undefined;
}

export function buildCrudComplexGroupPayload(
  groups: CrudComplexGroupConfig[] | undefined,
  enabled: Record<string, boolean>,
  formState: CrudRecord,
) {
  const payload: CrudRecord = {};

  // 先构造祖先，再构造子对象；被取消的子对象写入 null，后代不再重建。
  const ordered = (groups || []).toSorted(
    (left, right) =>
      left.submitKey.split('.').length - right.submitKey.split('.').length,
  );
  for (const group of ordered) {
    if (
      group.parentKey &&
      !isCrudComplexGroupEnabled(group.parentKey, groups, enabled)
    ) {
      continue;
    }
    if (!enabled[group.key]) {
      if (group.parentKey) setRecordValue(payload, group.submitKey, null);
      continue;
    }

    const value: CrudRecord = {};
    for (const [flatKey, nestedKey] of Object.entries(group.fieldMappings)) {
      setRecordValue(value, nestedKey, formState[flatKey]);
    }
    setRecordValue(payload, group.submitKey, value);
  }

  return payload;
}
