import { describe, expect, it, vi } from 'vitest';

import { oakBaseAdminBackendRouteMappings } from '../../../backend-route-mappings';
import { oakBaseAdminPageMap } from '../../../page-map';
import { getOpenAreaDisplayNames, openAreaPageCrudConfig } from '../config';

vi.mock('../../../api/open-area-service', () => ({
  openAreaService: {},
}));

vi.mock('../../api-module', () => ({
  DEFAULT_CRUD_MODAL_WIDTH: '80%',
  tenantOptionsLoader: async () => [],
}));

describe('openAreaPageCrudConfig', () => {
  it('uses the OpenArea CRUD API and exposes the scope fields', () => {
    expect(openAreaPageCrudConfig).toMatchObject({
      apiBase: '/OpenArea',
      title: '开通区域',
    });
    expect(
      openAreaPageCrudConfig.fields.find((field) => field.key === 'tenantId'),
    ).toMatchObject({
      type: 'select',
      visibleForPlatformUser: true,
    });
    expect(
      openAreaPageCrudConfig.fields.find((field) => field.key === 'orgId'),
    ).toMatchObject({
      type: 'org-tree-select',
    });
  });

  it('renders the open-area list as Chinese labels with a tooltip', () => {
    expect(
      openAreaPageCrudConfig.fields.find(
        (field) => field.key === 'areaCodeList',
      ),
    ).toMatchObject({
      cellTooltip: true,
      form: false,
      label: '已开通区域',
      table: true,
      type: 'tags',
    });
  });

  it('maps area codes to readable names and marks empty lists as unrestricted', () => {
    expect(getOpenAreaDisplayNames({ areaCodeList: ['330100'] })).toEqual([
      '浙江省 / 杭州市',
    ]);
    expect(getOpenAreaDisplayNames({ areaCodeList: [] })).toEqual([
      '未限制（全国）',
    ]);
  });

  it('registers the OpenArea frontend route mapping', () => {
    expect(oakBaseAdminBackendRouteMappings).toContainEqual(
      expect.objectContaining({
        path: '/clob/V1/OpenArea',
        sourceFilePath: 'modules/com_levin_oak_base/views/open-area/index.vue',
      }),
    );
    expect(
      oakBaseAdminPageMap['/system/com_levin_oak_base/open-area/index.vue'],
    ).toBeTypeOf('function');
  });
});
