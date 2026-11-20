/** 个人流程按服务端事实时间筛选；全部时间不添加开始时间限制。 */
export type WorkflowPersonalPeriod =
  | 'all'
  | 'halfYear'
  | 'month'
  | 'week'
  | 'year';

/** 按本地日历回推月份，月末时使用目标月最后一天。 */
export function personalPeriodStart(
  period: WorkflowPersonalPeriod,
  now = new Date(),
): string | undefined {
  if (period === 'all') return undefined;
  const start = new Date(now);
  if (period === 'week' || period === 'month') {
    start.setDate(start.getDate() - (period === 'week' ? 7 : 30));
  } else {
    const day = start.getDate();
    start.setDate(1);
    start.setMonth(start.getMonth() - (period === 'halfYear' ? 6 : 12));
    const lastDay = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0,
    ).getDate();
    start.setDate(Math.min(day, lastDay));
  }
  return start.toISOString();
}
