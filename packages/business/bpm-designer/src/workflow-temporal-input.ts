/** 日期与墙上时间直接使用输入值；绝对时间用浏览器当前时区输入并保存为带偏移的 ISO 时点。 */
export function workflowTemporalInputType(type: string) {
  if (type === 'date') return 'date';
  if (type === 'time') return 'time';
  if (type === 'localDatetime' || type === 'datetime') return 'datetime-local';
  return 'text';
}

export function workflowTemporalInputValue(type: string, value: unknown) {
  if (value === undefined || value === null) return '';
  if (type !== 'datetime') return String(value);
  const instant = new Date(String(value));
  if (Number.isNaN(instant.getTime())) return '';
  const local = new Date(
    instant.getTime() - instant.getTimezoneOffset() * 60_000,
  );
  return local.toISOString().slice(0, 19);
}

export function workflowTemporalLiteral(type: string, value: string) {
  if (type !== 'datetime' || value === '') return value;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? value : instant.toISOString();
}
