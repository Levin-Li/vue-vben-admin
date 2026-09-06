import type {
  CrudFieldConfig,
  CrudPageDisplayQueryCollapsedRows,
} from './types';

/** 只使用当前可见字段的显式分组及校验声明，不推断业务语义。 */
export function resolveCrudFormGroupCollapse(
  fields: CrudFieldConfig[],
  complexEnabled: Record<string, boolean>,
  initial: {
    collapsed?: Record<string, boolean>;
    rows?: Record<string, CrudPageDisplayQueryCollapsedRows>;
  } = {},
) {
  const groups = new Map<
    string,
    { complex: boolean; key: string; required: boolean }
  >();
  for (const field of fields) {
    const complex = Boolean(field.complexGroupKey);
    const key = field.complexGroupKey || field.displayGroup?.key;
    if (!key) continue;
    const identity = `${complex ? 'complex' : 'display'}:${key}`;
    const group = groups.get(identity) || { key, complex, required: false };
    if (
      (!complex || complexEnabled[key]) &&
      (field.required || field.validator)
    ) {
      group.required = true;
    }
    groups.set(identity, group);
  }
  const rows: Record<string, CrudPageDisplayQueryCollapsedRows> = {};
  const collapsed: Record<string, boolean> = {};
  if (groups.size > 3) {
    for (const group of groups.values()) {
      if (group.complex) collapsed[group.key] = !group.required;
      else rows[group.key] = group.required ? 'all' : 0;
    }
  }
  const orderedGroups = [...groups.values()];
  const hasExpandedGroup = orderedGroups.some((group) => {
    if (group.complex)
      return !(collapsed[group.key] ?? initial.collapsed?.[group.key] ?? false);
    const visibleRows = rows[group.key] ?? initial.rows?.[group.key] ?? 'all';
    return visibleRows === 'all' || visibleRows > 0;
  });
  const first = orderedGroups[0];
  if (first && !hasExpandedGroup) {
    if (first.complex) collapsed[first.key] = false;
    else rows[first.key] = 'all';
  }
  return { rows, collapsed };
}
