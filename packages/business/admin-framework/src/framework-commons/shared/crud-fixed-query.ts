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
