import type { TenantSettingItem } from './setting-for-tenant/setting-for-tenant';

import { serializeSettingValueFromEditor } from './setting-for-tenant/setting-for-tenant';

export function transformSettingCrudSubmit(
  values: Record<string, any>,
  editingRecord: null | Record<string, any>,
) {
  const payload = { ...values };

  payload.valueContent = serializeSettingValueFromEditor(
    payload as TenantSettingItem,
    values.valueContent,
  );

  if (editingRecord) {
    const forceUpdateFields = Array.isArray(payload.forceUpdateFields)
      ? payload.forceUpdateFields
      : [];

    payload.forceUpdateFields = Array.from(
      new Set([...forceUpdateFields, 'valueContent']),
    );
  }

  return payload;
}
