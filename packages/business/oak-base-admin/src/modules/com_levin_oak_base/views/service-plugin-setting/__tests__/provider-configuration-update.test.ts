import { describe, expect, it } from 'vitest';

import { buildProviderConfigurationUpdate } from '../../provider-configuration-update';

// 请求只携带记录真实范围，切换登录主体不会扩展租户权限。
describe('供应商配置更新范围', () => {
  const existing = { FEISHU: { clientId: 'old' } };
  const record = {
    id: 'setting-id',
    optimisticLock: 4,
    servicePluginProviderCode: 'FEISHU',
    tenantId: 'tenant-a',
    value: existing,
  };

  it('平台主体编辑租户记录时携带实际租户且只更新本行供应商', () => {
    const update = buildProviderConfigurationUpdate(
      record,
      'FEISHU',
      { clientId: 'new' },
      true,
    );
    expect(update).toEqual({
      autoForceUpdateField: false,
      forceUpdateFields: ['value'],
      id: 'setting-id',
      optimisticLock: 4,
      tenantId: 'tenant-a',
      value: { FEISHU: { clientId: 'new' } },
    });
    expect(record.value).toEqual(existing);
  });

  it('租户主体不发送受保护的 tenantId，保留 ID 和乐观锁', () => {
    const update = buildProviderConfigurationUpdate(
      record,
      'FEISHU',
      {},
      false,
    );
    expect(Object.hasOwn(update, 'tenantId')).toBe(false);
    expect(update.id).toBe('setting-id');
    expect(update.optimisticLock).toBe(4);
    expect(update.value).toEqual({ FEISHU: {} });
  });

  it('平台主体编辑全局记录时保留实际空租户，不能借用当前租户', () => {
    const update = buildProviderConfigurationUpdate(
      { ...record, tenantId: null },
      'FEISHU',
      {},
      true,
    );
    expect(update.tenantId).toBeNull();
    const noTenant = buildProviderConfigurationUpdate(
      { id: 'global-id', servicePluginProviderCode: 'FEISHU' },
      'FEISHU',
      {},
      true,
    );
    expect(noTenant.tenantId).toBeUndefined();
  });
});
