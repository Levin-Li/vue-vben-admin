import { describe, expect, it } from 'vitest';

import { oakBaseAdminBackendRouteMappings } from '../../../backend-route-mappings';
import { oakBaseAdminPageMap } from '../../../page-map';

describe('领域模型通用记录页', () => {
  it('只登记一个稳定页面映射，生成菜单可按 viewPath 复用', () => {
    const mapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.resource === 'DataModelRecord',
    );
    expect(mapping).toMatchObject({
      path: '/clob/V1/DataModelRecord',
      onlyRequireAuthenticated: true,
      viewPath: '/system/com_levin_oak_base/data-model-record-page/index.vue',
      sourceFilePath:
        'modules/com_levin_oak_base/views/data-model-record-page/index.vue',
    });
    expect(mapping).toBeDefined();
    expect(oakBaseAdminPageMap[mapping?.viewPath || '']).toBeTypeOf('function');
    expect(mapping?.operations?.map((operation) => operation.opName)).toContain(
      'createRecord',
    );
    expect(mapping?.operations?.map((operation) => operation.opName)).toContain(
      'deleteRecord',
    );
    expect(
      oakBaseAdminBackendRouteMappings.filter(
        (item) => item.resource === 'DataModelRecord',
      ),
    ).toHaveLength(1);
  });
});
