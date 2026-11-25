import { formatCrudMoneyValue } from '@levin/admin-framework/framework-commons/shared/crud-money-display';

export interface ReportNumberFormat {
  kind: 'MONEY' | 'PLAIN' | 'QUANTITY';
  unit?: null | string;
}
const units = ['', '万', '亿', '兆', '京', '垓', '秭', '穰'];
const groupingField = {
  key: 'reportValue',
  label: '数值',
  type: 'number' as const,
  moneyDisplay: { money: true, grouping: 'four' as const, unit: '' },
};

/** 用字符串展开有限范围的科学计数法，不进行浮点数换算。 */
function decimal(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return;
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(
    String(value).trim(),
  );
  if (!match) return;
  const sign = match[1] || '';
  const integer = match[2] || '';
  const fraction = match[3] || '';
  const exponent = Number(match[4] || 0);
  if (
    !Number.isSafeInteger(exponent) ||
    Math.abs(exponent) > 128 ||
    integer.length + fraction.length > 256
  )
    return;
  const digits = integer + fraction;
  const point = integer.length + exponent;
  let expanded: string;
  if (point <= 0) expanded = `0.${'0'.repeat(-point)}${digits}`;
  else if (point >= digits.length)
    expanded = digits + '0'.repeat(point - digits.length);
  else expanded = `${digits.slice(0, point)}.${digits.slice(point)}`;
  const [whole, part] = expanded.split('.');
  return (
    sign +
    (whole || '0').replace(/^0+(?=\d)/, '') +
    (part === undefined ? '' : `.${part}`)
  );
}

/** 使用项目四位分组规则；悬停保留每个非首段的四位数字。 */
export function formatReportNumber(
  value: unknown,
  format?: ReportNumberFormat,
) {
  if (value === null || value === undefined || value === '')
    return { text: '—' };
  if (!format || format.kind === 'PLAIN') return { text: String(value) };
  const normalized = decimal(value);
  if (!normalized) return { text: String(value) };
  const unit = format.unit ?? (format.kind === 'MONEY' ? '元' : '');
  const text = formatCrudMoneyValue(groupingField, normalized) + unit;
  const match = /^([+-]?)(\d+)(\.\d+)?$/.exec(normalized);
  if (!match || (match[2] || '').length <= 4) return { text };
  const chunks = (match[2] || '').match(/\d{1,4}(?=(?:\d{4})*$)/g);
  if (!chunks || chunks.length > units.length) return { text };
  let started = false;
  const detail = chunks
    .map((chunk, index) => {
      // 小数属于最低四位，即使整数低位全为零也要保留其位置。
      if (!/[1-9]/.test(chunk) && !(index === chunks.length - 1 && match[3])) return '';
      const part = started ? chunk : chunk.replace(/^0+/, '');
      started = true;
      return `${part}${units[chunks.length - index - 1]}`;
    })
    .join('');
  return { text, hint: `${match[1] || ''}${detail}${match[3] || ''}${unit}` };
}

/** 轴刻度无业务单位时仍按四位分组，不修改图表真实数值。 */
export function formatReportAxis(value: number | string) {
  const normalized = decimal(value);
  return normalized
    ? formatCrudMoneyValue(groupingField, normalized)
    : String(value);
}
