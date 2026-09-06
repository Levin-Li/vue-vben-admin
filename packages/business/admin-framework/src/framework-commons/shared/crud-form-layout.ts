import type { CrudFieldConfig } from './types';

export const DEFAULT_FORM_ROW_HEIGHT = 78;
export const FORM_GRID_COLUMN_GAP = 16;
export const FORM_FIELD_MAX_WIDTH = 480;
export const MAX_SEARCH_COLUMN_COUNT = 7;
export const MIN_FORM_COLUMN_WIDTH = 240;
export const MIN_SEARCH_COLUMN_WIDTH = 280;
export const SEARCH_GRID_COLUMN_GAP = 16;
export const FORM_MODAL_RECOMMENDED_MAX_WIDTH_BY_COLUMN = {
  1: 560,
  2: 960,
  3: 1120,
  4: 1280,
  5: 1480,
} as const;

const FORM_LAYOUT_GROUP_ORDER = [
  'ownership',
  'basic',
  'identity',
  'contact',
  'license',
  'application',
  'media',
  'content',
  'business',
  'assignment',
  'permission',
  'profile',
  'external',
  'status',
  'extension',
  'remark',
  'audit',
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

export function getFormGridContentMaxWidth(columns: number) {
  const safeColumns = clampInteger(columns, 1, 5);

  return (
    safeColumns * FORM_FIELD_MAX_WIDTH +
    (safeColumns - 1) * FORM_GRID_COLUMN_GAP
  );
}

export function getFormModalRecommendedMaxWidth(columns: number) {
  const safeColumns = clampInteger(columns, 1, 5) as
    keyof typeof FORM_MODAL_RECOMMENDED_MAX_WIDTH_BY_COLUMN;

  return FORM_MODAL_RECOMMENDED_MAX_WIDTH_BY_COLUMN[safeColumns];
}

export function shouldFormFieldSpanFullRow(field: CrudFieldConfig) {
  return field.fullRow === true || field.span === -1;
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

export function sortFormLayoutFields(fields: CrudFieldConfig[]) {
  return fields
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
    })
    .map((entry) => entry.field);
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
    const weight = 1;

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
  const totalWeight = fields.length;
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
  } else if (totalWeight > 10) {
    columns = 3;
  } else if (totalWeight > 6) {
    columns = 2;
  }

  columns = Math.min(columns, maxColumns);

  while (columns > 1 && estimateFormVisualRows(fields, columns) < 3) {
    columns -= 1;
  }

  while (
    columns > 1 &&
    modalAvailableWidth < getFormModalRecommendedMaxWidth(columns)
  ) {
    columns -= 1;
  }

  while (
    columns < maxColumns &&
    estimateFormVisualRows(fields, columns) * DEFAULT_FORM_ROW_HEIGHT >
      viewportHeight * 0.75
  ) {
    const nextColumns = columns + 1;
    if (modalAvailableWidth < getFormModalRecommendedMaxWidth(nextColumns)) {
      break;
    }

    columns = nextColumns;
  }

  return columns;
}
