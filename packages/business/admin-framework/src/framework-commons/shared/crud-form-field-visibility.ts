import type { CrudFieldConfig } from './types';

import { isSuperAdminUser } from './user-identity';

export type CrudFormMode = 'create' | 'edit';

export function isEditableControlField(field: Pick<CrudFieldConfig, 'key'>) {
  return field.key === 'editable';
}

export function shouldShowCrudFormField(
  field: CrudFieldConfig,
  mode: CrudFormMode,
  userInfo: unknown,
) {
  if (
    mode === 'edit' &&
    isEditableControlField(field) &&
    !isSuperAdminUser(userInfo)
  ) {
    return false;
  }

  return mode === 'edit' ? field.formEdit !== false : field.formCreate !== false;
}
