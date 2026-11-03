import { describe, expect, it } from 'vitest';

import { canShowPasswordResetAction } from '../password-reset-visibility';

describe('用户重置密码按钮', () => {
  it('普通用户即使能看到目标行也不展示入口', () => {
    expect(canShowPasswordResetAction({ id: 'user-1' }, 'user-2')).toBe(false);
  });

  it('管理员只能对其他用户看到入口', () => {
    expect(
      canShowPasswordResetAction({ id: 'admin', admin: true }, 'user-2'),
    ).toBe(true);
    expect(
      canShowPasswordResetAction({ id: 'admin', admin: true }, 'admin'),
    ).toBe(false);
  });

  it('识别租户管理员身份', () => {
    expect(
      canShowPasswordResetAction({ id: 'admin', tenantAdmin: true }, 'user-2'),
    ).toBe(true);
  });
});
