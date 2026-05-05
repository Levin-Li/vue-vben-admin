export type CrudTableColumnFixed = 'left' | 'right' | undefined;

export function normalizeLeftFixedTableColumns<T>(
  fields: T[],
  getFixed: (field: T) => CrudTableColumnFixed,
  getKey: (field: T) => string,
) {
  const fixedMap: Record<string, CrudTableColumnFixed> = {};
  let hasLeftFixedColumn = false;

  for (const field of fields) {
    const fixed = getFixed(field);
    const key = getKey(field);

    if (fixed === 'left') {
      if (!hasLeftFixedColumn) {
        fixedMap[key] = 'left';
        hasLeftFixedColumn = true;
      }
      continue;
    }

    if (fixed === 'right') {
      fixedMap[key] = 'right';
    }
  }

  return fixedMap;
}
