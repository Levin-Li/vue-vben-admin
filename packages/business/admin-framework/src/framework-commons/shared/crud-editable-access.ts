import type { CrudFieldConfig } from './types';

import { isSuperAdminUser } from './user-identity';

export interface CrudSearchFieldItem {
  field?: Pick<CrudFieldConfig, 'key'>;
  kind: 'field' | 'range';
}

export function hasCrudEditableField(fields: CrudFieldConfig[]) {
  return fields.some((field) => field.key === 'editable');
}

export function resolveEditableCrudFields(fields: CrudFieldConfig[]) {
  return fields.map((field) =>
    field.key === 'editable'
      ? {
          ...field,
          allowInput: true,
          form: true,
          formCreate: true,
          formEdit: true,
          search: true,
          table: true,
        }
      : field,
  );
}

export function isEditableCrudFieldVisible(
  field: Pick<CrudFieldConfig, 'key'>,
  userInfo: unknown,
) {
  return field.key !== 'editable' || isSuperAdminUser(userInfo);
}

export function hasRenderedEditableSearchControl(
  searchFieldItems: CrudSearchFieldItem[],
) {
  return searchFieldItems.some(
    (item) => item.kind === 'field' && item.field?.key === 'editable',
  );
}

export function shouldApplyEditableSearchDefault(
  isPlatformUser: boolean,
  searchFieldItems: CrudSearchFieldItem[],
) {
  return !isPlatformUser && hasRenderedEditableSearchControl(searchFieldItems);
}

export function canMutateCrudRecord(
  fields: CrudFieldConfig[],
  record: Record<string, any>,
  userInfo: unknown,
) {
  // 明确的只读标志属于记录本身，不能因页面省略 editable 控件而失效。
  const user = (userInfo || {}) as Record<string, unknown>;
  if (
    isSuperAdminUser(userInfo) ||
    user.topSuperAdmin === true ||
    user.isTopSuperAdmin === true
  )
    return true;
  if (record.editable === false) return false;

  // 未携带该能力的普通记录保持原有行为；已声明能力的记录仍要求显式可编辑。
  return !hasCrudEditableField(fields) || record.editable === true;
}
