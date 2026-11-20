import type { CrudFieldConfig } from './types';

import { isEditableCrudFieldVisible } from './crud-editable-access';
import { isSuperAdminUser } from './user-identity';

export type CrudFormMode = 'create' | 'edit';

/** 页面静态必填不能被视图配置或用户设置放宽。 */
export function isCrudFormFieldRequired(
  field: Pick<CrudFieldConfig, 'required' | 'requiredByView'>,
  mode: CrudFormMode,
) {
  return field.required === true || field.requiredByView?.[mode] === true;
}

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
