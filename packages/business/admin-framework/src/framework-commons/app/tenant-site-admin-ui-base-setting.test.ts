import { describe, expect, it } from 'vitest';

import { emitApiRequestEvent } from './api/request-events';
import {
  getCurrentTenantSiteInfo,
  registerTenantSiteAdminUiBaseSettingListener,
} from './tenant-site-admin-ui-base-setting';

describe('tenant site context listener', () => {
  it('caches a successful tenant-site response received by the request event bus', () => {
    const unsubscribe = registerTenantSiteAdminUiBaseSettingListener();
    const siteInfo = {
      domain: 'tenant.example.test',
      tenantId: 'tenant-1',
    };

    emitApiRequestEvent({
      config: { url: '/com.levin.oak.base/V1/api/rbac/tenantSiteInfo' },
      data: siteInfo,
    });
    unsubscribe();

    expect(getCurrentTenantSiteInfo()).toEqual(siteInfo);
  });
});
