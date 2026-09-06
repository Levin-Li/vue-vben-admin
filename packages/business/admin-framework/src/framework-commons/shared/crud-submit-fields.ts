import type { CrudComplexGroupConfig, CrudFieldConfig } from './types';

import { applyAreaCascaderValueToRecord } from './area-cascader';

/** 最终载荷再次排除不参与字段，防止默认值、复杂映射或页面转换器补回。 */
export function omitExcludedCrudFields(
  payload: Record<string, any>,
  fields: CrudFieldConfig[],
  groups: CrudComplexGroupConfig[] = [],
  protectedKeys: string[] = [],
) {
  const excluded = new Set<string>();
  const complexParents = new Set<string>();
  for (const field of fields) {
    excluded.add(field.key);
    const group = groups.find((item) => item.key === field.complexGroupKey);
    const nestedKey = group?.fieldMappings[field.key];
    if (group && nestedKey) {
      complexParents.add(group.submitKey);
      excluded.add(`${group.submitKey}.${nestedKey}`);
    }
    if (field.type === 'area-cascader') {
      const mapped = nestedKey
        ? {
            ...field,
            areaCascader: { ...field.areaCascader, valueKey: nestedKey },
          }
        : field;
      for (const key of Object.keys(
        applyAreaCascaderValueToRecord({}, mapped, [], [], true),
      )) {
        excluded.add(group ? `${group.submitKey}.${key}` : key);
      }
    }
  }
  const excludedFieldKeys = new Set(fields.map((field) => field.key));
  for (const group of groups) {
    const keys = Object.keys(group.fieldMappings);
    if (keys.length > 0 && keys.every((key) => excludedFieldKeys.has(key)))
      excluded.add(group.submitKey);
  }
  for (const key of protectedKeys) excluded.delete(key);
  const result = { ...payload };
  function removePath(record: Record<string, any>, path: string) {
    Reflect.deleteProperty(record, path);
    const [head, ...tail] = path.split('.');
    if (
      !head ||
      tail.length === 0 ||
      !record[head] ||
      typeof record[head] !== 'object'
    )
      return;
    record[head] = Array.isArray(record[head])
      ? [...record[head]]
      : { ...record[head] };
    removePath(record[head], tail.join('.'));
  }
  for (const key of excluded) removePath(result, key);
  for (const parent of complexParents) {
    if (result[parent] && Object.keys(result[parent]).length === 0)
      Reflect.deleteProperty(result, parent);
  }
  if (Array.isArray(result.forceUpdateFields)) {
    result.forceUpdateFields = result.forceUpdateFields.filter(
      (key: string) =>
        ![...excluded].some(
          (path) => key === path || key.startsWith(`${path}.`),
        ) &&
        (!complexParents.has(key) || Object.hasOwn(result, key)),
    );
  }
  return result;
}
