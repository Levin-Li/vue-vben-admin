import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { describe, expect, it } from 'vitest';

import { electronicInvoiceProviderConnectionService } from '../../../api/electronic-invoice-provider-connection-service';

describe('电子发票授权展示名称', () => {
  it('保留已有授权资源和动作标识', () => {
    expect(
      buildApiMethodPermissions(
        electronicInvoiceProviderConnectionService,
        'create',
      ),
    ).toEqual([
      'com.levin.oak.base:系统数据-电子发票供应商连接::开通供应商连接',
    ]);
    expect(
      buildApiMethodPermissions(
        electronicInvoiceProviderConnectionService,
        'completeAuthorization',
      ),
    ).toEqual(['com.levin.oak.base:系统数据-电子发票供应商连接::确认商户授权']);
  });
});
