export type CrudImportConverter =
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'json'
  | 'number'
  | 'string'
  | 'trim';

export type CrudExportConverter = CrudImportConverter | 'display';

export const CRUD_IMPORT_CONVERTER_OPTIONS = [
  { label: '去空格文本', value: 'trim' },
  { label: '原始文本', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'boolean' },
  { label: '日期', value: 'date' },
  { label: '日期时间', value: 'datetime' },
  { label: 'JSON', value: 'json' },
] as const;

export const CRUD_EXPORT_CONVERTER_OPTIONS = [
  { label: '列表显示值（默认）', value: 'display' },
  ...CRUD_IMPORT_CONVERTER_OPTIONS,
] as const;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function parseExcelSerialDate(value: number) {
  // Excel's day zero is 1899-12-30 because it intentionally retains the
  // historical 1900 leap-year bug for compatibility.
  const days = Math.floor(value);
  const milliseconds = Math.round((value - days) * 86_400_000);
  const date = new Date(1899, 11, 30 + days);

  date.setMilliseconds(date.getMilliseconds() + milliseconds);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseDateValue(value: unknown) {
  const text = normalizeText(value);

  if (!text) {
    return undefined;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    return parseExcelSerialDate(Number(text));
  }

  const matched = text.match(
    /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日)?(?:[ T]+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/,
  );

  if (!matched) {
    return undefined;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    matched;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText || 0);
  const minute = Number(minuteText || 0);
  const second = Number(secondText || 0);
  const date = new Date(year, month - 1, day, hour, minute, second);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return undefined;
  }

  return date;
}

function formatDate(value: unknown, includeTime: boolean) {
  const date = parseDateValue(value);

  if (!date) {
    throw new Error(`不是有效${includeTime ? '日期时间' : '日期'}：${value}`);
  }

  const dateText = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;

  return includeTime
    ? `${dateText}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
        date.getSeconds(),
      )}`
    : dateText;
}

export function convertCrudValue(
  value: unknown,
  converter: CrudImportConverter,
) {
  const text = normalizeText(value);

  if (!text) {
    return undefined;
  }

  if (converter === 'string') {
    return String(value);
  }

  if (converter === 'number') {
    const numberValue = Number(text);

    if (!Number.isFinite(numberValue)) {
      throw new TypeError(`不是有效数字：${value}`);
    }

    return numberValue;
  }

  if (converter === 'boolean') {
    if (['1', 'true', 'y', 'yes', '启用', '是'].includes(text.toLowerCase())) {
      return true;
    }

    if (['0', 'false', 'n', 'no', '否', '禁用'].includes(text.toLowerCase())) {
      return false;
    }

    throw new Error(`不是有效布尔值：${value}`);
  }

  if (converter === 'json') {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`不是有效 JSON：${value}`);
    }
  }

  if (converter === 'date') {
    return formatDate(value, false);
  }

  if (converter === 'datetime') {
    return formatDate(value, true);
  }

  return text;
}

export function formatCrudExportValue(
  value: unknown,
  converter: CrudExportConverter | undefined,
  displayValue: unknown,
) {
  if (!converter || converter === 'display') {
    return displayValue === null || displayValue === undefined
      ? ''
      : String(displayValue);
  }

  const converted = convertCrudValue(value, converter);

  return converted === null || converted === undefined
    ? ''
    : typeof converted === 'string'
      ? converted
      : JSON.stringify(converted);
}
