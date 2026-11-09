import type { CrudFieldConfig } from './types';

/** 输入必须是场景和显隐过滤后的字段；不读取分组折叠状态。 */
export function resolveCrudQuickFill(
  fields: CrudFieldConfig[],
  writableKeys: ReadonlySet<string>,
  _complexMappedKeys: ReadonlySet<string> = new Set(),
  prerequisiteKeys: ReadonlySet<string> = new Set(),
) {
  const writable = fields.filter((field) => writableKeys.has(field.key));
  const required = writable.filter(
    (field) => field.required === true || prerequisiteKeys.has(field.key),
  );
  const requiredKeys = new Set(required.map((field) => field.key));
  const eligible = required.length > 0;
  const remaining = fields.filter((field) => !requiredKeys.has(field.key));
  return {
    eligible,
    requiredKeys,
    orderedFields: eligible ? [...required, ...remaining] : fields,
    firstOptionalKey: eligible ? remaining[0]?.key : undefined,
  };
}
