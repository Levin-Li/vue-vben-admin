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
  return (
    isSuperAdminUser(userInfo) ||
    !hasCrudEditableField(fields) ||
    record.editable === true
  );
}
