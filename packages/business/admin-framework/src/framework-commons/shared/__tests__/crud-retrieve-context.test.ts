import { describe, expect, it } from 'vitest';

import {
  buildCrudDeleteParams,
  buildCrudRetrieveParams,
  omitNonPlatformTenantId,
  withCrudUpdateTenantContext,
} from '../crud-retrieve-context';

describe('更新与详情请求上下文', () => {
  const record = {
    id: 'record-1',
    orgId: 'org-1',
    tenantId: 'tenant-1',
  };

  it('never includes the list tenant in detail requests', () => {
    expect(buildCrudRetrieveParams(record, 'id')).toEqual({
      id: 'record-1',
      orgId: 'org-1',
    });
  });

  it('uses only the ID for delete requests', () => {
    expect(buildCrudDeleteParams(record, 'id')).toEqual({
      id: 'record-1',
    });
  });

  it('removes tenant context from non-platform create and update payloads', () => {
    expect(
      omitNonPlatformTenantId(
        { name: '名称', orgId: 'org-1', tenantId: 'tenant-1' },
        false,
      ),
    ).toEqual({ name: '名称', orgId: 'org-1' });

    expect(
      omitNonPlatformTenantId(
        { id: 'record-1', optimisticLock: 2, tenantId: 'tenant-1' },
        false,
      ),
    ).toEqual({ id: 'record-1', optimisticLock: 2 });
  });

  it('preserves tenant context for platform users', () => {
    expect(omitNonPlatformTenantId({ tenantId: 'tenant-1' }, true)).toEqual({
      tenantId: 'tenant-1',
    });
  });
  it('更新定位只补原记录租户，保留显式值且不猜测缺失上下文', () => {
    expect(
      withCrudUpdateTenantContext({ id: '1' }, { tenantId: 'original' }),
    ).toEqual({ id: '1', tenantId: 'original' });
    expect(
      withCrudUpdateTenantContext(
        { id: '1', tenantId: 'explicit' },
        { tenantId: 'original' },
      ),
    ).toEqual({ id: '1', tenantId: 'explicit' });
    expect(
      withCrudUpdateTenantContext(
        { id: '1', tenantId: null },
        { tenantId: 'original' },
      ),
    ).toEqual({ id: '1', tenantId: null });
    expect(withCrudUpdateTenantContext({ id: '1' }, {})).toEqual({ id: '1' });
    expect(
      withCrudUpdateTenantContext({ id: '1' }, { tenantId: null }),
    ).toEqual({ id: '1' });
  });
});
