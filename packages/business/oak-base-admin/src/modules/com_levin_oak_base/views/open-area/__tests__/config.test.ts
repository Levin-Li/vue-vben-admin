import { describe, expect, it, vi } from 'vitest';

import { oakBaseAdminBackendRouteMappings } from '../../../backend-route-mappings';
import { oakBaseAdminPageMap } from '../../../page-map';
import { openAreaPageCrudConfig } from '../config';

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

  it('keeps the area-code list as a JSON array field', () => {
    expect(
      openAreaPageCrudConfig.fields.find(
        (field) => field.key === 'areaCodeList',
      ),
    ).toMatchObject({
      type: 'json',
    });
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
