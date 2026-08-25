import { describe, expect, it } from 'vitest';

import {
  buildCrudDeleteParams,
  buildCrudRetrieveParams,
  omitNonPlatformTenantId,
} from '../crud-retrieve-context';

describe('CRUD detail request context', () => {
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
    expect(
      omitNonPlatformTenantId({ tenantId: 'tenant-1' }, true),
    ).toEqual({ tenantId: 'tenant-1' });
  });
});
