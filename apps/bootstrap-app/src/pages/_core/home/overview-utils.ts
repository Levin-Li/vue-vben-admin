export function resolveOverviewTotal(result: unknown): number | undefined {
  if (Array.isArray(result)) {
    return result.length;
  }

  if (!result || typeof result !== 'object') {
    return undefined;
  }

  const data = result as Record<string, unknown>;
  const total = data.totals ?? data.total ?? data.count ?? data.totalCount;
  const normalizedTotal = Number(total);

  if (Number.isFinite(normalizedTotal) && normalizedTotal >= 0) {
    return normalizedTotal;
  }

  if (Array.isArray(data.items)) {
    return data.items.length;
  }

  if (Array.isArray(data.records)) {
    return data.records.length;
  }

  if (Array.isArray(data.list)) {
    return data.list.length;
  }

  return undefined;
}
