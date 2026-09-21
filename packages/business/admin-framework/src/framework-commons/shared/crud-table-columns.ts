export type CrudTableColumnFixed = 'left' | 'right' | undefined;

export function normalizeLeftFixedTableColumns<T>(
  fields: T[],
  getFixed: (field: T) => CrudTableColumnFixed,
  getKey: (field: T) => string,
) {
  const fixedMap: Record<string, CrudTableColumnFixed> = {};

  for (const field of fields) {
    const fixed = getFixed(field);
    const key = getKey(field);

    if (fixed === 'left') {
      // 左固定列按当前顺序组成完整左侧列组，不能因前一个字段已固定而丢弃后续字段。
      fixedMap[key] = 'left';
      continue;
    }

    if (fixed === 'right') {
      fixedMap[key] = 'right';
    }
  }

  return fixedMap;
}
