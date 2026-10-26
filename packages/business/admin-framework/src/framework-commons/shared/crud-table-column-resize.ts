// 只在当前页面内调整表头列宽，保留右侧列的总宽度。
export function resizeTemporaryTableColumns(
  widths: number[],
  minimumWidths: number[],
  maximumWidths: number[],
  targetIndex: number,
  requestedWidth: number,
): number[] {
  if (
    targetIndex < 0 ||
    targetIndex >= widths.length - 1 ||
    !Number.isFinite(requestedWidth) ||
    widths.some((width) => !Number.isFinite(width) || width <= 0)
  ) {
    return [...widths];
  }

  const next = [...widths];
  const currentWidth = next[targetIndex] ?? 0;
  const targetMinimum = Math.min(
    Math.max(minimumWidths[targetIndex] || 1, 1),
    currentWidth,
  );
  const targetMaximum = Math.max(
    maximumWidths[targetIndex] || Number.POSITIVE_INFINITY,
    currentWidth,
  );
  const desiredWidth = Math.max(
    targetMinimum,
    Math.min(requestedWidth, targetMaximum),
  );
  const growing = desiredWidth > currentWidth;
  const rightIndices = widths
    .map((_, index) => index)
    .filter((index) => index > targetIndex);
  const capacities = rightIndices.map((index) =>
    growing
      ? Math.max((next[index] ?? 0) - (minimumWidths[index] || 1), 0)
      : Math.max(
          (maximumWidths[index] || Number.POSITIVE_INFINITY) -
            (next[index] ?? 0),
          0,
        ),
  );
  const totalCapacity = capacities.reduce(
    (total, capacity) => total + capacity,
    0,
  );
  let remaining = Math.min(
    Math.abs(desiredWidth - currentWidth),
    totalCapacity,
  );
  const applied = remaining;
  const allocations = capacities.map(() => 0);

  // 缩小时按可缩空间分摊；扩展时按当前宽度分摊，碰到上限后继续分配余额。
  while (remaining > 0.001) {
    const available = capacities
      .map((capacity, index) => ({
        capacity: capacity - (allocations[index] ?? 0),
        index,
        weight: growing ? capacity : (next[rightIndices[index] ?? -1] ?? 0),
      }))
      .filter((item) => item.capacity > 0.001);
    const totalWeight = available.reduce(
      (total, item) => total + item.weight,
      0,
    );
    if (available.length === 0 || totalWeight <= 0) break;

    let distributed = 0;
    for (const item of available) {
      const share = Math.min(
        item.capacity,
        (remaining * item.weight) / totalWeight,
      );
      allocations[item.index] = (allocations[item.index] ?? 0) + share;
      distributed += share;
    }
    if (distributed <= 0.001) break;
    remaining -= distributed;
  }

  const actualDelta = applied - remaining;
  next[targetIndex] = currentWidth + (growing ? actualDelta : -actualDelta);
  for (const [index, rightIndex] of rightIndices.entries()) {
    const allocation = allocations[index] ?? 0;
    next[rightIndex] =
      (next[rightIndex] ?? 0) + (growing ? -allocation : allocation);
  }
  return next;
}
