import { describe, expect, it } from 'vitest';

import { isPlatformUser } from '../user-identity';

describe('平台身份识别', () => {
  it.each([
    { platformUser: true },
    { isPlatformUser: true },
    { platformAdmin: true },
    { isPlatformAdmin: true },
    { roleList: ['R_PLATFORM_ADMIN'] },
    { roles: [{ code: 'R_PLATFORM_REVIEWER' }] },
    { roleList: [{ roleCode: 'R_PLATFORM_OPERATOR' }] },
    { superAdmin: true },
  ])('识别平台身份 %o', (user) => {
    expect(isPlatformUser(user)).toBe(true);
  });

  it.each([
    {},
    { admin: true },
    { tenantAdmin: true },
    { roleList: ['R_TENANT_ADMIN'] },
    { roles: [{ name: 'R_PLATFORM_ADMIN' }] },
    { platformUser: false, platformAdmin: true },
    { isPlatformUser: false, roles: ['R_PLATFORM_ADMIN'] },
  ])('不将普通用户或明确的非平台身份当作平台用户 %o', (user) => {
    expect(isPlatformUser(user)).toBe(false);
  });
});
