import type { MenuFixedQuery } from '../menu-fixed-query';
import type { CrudFieldConfig } from './types';

import { isFixedQueryField } from '../menu-fixed-query';
import { applyAreaCascaderValueToRecord } from './area-cascader';

/** 按控件实际提交键识别固定字段，包括行政区划的多字段映射。 */
export function isFixedCrudQueryField(
  field: CrudFieldConfig,
  fixed: MenuFixedQuery,
) {
  const keys = [field.key];
  if (field.type === 'area-cascader') {
    keys.push(
      ...Object.keys(applyAreaCascaderValueToRecord({}, field, [], [], true)),
    );
  }
  return isFixedQueryField(keys, fixed);
}

/** 只识别与固定条件同名的实际表单字段，避免把模糊或范围查询键误当作写入字段。 */
export function isFixedCrudFormField(
  field: CrudFieldConfig,
  fixed: MenuFixedQuery,
) {
  return Object.hasOwn(fixed, field.key);
}

export function getFixedCrudFormValue(
  field: CrudFieldConfig,
  fixed: MenuFixedQuery,
) {
  return fixed[field.key];
}
