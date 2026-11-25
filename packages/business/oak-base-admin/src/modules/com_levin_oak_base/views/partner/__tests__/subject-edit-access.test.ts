import { describe, expect, it } from 'vitest';

import { canEditSubject } from '../subject-edit-access';

describe('主体信息弹窗编辑权限', () => {
  const certified = { certificationStatus: 'Certified', tenantId: 'tenant-1' };

  it('认证成功后普通用户和其他租户管理员只能查看', () => {
    expect(canEditSubject(certified, { tenantId: 'tenant-1' }, true)).toBe(
      false,
    );
    expect(
      canEditSubject(
        certified,
        { tenantId: 'tenant-2', tenantAdmin: true },
        true,
      ),
    ).toBe(false);
  });

  it('仅本租户管理员或平台超管可编辑认证主体，仍需更新权限', () => {
    expect(
      canEditSubject(
        certified,
        { tenantId: 'tenant-1', tenantAdmin: true },
        true,
      ),
    ).toBe(true);
    expect(
      canEditSubject(
        certified,
        { tenantId: 'tenant-1', tenantAdmin: true },
        false,
      ),
    ).toBe(false);
    expect(
      canEditSubject(
        certified,
        { platformUser: true, topSuperAdmin: true },
        true,
      ),
    ).toBe(true);
  });

  it('认证状态未知时不提供提交，未认证主体仍需要更新权限', () => {
    expect(canEditSubject({ tenantId: 'tenant-1' }, {}, true)).toBe(false);
    expect(canEditSubject({ certificationStatus: 'Draft' }, {}, true)).toBe(
      true,
    );
    expect(canEditSubject({ certificationStatus: 'Draft' }, {}, false)).toBe(
      false,
    );
  });
});
