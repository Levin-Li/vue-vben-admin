import type { CrudFieldConfig } from './types';

/** 输入必须是场景和显隐过滤后的字段；不读取分组折叠状态。 */
export function resolveCrudQuickFill(
  fields: CrudFieldConfig[],
  writableKeys: ReadonlySet<string>,
  complexMappedKeys: ReadonlySet<string> = new Set(),
) {
  const writable = fields.filter((field) => writableKeys.has(field.key));
  const required = writable.filter((field) => field.required === true);
  const requiredKeys = new Set(required.map((field) => field.key));
  const hasComplex = fields.some(
    (field) =>
      field.complexValue === true ||
      Boolean(field.complexGroupKey) ||
      field.type === 'json' ||
      complexMappedKeys.has(field.key),
  );
  const eligible =
    !hasComplex &&
    writable.length > 7 &&
    required.length > 0 &&
    required.length <= 4;
  const remaining = fields.filter((field) => !requiredKeys.has(field.key));
  return {
    eligible,
    requiredKeys,
    orderedFields: eligible ? [...required, ...remaining] : fields,
    firstOptionalKey: eligible ? remaining[0]?.key : undefined,
  };
}
