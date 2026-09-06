import type { SearchFieldItem } from '@levin/admin-framework/framework-commons/shared/crud-query-items';
import type { CrudFieldConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { parseMenuFixedQuery } from '@levin/admin-framework/framework-commons/menu-fixed-query';
import {
  resolveAdministrativeAreaSelectableLevels,
  restrictAdministrativeAreaOptionsByLevels,
} from '@levin/admin-framework/framework-commons/shared/administrative-area-data';
import {
  applyAreaCascaderValueToRecord,
  findCascaderOptionPath,
  getAreaCascaderValueFromRecord,
} from '@levin/admin-framework/framework-commons/shared/area-cascader';
import { serializeCrudFieldValue } from '@levin/admin-framework/framework-commons/shared/crud-field-value';

/** 与页面查询控件共用层级解析和级联选项限制。 */
export function getFixedQueryAreaControl(
  field: CrudFieldConfig,
  value: unknown,
  options: any[],
): { changeOnSelect: boolean; options: any[] } {
  const levels = resolveAdministrativeAreaSelectableLevels(
    field.areaCascader?.selectableLevels,
    value,
  );
  return {
    options: restrictAdministrativeAreaOptionsByLevels(options, levels),
    changeOnSelect: levels.length === 3,
  };
}

export function queryItemKeys(item: SearchFieldItem) {
  if (item.kind === 'range') return [item.startKey, item.endKey];
  if (item.field.type === 'area-cascader')
    return Object.keys(
      applyAreaCascaderValueToRecord({}, item.field, [], [], true),
    );
  return [item.field.key];
}

export function readFixedQueryValue(
  item: SearchFieldItem,
  values: Record<string, any>,
) {
  if (item.kind === 'range')
    return [values[item.startKey], values[item.endKey]];
  if (item.field.type === 'area-cascader')
    return getAreaCascaderValueFromRecord(item.field, values);
  const value = values[item.key];
  return item.field.type === 'switch' && value !== undefined
    ? String(value)
    : value;
}

export function serializeFixedQueryItems(
  items: SearchFieldItem[],
  selected: string[],
  values: Record<string, any>,
  options: Record<string, any[]> = {},
) {
  const result: Record<string, any> = {};
  for (const item of items) {
    if (!selected.includes(item.key)) continue;
    const value = values[item.key];
    if (item.kind === 'range') {
      if (!Array.isArray(value) || !value.some(Boolean))
        throw new Error(`请填写${item.label}`);
      if (value[0]) result[item.startKey] = value[0];
      if (value[1]) result[item.endKey] = value[1];
    } else if (item.field.type === 'area-cascader') {
      if (!Array.isArray(value) || value.length === 0)
        throw new Error(`请填写${item.field.label}`);
      const control = getFixedQueryAreaControl(
        item.field,
        value,
        options[item.key] || [],
      );
      const path = findCascaderOptionPath(control.options, value);
      if (!control.changeOnSelect && path.at(-1)?.isLeaf === false) {
        throw new Error(`${item.field.label}请选择指定的行政区划层级`);
      }
      applyAreaCascaderValueToRecord(
        result,
        item.field,
        value,
        options[item.key] || [],
      );
    } else {
      const field: CrudFieldConfig = item.field;
      const input =
        (field.type === 'tags' || field.type === 'string-array') &&
        typeof value === 'string'
          ? value
              .split(/\n|,/)
              .map((part) => part.trim())
              .filter(Boolean)
          : value;
      // 显式固定的空文本与空数组也是有效值，不按真值过滤 false/0。
      const serialized =
        input === '' ? '' : serializeCrudFieldValue(field, input);
      if (serialized === undefined) throw new Error(`请填写${field.label}`);
      result[field.key] = serialized;
    }
  }
  return parseMenuFixedQuery(result);
}
