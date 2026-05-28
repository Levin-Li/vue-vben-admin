import type { CrudFieldConfig } from './types';

export const DEFAULT_FORM_ROW_HEIGHT = 78;
export const FORM_GRID_COLUMN_GAP = 16;
export const MAX_SEARCH_COLUMN_COUNT = 7;
export const MIN_FORM_COLUMN_WIDTH = 240;
export const MIN_SEARCH_COLUMN_WIDTH = 280;
export const SEARCH_GRID_COLUMN_GAP = 16;

const FORM_LAYOUT_GROUP_ORDER = [
  'ownership',
  'basic',
  'media',
  'content',
  'business',
  'extension',
  'remark',
  'audit',
];

const FORM_FIELD_COMPONENT_FAMILY_ORDER = [
  'text',
  'number',
  'select',
  'tree-select',
  'cascader',
  'date',
  'time',
  'switch',
  'editor',
  'upload',
  'list',
  'other',
];

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}

export function getContainerColumnCount(
  containerWidth: number,
  minColumnWidth = MIN_SEARCH_COLUMN_WIDTH,
  maxColumns = MAX_SEARCH_COLUMN_COUNT,
  columnGap = SEARCH_GRID_COLUMN_GAP,
) {
  const safeWidth = Number.isFinite(containerWidth)
    ? Math.max(containerWidth, 0)
    : 0;
  const columns = Math.floor(
    (safeWidth + columnGap) / (minColumnWidth + columnGap),
  );

  return clampInteger(columns, 1, maxColumns);
}

export function resolveSearchCollapsedCount(
  fieldCount: number,
  columnCount: number,
  collapsedCount: number,
) {
  const totalFields = Math.max(Math.floor(fieldCount || 0), 0);
  const columns = clampInteger(columnCount, 1, MAX_SEARCH_COLUMN_COUNT);
  const lowerBound = Math.min(
    Math.max(Math.floor(collapsedCount || 0), 0),
    totalFields,
  );

  if (columns <= 1 || totalFields <= lowerBound) {
    return lowerBound;
  }

  const fieldsBeforeActionColumn = columns - 1;
  const usedColumnsInActionRow = lowerBound % columns;
  const additionalFields =
    (fieldsBeforeActionColumn - usedColumnsInActionRow + columns) % columns;

  return Math.min(lowerBound + additionalFields, totalFields);
}

export function getResponsiveFormColumnLimit(
  targetCount: number,
  viewportWidth: number,
) {
  const target = clampInteger(targetCount, 1, 5);

  if (viewportWidth < 768) {
    return 1;
  }

  if (viewportWidth < 1024) {
    return Math.min(target, 2);
  }

  if (viewportWidth < 1200) {
    return Math.min(target, 3);
  }

  if (viewportWidth < 1920) {
    return Math.min(target, 4);
  }

  return target;
}

export function getFormFieldVisualWeight(field: CrudFieldConfig) {
  if (isCompactJsonFormField(field)) {
    return 1;
  }

  if (field.type === 'switch') {
    return 0.6;
  }

  if (
    field.type === 'code' ||
    field.type === 'css' ||
    field.type === 'file' ||
    field.type === 'html' ||
    field.type === 'image' ||
    field.type === 'textarea'
  ) {
    return 2;
  }

  if (field.type === 'string-array' || field.type === 'tags') {
    return 3;
  }

  return 1;
}

export function isCompactJsonFormField(field: CrudFieldConfig) {
  return field.type === 'json';
}

export function shouldFormFieldSpanFullRow(field: CrudFieldConfig) {
  if (field.span && field.span > 0) {
    return false;
  }

  return (
    field.fullRow ||
    field.span === -1 ||
    field.type === 'textarea' ||
    field.type === 'string-array' ||
    field.type === 'tags'
  );
}

export function getFormFieldColumnSpan(
  field: CrudFieldConfig,
  columns: number,
) {
  if (shouldFormFieldSpanFullRow(field)) {
    return columns;
  }

  return Math.min(Math.max(field.span || 1, 1), columns);
}

function getFormLayoutGroupIndex(field: CrudFieldConfig, index: number) {
  if (!field.layoutGroup) {
    return FORM_LAYOUT_GROUP_ORDER.length + index / 1000;
  }

  const groupIndex = FORM_LAYOUT_GROUP_ORDER.indexOf(field.layoutGroup);
  return groupIndex >= 0 ? groupIndex : FORM_LAYOUT_GROUP_ORDER.length;
}

function getFormFieldComponentFamily(field: CrudFieldConfig) {
  switch (field.type) {
    case 'area-cascader': {
      return 'cascader';
    }
    case 'code':
    case 'cron':
    case 'css':
    case 'html':
    case 'textarea': {
      return 'editor';
    }
    case 'json': {
      return 'text';
    }
    case 'date':
    case 'datetime': {
      return 'date';
    }
    case 'file':
    case 'image': {
      return 'upload';
    }
    case 'number': {
      return 'number';
    }
    case 'org-tree-select': {
      return 'tree-select';
    }
    case 'role-select':
    case 'select':
    case 'tenant': {
      return 'select';
    }
    case 'string-array':
    case 'tags': {
      return 'list';
    }
    case 'switch': {
      return 'switch';
    }
    case 'time': {
      return 'time';
    }
    case 'password':
    case 'text':
    case undefined: {
      return 'text';
    }
    default: {
      return 'other';
    }
  }
}

function getFormFieldComponentFamilyRank(field: CrudFieldConfig) {
  const familyIndex = FORM_FIELD_COMPONENT_FAMILY_ORDER.indexOf(
    getFormFieldComponentFamily(field),
  );

  return familyIndex >= 0
    ? familyIndex
    : FORM_FIELD_COMPONENT_FAMILY_ORDER.length;
}

export function getFormFieldVisualAffinityKey(field: CrudFieldConfig) {
  const span = getFormFieldColumnSpan(field, 5);
  const multiplicity = field.multiple ? 'multiple' : 'single';

  return [
    String(getFormFieldComponentFamilyRank(field)).padStart(2, '0'),
    getFormFieldVisualWeight(field).toFixed(1),
    String(span).padStart(2, '0'),
    multiplicity,
  ].join(':');
}

function canSortByVisualAffinity(field: CrudFieldConfig) {
  return (
    field.layoutOrder === undefined &&
    !field.layoutNewRow &&
    !field.fullRow &&
    field.span === undefined &&
    !shouldFormFieldSpanFullRow(field)
  );
}

export function sortFormLayoutFields(fields: CrudFieldConfig[]) {
  const sortedEntries = fields
    .map((field, index) => ({
      field,
      groupIndex: getFormLayoutGroupIndex(field, index),
      index,
      order: field.layoutOrder ?? index,
    }))
    .sort((a, b) => {
      const groupDiff = a.groupIndex - b.groupIndex;

      if (groupDiff !== 0) {
        return groupDiff;
      }

      const orderDiff = a.order - b.order;
      return orderDiff !== 0 ? orderDiff : a.index - b.index;
    });

  const result: CrudFieldConfig[] = [];
  let segment: typeof sortedEntries = [];

  function flushSegment() {
    if (segment.length > 0) {
      result.push(
        ...segment
          .sort((a, b) => {
            const affinityDiff = getFormFieldVisualAffinityKey(
              a.field,
            ).localeCompare(getFormFieldVisualAffinityKey(b.field));

            return affinityDiff !== 0 ? affinityDiff : a.index - b.index;
          })
          .map((entry) => entry.field),
      );
      segment = [];
    }
  }

  for (const entry of sortedEntries) {
    const lastSegmentEntry = segment[segment.length - 1];
    const canSortEntry = canSortByVisualAffinity(entry.field);
    const canJoinSegment =
      canSortEntry &&
      (!lastSegmentEntry || lastSegmentEntry.groupIndex === entry.groupIndex);

    if (canJoinSegment) {
      segment.push(entry);
      continue;
    }

    flushSegment();

    if (canSortEntry) {
      segment.push(entry);
      continue;
    }

    result.push(entry.field);
  }

  flushSegment();

  return result;
}

export function estimateFormVisualRows(
  fields: CrudFieldConfig[],
  columns: number,
) {
  let usedColumns = 0;
  let currentRowWeight = 0;
  let rows = 0;

  function flushRow() {
    if (usedColumns > 0) {
      rows += currentRowWeight || 1;
      usedColumns = 0;
      currentRowWeight = 0;
    }
  }

  for (const field of fields) {
    if (field.layoutNewRow) {
      flushRow();
    }

    const span = getFormFieldColumnSpan(field, columns);
    const weight = getFormFieldVisualWeight(field);

    if (usedColumns > 0 && usedColumns + span > columns) {
      flushRow();
    }

    usedColumns += span;
    currentRowWeight = Math.max(currentRowWeight, weight);

    if (span === columns || usedColumns >= columns) {
      flushRow();
    }
  }

  flushRow();

  return rows;
}

function getMediaFieldCount(fields: CrudFieldConfig[]) {
  return fields.filter(
    (field) => field.type === 'image' || field.type === 'file',
  ).length;
}

export function resolveFormColumnCount({
  configuredMaxColumns,
  fields,
  modalAvailableWidth,
  viewportHeight,
  viewportWidth,
}: {
  configuredMaxColumns?: number;
  fields: CrudFieldConfig[];
  modalAvailableWidth: number;
  viewportHeight: number;
  viewportWidth: number;
}) {
  const totalWeight = fields.reduce(
    (sum, field) => sum + getFormFieldVisualWeight(field),
    0,
  );
  const normalizedConfiguredMaxColumns = Number.isFinite(configuredMaxColumns)
    ? configuredMaxColumns!
    : 5;
  const maxColumns = getResponsiveFormColumnLimit(
    Math.min(Math.max(normalizedConfiguredMaxColumns, 1), 5),
    viewportWidth,
  );
  let columns = 1;

  if (totalWeight > 30) {
    columns = 5;
  } else if (totalWeight > 18) {
    columns = 4;
  } else if (totalWeight > 10 || getMediaFieldCount(fields) >= 2) {
    columns = 3;
  } else if (totalWeight > 6) {
    columns = 2;
  }

  columns = Math.min(columns, maxColumns);

  while (columns > 1 && estimateFormVisualRows(fields, columns) < 3) {
    columns -= 1;
  }

  while (
    columns < maxColumns &&
    estimateFormVisualRows(fields, columns) * DEFAULT_FORM_ROW_HEIGHT >
      viewportHeight * 0.75
  ) {
    const nextColumns = columns + 1;
    const nextColumnWidth =
      (modalAvailableWidth - (nextColumns - 1) * FORM_GRID_COLUMN_GAP - 48) /
      nextColumns;

    if (nextColumnWidth < MIN_FORM_COLUMN_WIDTH) {
      break;
    }

    columns = nextColumns;
  }

  return columns;
}
