import type { CrudFieldConfig } from './types';

import { isEditableCrudFieldVisible } from './crud-editable-access';
import { isSuperAdminUser } from './user-identity';

export type CrudFormMode = 'create' | 'edit';

export function isCrudFormFieldConditionMet(
  field: CrudFieldConfig,
  formState: Record<string, any>,
) {
  return field.formVisibleWhen?.(formState) !== false;
}

export function shouldShowCrudFormField(
  field: CrudFieldConfig,
  mode: CrudFormMode,
  userInfo: unknown,
) {
  if (field.formVisibleForSuperAdmin && !isSuperAdminUser(userInfo)) {
    return false;
  }

  if (!isEditableCrudFieldVisible(field, userInfo)) {
    return false;
  }

  return mode === 'edit'
    ? field.formEdit !== false
    : field.formCreate !== false;
}

export function shouldSubmitCrudFormField(
  field: Pick<CrudFieldConfig, 'omitOnEdit'>,
  mode: CrudFormMode,
) {
  return mode !== 'edit' || field.omitOnEdit !== true;
}
