import type { CrudFieldConfig } from './types';

import { sortFormLayoutFields } from './crud-form-layout';
import { formatAdministrativeArea } from './administrative-area-data';

/** 集合只取响应契约或实际记录字段，通用配置仅补充同名展示元数据。 */
export function resolveDetailFields(
  record: unknown,
  metadata: CrudFieldConfig[],
  declared?: CrudFieldConfig[],
) {
  const definitions = new Map(
    [...metadata, ...(declared || [])].map((field) => [field.key, field]),
  );
  const keys =
    record && typeof record === 'object' && !Array.isArray(record)
      ? Object.keys(record)
      : (declared || []).map((field) => field.key);
  return keys
    .map((key) => definitions.get(key) || { key, label: key })
    .filter((field) => field.detail !== false);
}

export type DetailDisplayEntryKind = 'array' | 'json' | 'qrcode' | 'scalar';

export interface DetailDisplayEntry {
  field?: CrudFieldConfig;
  key: string;
  kind: DetailDisplayEntryKind;
  label: string;
  value: any;
}

function isEmptyValue(value: any) {
  return value === undefined || value === null || value === '';
}

function isPrimitiveDetailValue(value: any) {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function isPrimitiveArrayValue(value: any) {
  return (
    Array.isArray(value) && value.every((item) => isPrimitiveDetailValue(item))
  );
}

function normalizeOptionValue(value: any) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value);
}

function formatBooleanValue(value: boolean) {
  return value ? '是' : '否';
}

function formatDateLikeValue(value: string) {
  return value.replace('T', ' ');
}

function isDateLikeText(value: any) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value);
}

function getOptionLabel(field: CrudFieldConfig | undefined, value: any) {
  const options = field?.options || [];
  const normalizedValue = normalizeOptionValue(value);
  const matched = options.find(
    (item) => normalizeOptionValue(item.value) === normalizedValue,
  );

  return matched?.label;
}

function getEntryLabel(key: string, field?: CrudFieldConfig) {
  if (field?.label) {
    return field.label;
  }

  const keyLabelMap: Record<string, string> = {
    id: 'ID',
    name: '名称',
  };

  if (keyLabelMap[key]) {
    return keyLabelMap[key];
  }

  return key
    .replaceAll(/([A-Z])/g, ' $1')
    .replace(/^./, (value) => value.toUpperCase());
}

function getEntryKind(field: CrudFieldConfig | undefined, value: any) {
  if (field?.type === 'qrcode') {
    return 'qrcode';
  }

  if (field?.type === 'json') {
    return 'json';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  return 'scalar';
}

export function isEmptyDetailValue(
  value: any,
  field?: CrudFieldConfig,
): boolean {
  if (isEmptyValue(value) || (typeof value === 'string' && !value.trim()))
    return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object')
    return Object.keys(value).length === 0;
  if (field?.type === 'json' && typeof value === 'string') {
    try {
      return isEmptyDetailValue(JSON.parse(value));
    } catch {
      return false;
    }
  }
  return false;
}

function shouldShowDetailValue(
  field: CrudFieldConfig | undefined,
  value: any,
  showEmptyValues: boolean,
) {
  if (field?.type === 'json')
    return showEmptyValues || !isEmptyDetailValue(value, field);
  if (Array.isArray(value))
    return (
      isPrimitiveArrayValue(value) && (showEmptyValues || value.length > 0)
    );
  if (value && typeof value === 'object') return false;
  return showEmptyValues || !isEmptyDetailValue(value, field);
}

function formatScalarValue(field: CrudFieldConfig | undefined, value: any) {
  if (isEmptyValue(value)) {
    return '-';
  }

  const optionLabel = getOptionLabel(field, value);
  if (optionLabel) {
    return optionLabel;
  }

  if (typeof value === 'boolean') {
    return formatBooleanValue(value);
  }

  if (field?.type === 'switch') {
    return value ? '是' : '否';
  }

  if (
    field &&
    (field.type === 'area-cascader' ||
      field.key === 'areaCode' ||
      field.key === 'regionCode' ||
      /区域编码|行政编码|城市编码|区县编码/.test(field.label))
  ) {
    try {
      return formatAdministrativeArea(value);
    } catch {
      return String(value);
    }
  }

  if (field?.type === 'datetime' || field?.type === 'date') {
    return formatDateLikeValue(String(value));
  }

  if (isDateLikeText(value)) {
    return formatDateLikeValue(value);
  }

  return String(value);
}

export function formatDetailJsonText(value: any) {
  if (isEmptyValue(value)) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatDetailDisplayValue(entry: DetailDisplayEntry) {
  if (entry.kind === 'json') {
    return formatDetailJsonText(entry.value);
  }

  if (Array.isArray(entry.value)) {
    return entry.value
      .map((item) => formatScalarValue(entry.field, item))
      .join(', ');
  }

  return formatScalarValue(entry.field, entry.value);
}

export function isDetailJsonValue(entry: DetailDisplayEntry | undefined) {
  return entry?.kind === 'json';
}

export function buildDetailDisplayEntries(
  data: Record<string, any>,
  fields: CrudFieldConfig[],
  allFields: CrudFieldConfig[] = fields,
  showEmptyValues = true,
) {
  const configuredKeys = new Set(allFields.map((field) => field.key));
  const fieldMap = new Map(fields.map((field) => [field.key, field]));
  const fieldOrderMap = new Map(
    sortFormLayoutFields(fields).map((field, index) => [field.key, index]),
  );

  // 已配置却不可见的字段不能退回为无配置字段展示。
  return Object.entries(data)
    .filter(([key]) => !configuredKeys.has(key) || fieldMap.has(key))
    .map(([key, value], index) => {
      const field = fieldMap.get(key);
      return {
        field,
        index,
        key,
        kind: getEntryKind(field, value),
        label: getEntryLabel(key, field),
        order: fieldOrderMap.get(key) ?? fields.length + index,
        value,
      };
    })
    .filter((entry) =>
      shouldShowDetailValue(entry.field, entry.value, showEmptyValues),
    )
    .sort((a, b) => a.order - b.order)
    .map(
      ({ field, key, kind, label, value }) =>
        ({
          field,
          key,
          kind,
          label,
          value,
        }) satisfies DetailDisplayEntry,
    );
}
