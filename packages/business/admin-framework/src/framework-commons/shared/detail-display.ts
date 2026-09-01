import type { CrudFieldConfig } from './types';

import { sortFormLayoutFields } from './crud-form-layout';
import { formatAdministrativeArea } from './administrative-area-data';

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

function shouldShowDetailValue(field: CrudFieldConfig | undefined, value: any) {
  if (isEmptyValue(value)) {
    return false;
  }

  if (field?.type === 'json') {
    return true;
  }

  if (Array.isArray(value)) {
    return isPrimitiveArrayValue(value);
  }

  if (value && typeof value === 'object') {
    return false;
  }

  return true;
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
) {
  const fieldMap = new Map(fields.map((field) => [field.key, field]));
  const fieldOrderMap = new Map(
    sortFormLayoutFields(fields).map((field, index) => [field.key, index]),
  );

  return Object.entries(data)
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
    .filter((entry) => shouldShowDetailValue(entry.field, entry.value))
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
