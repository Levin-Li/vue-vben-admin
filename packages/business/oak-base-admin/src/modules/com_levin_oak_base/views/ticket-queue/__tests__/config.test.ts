import { getDefaultVisibleRoleCodes } from '@levin/admin-framework/framework-commons/shared/crud-page-display';
import { describe, expect, it } from 'vitest';

import { createTicketQueueCrudConfig } from '../config';

describe('工单受理组织筛选', () => {
  it('允许普通受理员工看到授权组织选择器', () => {
    const config = createTicketQueueCrudConfig({ apiService: {} });
    const field = config.fields.find((item) => item.key === 'orgId');
    expect(field).toBeDefined();
    expect(field?.type).toBe('org-tree-select');
    expect(field?.search).toBe(true);
    if (!field) throw new Error('缺少受理组织字段');
    expect(getDefaultVisibleRoleCodes(field)).toEqual([]);
    expect(config.dataAttrConditionKeys).toContain('orgId');
  });
});
