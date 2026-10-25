import { getResAuthorizeMeta } from '@levin/admin-framework';
import { describe, expect, it } from 'vitest';

import { tenantService } from '../api/tenant-service';

describe('平台租户操作权限', () => {
  it('只有平台超管可以编辑，平台管理员仍可创建和列表', () => {
    expect(
      getResAuthorizeMeta(
        tenantService.update as Parameters<typeof getResAuthorizeMeta>[0],
      ).anyRoles,
    ).toEqual(['R_PLATFORM_SA']);
    expect(
      getResAuthorizeMeta(
        tenantService.create as Parameters<typeof getResAuthorizeMeta>[0],
      ).anyRoles,
    ).toEqual(['R_PLATFORM_SA', 'R_PLATFORM_ADMIN']);
    expect(
      getResAuthorizeMeta(
        tenantService.list as Parameters<typeof getResAuthorizeMeta>[0],
      ).anyRoles,
    ).toEqual(['R_PLATFORM_SA', 'R_PLATFORM_ADMIN']);
  });
});
