import type { CrudFieldConfig } from './types';

/** 简要字段由页面声明，仍需包含当前有效的全部必填字段。 */
export function resolveCrudBriefFill(
  fields: CrudFieldConfig[],
  requestedKeys: readonly string[],
  requiredKeys: readonly string[] = [],
) {
  const requested = new Set(requestedKeys);
  const selected = fields.filter(
    (field) => requested.has(field.key) || field.required === true,
  );
  const selectedKeys = new Set(selected.map((field) => field.key));
  const remaining = fields.filter((field) => !selectedKeys.has(field.key));
  return {
    eligible:
      requestedKeys.some((key) => selectedKeys.has(key)) &&
      requiredKeys.every((key) => selectedKeys.has(key)),
    firstOptionalKey: remaining[0]?.key,
    orderedFields: [...selected, ...remaining],
    selectedKeys,
  };
}
