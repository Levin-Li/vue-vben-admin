import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();

vi.mock('../request', () => ({ requestClient: { get } }));

describe('UiSetting runtime cache', () => {
  beforeEach(async () => {
    get.mockReset();
    const module = await import('../ui-setting-runtime');
    module.clearUiSettingRuntimeCache();
  });

  it('treats an ApiResp null data payload as a cacheable no-setting result', async () => {
    get.mockResolvedValue({ data: { data: null }, headers: {} });
    const { resolveUiSettingRuntime } = await import('../ui-setting-runtime');

    expect(await resolveUiSettingRuntime('/Tenant', 'tenant:site')).toBeNull();
    expect(await resolveUiSettingRuntime('/Tenant', 'tenant:site')).toBeNull();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('uses the ApiResp data record rather than the response envelope', async () => {
    get.mockResolvedValue({
      data: { data: { code: '/Tenant', id: 'setting-1' } },
      headers: { 'x-ui-setting-domain': 'tenant.example.test', 'x-ui-setting-tenant-id': 'tenant-1' },
    });
    const { resolveUiSettingRuntime, resolveUiSettingRuntimeWithScope } = await import('../ui-setting-runtime');

    await expect(resolveUiSettingRuntime('/Tenant', 'tenant:site')).resolves.toMatchObject({
      code: '/Tenant',
      id: 'setting-1',
    });
    await expect(resolveUiSettingRuntimeWithScope('/Tenant', 'tenant:site')).resolves.toMatchObject({
      scope: { domain: 'tenant.example.test', tenantId: 'tenant-1' },
    });
  });
});
