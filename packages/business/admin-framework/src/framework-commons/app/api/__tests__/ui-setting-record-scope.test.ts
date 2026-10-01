import { describe, expect, it } from 'vitest';

import { resolveUiSettingRecordScope } from '../ui-setting-record-scope';

describe('已加载界面设置的保存范围', () => {
  it('命中记录没有范围时不回填响应头中的运行时租户和域名', () => {
    expect(
      resolveUiSettingRecordScope({
        scope: { tenantId: 'runtime-tenant', domain: 'runtime.example.com' },
        setting: { code: '界面偏好设置', id: 'setting-1' },
      }),
    ).toEqual({});
  });

  it('仅回填记录实际保存的范围字段', () => {
    expect(
      resolveUiSettingRecordScope({
        scope: { tenantId: 'runtime-tenant', domain: 'runtime.example.com' },
        setting: {
          code: '界面偏好设置',
          id: 'setting-1',
          tenantId: 'saved-tenant',
          userType: 'Admin',
        },
      }),
    ).toEqual({ tenantId: 'saved-tenant', userType: 'Admin' });
  });

  it('未命中记录时不回填任何范围', () => {
    expect(
      resolveUiSettingRecordScope({
        scope: { tenantId: 'runtime-tenant', domain: 'runtime.example.com' },
        setting: null,
      }),
    ).toEqual({});
  });
});
