import type { CrudFieldConfig } from './types';

export const CRUD_IMPORT_BATCH_SIZE = 2000;

export type CrudImportConverter =
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'json'
  | 'number'
  | 'string'
  | 'trim';

export const CRUD_IMPORT_CONVERTER_OPTIONS = [
  { label: '去空格文本', value: 'trim' },
  { label: '原始文本', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'boolean' },
  { label: '日期', value: 'date' },
  { label: '日期时间', value: 'datetime' },
  { label: 'JSON', value: 'json' },
] as const;

export interface CrudImportMapping {
  converter?: CrudImportConverter;
  defaultValue?: any;
  fieldKey: string;
  header?: string;
  required?: boolean;
}

export interface CrudImportTemplateConfig {
  mappings?: CrudImportMapping[];
  version?: number;
}

export interface ParsedImportSheet {
  headers: string[];
  rows: string[][];
}

export interface BuildImportRecordsResult {
  records: Record<string, any>[];
  rowErrors: Array<{
    message: string;
    rowIndex: number;
  }>;
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeHeader(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function stripBom(text: string) {
  return text.codePointAt(0) === 65_279 ? text.slice(1) : text;
}

export function parseCsvRows(text: string) {
  const source = stripBom(text || '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (quoted) {
      if (char === '"' && nextChar === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (char === '\n' || char === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';

      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((item) => item.some((value) => normalizeText(value)));
}

function parseXmlWorkbookRows(text: string) {
  if (typeof DOMParser === 'undefined') {
    return [];
  }

  const doc = new DOMParser().parseFromString(text, 'text/xml');

  if (doc.querySelector('parsererror')) {
    return [];
  }

  const rowNodes = [...doc.querySelectorAll('Row')];

  return rowNodes
    .map((rowNode) =>
      [...rowNode.querySelectorAll('Cell')].map((cellNode) => {
        const dataNode = cellNode.querySelectorAll('Data')[0];
        return dataNode?.textContent ?? cellNode.textContent ?? '';
      }),
    )
    .filter((row) => row.some((value) => normalizeText(value)));
}

function parseHtmlTableRows(text: string) {
  if (typeof DOMParser === 'undefined') {
    return [];
  }

  const doc = new DOMParser().parseFromString(text, 'text/html');
  const firstTable = doc.querySelector('table');

  if (!firstTable) {
    return [];
  }

  return [...firstTable.querySelectorAll('tr')]
    .map((rowNode) =>
      [...rowNode.querySelectorAll('th,td')].map(
        (cellNode) => cellNode.textContent ?? '',
      ),
    )
    .filter((row) => row.some((value) => normalizeText(value)));
}

export function parseSpreadsheetText(text: string, fileName = '') {
  const name = fileName.toLowerCase();
  const trimmed = stripBom(text || '').trimStart();
  let rows: string[][];

  if (name.endsWith('.csv') || trimmed.includes(',')) {
    rows = parseCsvRows(text);
  } else if (trimmed.startsWith('<?xml') || trimmed.includes('<Workbook')) {
    rows = parseXmlWorkbookRows(text);
  } else if (trimmed.includes('<table')) {
    rows = parseHtmlTableRows(text);
  } else {
    rows = parseCsvRows(text);
  }

  if (rows.length === 0) {
    return {
      headers: [],
      rows: [],
    };
  }

  const [headerRow = [], ...dataRows] = rows;
  const headers = headerRow.map((header, index) => {
    const normalized = normalizeText(header);

    return normalized || `列${index + 1}`;
  });

  return {
    headers,
    rows: dataRows,
  };
}

export async function parseImportFile(file: File): Promise<ParsedImportSheet> {
  const fileName = file.name || '';

  if (fileName.toLowerCase().endsWith('.xlsx')) {
    throw new Error(
      '当前导入不内置 xlsx 解析库，请另存为 CSV 或系统导出的 .xls 文件后导入。',
    );
  }

  return parseSpreadsheetText(await file.text(), fileName);
}

export function buildDefaultImportMappings(
  headers: string[],
  fields: CrudFieldConfig[],
): CrudImportMapping[] {
  const headerMap = new Map(
    headers.map((header) => [normalizeHeader(header), header] as const),
  );

  return fields
    .filter((field) => field.key && field.editable !== false)
    .map((field) => {
      const fieldKey = String(field.key);
      const matchedHeader =
        headerMap.get(normalizeHeader(field.label)) ||
        headerMap.get(normalizeHeader(fieldKey));

      return {
        converter: inferImportConverter(field),
        fieldKey,
        header: matchedHeader,
        required: field.required === true,
      };
    });
}

export function inferImportConverter(
  field: CrudFieldConfig,
): CrudImportConverter {
  if (field.type === 'number') {
    return 'number';
  }

  if (field.type === 'switch') {
    return 'boolean';
  }

  if (field.type === 'date') {
    return 'date';
  }

  if (field.type === 'datetime') {
    return 'datetime';
  }

  if (field.type === 'json') {
    return 'json';
  }

  return 'trim';
}

function convertImportValue(value: string, converter: CrudImportConverter) {
  const text = normalizeText(value);

  if (!text) {
    return undefined;
  }

  if (converter === 'string') {
    return value;
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

  return text;
}

function getRowValue(row: string[], headers: string[], header?: string) {
  if (!header) {
    return '';
  }

  const index = headers.indexOf(header);

  return index === -1 ? '' : row[index] || '';
}

export function buildImportRecords(
  sheet: ParsedImportSheet,
  mappings: CrudImportMapping[],
): BuildImportRecordsResult {
  const activeMappings = mappings.filter((mapping) => mapping.header);
  const records: Record<string, any>[] = [];
  const rowErrors: BuildImportRecordsResult['rowErrors'] = [];

  sheet.rows.forEach((row, rowIndex) => {
    const record: Record<string, any> = {};

    for (const mapping of activeMappings) {
      const rawValue = getRowValue(row, sheet.headers, mapping.header);
      const value =
        normalizeText(rawValue) || mapping.defaultValue === undefined
          ? rawValue
          : mapping.defaultValue;

      if (mapping.required && !normalizeText(value)) {
        rowErrors.push({
          message: `${mapping.fieldKey} 不能为空`,
          rowIndex: rowIndex + 2,
        });
        continue;
      }

      if (!normalizeText(value)) {
        continue;
      }

      try {
        record[mapping.fieldKey] = convertImportValue(
          value,
          mapping.converter || 'trim',
        );
      } catch (error) {
        rowErrors.push({
          message:
            error instanceof Error
              ? `${mapping.fieldKey}: ${error.message}`
              : `${mapping.fieldKey}: 转换失败`,
          rowIndex: rowIndex + 2,
        });
      }
    }

    if (Object.keys(record).length > 0) {
      records.push(record);
    }
  });

  return {
    records,
    rowErrors,
  };
}

export function chunkImportRecords<T>(
  records: T[],
  batchSize = CRUD_IMPORT_BATCH_SIZE,
) {
  const chunks: T[][] = [];

  for (let index = 0; index < records.length; index += batchSize) {
    chunks.push(records.slice(index, index + batchSize));
  }

  return chunks;
}

export function normalizeImportTemplateConfig(
  value: CrudImportTemplateConfig | null | string | undefined,
): CrudImportTemplateConfig {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) || {};
    } catch {
      return {};
    }
  }

  return value;
}
