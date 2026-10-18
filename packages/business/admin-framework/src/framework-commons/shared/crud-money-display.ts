import type { CrudFieldConfig } from './types';

const CHINESE_UNITS = ['', '万', '亿', '兆', '京', '垓', '秭', '穰'];
const DECIMAL_PATTERN = /^([+-]?)(\d+)(\.\d+)?$/;

/** 金额语义优先采用页面显式声明；默认只识别数值型金额，不把费率、汇率当作金额。 */
export function isCrudMoneyField(field: CrudFieldConfig | undefined) {
  if (!field) return false;
  if (field.moneyDisplay?.money !== undefined) return field.moneyDisplay.money;
  if (field.type !== 'number' && field.valueType !== 'number') return false;
  if (
    /rate|ratio|percent/i.test(field.key) ||
    /费率|汇率|比率|百分比/.test(field.label)
  ) {
    return false;
  }

  return (
    /amount|balance|price|fee/i.test(field.key) ||
    /金额|余额|价格|费用|额度/.test(field.label)
  );
}

function getDecimalParts(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return;
  const source = String(value).trim();
  const match = DECIMAL_PATTERN.exec(source);
  if (!match) return;
  return {
    fraction: match[3] || '',
    integer: match[2] || '',
    sign: match[1] || '',
  };
}

function getMoneyUnit(field: CrudFieldConfig | undefined) {
  return field?.moneyDisplay?.unit ?? '元';
}

/** 按原始十进制文本分组，保留小数位和超过 Number 安全整数范围的数字。 */
export function formatCrudMoneyValue(
  field: CrudFieldConfig | undefined,
  value: unknown,
) {
  if (value === null || value === undefined || value === '') return '-';
  const parts = getDecimalParts(value);
  if (!parts) return String(value);

  const grouping =
    field?.moneyDisplay?.grouping ||
    (isCrudMoneyField(field) ? 'four' : 'three');
  if (grouping === 'none')
    return `${parts.sign}${parts.integer}${parts.fraction}${getMoneyUnit(field)}`;
  const size = grouping === 'four' ? 4 : 3;
  const integer = parts.integer.replaceAll(
    new RegExp(String.raw`\B(?=(\d{${size}})+(?!\d))`, 'g'),
    ',',
  );
  return `${parts.sign}${integer}${parts.fraction}${getMoneyUnit(field)}`;
}

/** 仅在四位分组的金额达到万位时提供中文单位提示。 */
export function getCrudMoneyUnitHint(
  field: CrudFieldConfig | undefined,
  value: unknown,
) {
  if (
    !isCrudMoneyField(field) ||
    field?.moneyDisplay?.chineseUnitTooltip === false
  )
    return;
  const parts = getDecimalParts(value);
  if (!parts) return;
  const integer = parts.integer.replace(/^0+(?=\d)/, '');
  if (integer.length <= 4) return;

  const chunks = integer.match(/\d{1,4}(?=(?:\d{4})*$)/g);
  if (!chunks || chunks.length > CHINESE_UNITS.length) return;
  const text = chunks
    .map((chunk, index) => {
      const number = chunk.replace(/^0+/, '');
      return number
        ? `${number}${CHINESE_UNITS[chunks.length - index - 1]}`
        : '';
    })
    .join('');
  return `${parts.sign}${text}${parts.fraction}${getMoneyUnit(field)}`;
}
