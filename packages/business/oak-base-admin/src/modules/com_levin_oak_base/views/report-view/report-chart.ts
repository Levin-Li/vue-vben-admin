type ChartType = 'BAR' | 'LINE' | 'PIE';

/** 图表采用第一列分类、后续列数值；缺失或非法数值不能悄悄变成零。 */
export function chartData(
  type: ChartType,
  columns: string[],
  rows: unknown[][],
) {
  if (rows.length === 0) return { error: '暂无数据' } as const;
  if (columns.length < 2 || (type === 'PIE' && columns.length !== 2)) {
    return {
      error: '图表需要分类列和数值列，饼图需要且只能有一列数值',
    } as const;
  }
  const categories: string[] = [];
  const series = columns.slice(1).map(() => [] as number[]);
  for (const row of rows) {
    const category = row[0];
    if (
      row.length !== columns.length ||
      category === null ||
      category === undefined ||
      !['boolean', 'number', 'string'].includes(typeof category) ||
      (typeof category === 'number' && !Number.isFinite(category)) ||
      String(category).length > 256
    ) {
      return { error: '分类数据不适合绘制图表，请查看结果表格' } as const;
    }
    categories.push(String(category));
    for (let index = 1; index < columns.length; index += 1) {
      const value = row[index];
      let numeric = Number.NaN;
      if (typeof value === 'number') numeric = value;
      else if (
        typeof value === 'string' &&
        /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)
      ) {
        numeric = Number(value);
        // 非零十进制下溢到零会改变图表含义，保留原值供表格查看。
        if (numeric === 0 && /[1-9]/.test(value.split(/e/i)[0] || '')) {
          return { error: '数值精度超出图表范围，请查看结果表格' } as const;
        }
      }
      if (!Number.isFinite(numeric) || (type === 'PIE' && numeric < 0)) {
        return {
          error: '数值缺失或不适合绘制图表，请查看结果表格',
        } as const;
      }
      series[index - 1]?.push(numeric);
    }
  }
  if (type === 'PIE') {
    const values = series[0] || [];
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(total)) {
      // 仅在总和溢出时等比例缩放；悬停仍读取原始数据而非缩放值。
      const maximum = Math.max(...values);
      const scaled = values.map((value) => value / maximum);
      if (scaled.some((value, index) => value === 0 && values[index] !== 0)) {
        return { error: '数值比例超出图表范围，请查看结果表格' } as const;
      }
      series[0] = scaled;
    }
  }
  return { categories, series } as const;
}
