import { describe, expect, it, vi } from 'vitest';

const { tenantSiteDomainOptionsLoader } = vi.hoisted(() => ({
  tenantSiteDomainOptionsLoader: vi.fn(async () => []),
}));

vi.mock('../../../api/tenant-custom-menu-service', () => ({
  tenantCustomMenuService: {},
}));

vi.mock('../../api-module', () => ({
  DEFAULT_CRUD_MODAL_WIDTH: '80%',
  tenantOptionsLoader: async () => [],
  tenantSiteDomainOptionsLoader,
}));

import { tenantCustomMenuPageCrudConfig } from '../config';

describe('tenant custom menu page config', () => {
  it('offers tenant-site domains while retaining direct domain input', () => {
    const field = tenantCustomMenuPageCrudConfig.fields.find(
      (item) => item.key === 'domain',
    );

    expect(field).toMatchObject({
      allowInput: true,
      help: expect.stringContaining('租户站点'),
      key: 'domain',
      loadOptions: tenantSiteDomainOptionsLoader,
      placeholder: '输入或从租户站点选择域名',
      remoteSearch: true,
      search: true,
      table: true,
      type: 'select',
    });
  });
});
