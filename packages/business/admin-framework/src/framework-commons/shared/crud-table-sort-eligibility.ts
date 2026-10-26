import type { CrudFieldConfig, CrudFieldType } from './types';

const backendScalarTypes = new Set<CrudFieldType>([
  'date',
  'datetime',
  'number',
  'select',
  'switch',
  'text',
  'time',
]);

const defaultSemanticKeys =
  /(?:^|[._])(?:name|type|category|time|date)$|(?:Name|Type|Category|Time|Date|At)$/;
const defaultSemanticLabels = /(?:名称|类型|类别|时间|日期)$/;

/** 静态能力：UI 设置只能调整有明确后端排序字段的列。 */
export function canSortCrudTableField(field: CrudFieldConfig): boolean {
  if (
    field.sortable === false ||
    field.key === '__tenant' ||
    field.key === '__actions'
  ) {
    return false;
  }

  if (field.sortField?.trim()) return true;

  return (
    field.hasBackingField !== false &&
    field.complexValue !== true &&
    typeof field.tableValue !== 'function' &&
    (field.maxLength === undefined || field.maxLength <= 255) &&
    backendScalarTypes.has(field.type || 'text')
  );
}

/** 默认状态：名称/类别/类型、时间、枚举和数据字典先开启，其余交给 UI。 */
export function isCrudTableFieldSortable(
  field: CrudFieldConfig,
  uiSortable?: boolean,
): boolean {
  if (!canSortCrudTableField(field)) return false;
  if (uiSortable !== undefined) return uiSortable;
  if (field.sortable === true || field.sortField?.trim()) return true;

  if (['date', 'datetime', 'time'].includes(field.type || '')) return true;
  if (
    defaultSemanticKeys.test(field.key) ||
    defaultSemanticLabels.test(field.label)
  ) {
    return true;
  }

  return (
    field.loadOptions?.optionSource === 'enum' ||
    field.loadOptions?.optionSource === 'dictionary' ||
    (field.type === 'select' &&
      !field.loadOptions &&
      !field.remoteSearch &&
      Boolean(field.options?.length))
  );
}
