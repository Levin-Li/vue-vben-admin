import type { CrudFieldConfig } from './types';

export function isCrudBooleanField(field: CrudFieldConfig | undefined) {
  return field?.type === 'switch' || field?.valueType === 'boolean';
}

export function isCrudEnableBooleanField(field: CrudFieldConfig | undefined) {
  if (!isCrudBooleanField(field)) {
    return false;
  }

  return /^(is)?(enable|enabled)$/i.test(field.key) || /启用/.test(field.label);
}

export function getCrudBooleanDisplayText(
  field: CrudFieldConfig | undefined,
  value: unknown,
) {
  if (!isCrudBooleanField(field) || typeof value !== 'boolean') {
    return undefined;
  }

  if (isCrudEnableBooleanField(field)) {
    return value ? '启用' : '禁用';
  }

  return value ? '是' : '否';
}

export function getCrudBooleanTagColor(value: boolean) {
  return value ? 'green' : 'default';
}
