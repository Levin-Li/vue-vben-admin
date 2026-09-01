import type { TenantSettingItem } from './setting-for-tenant/setting-for-tenant';

import { serializeSettingValueFromEditor } from './setting-for-tenant/setting-for-tenant';

export function transformSettingCrudSubmit(
  values: Record<string, any>,
) {
  const payload = { ...values };

  payload.valueContent = serializeSettingValueFromEditor(
    payload as TenantSettingItem,
    values.valueContent,
  );

  return payload;
}
