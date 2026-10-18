import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { describe, expect, it } from 'vitest';

import { electronicContractService } from '../../../api/electronic-contract-service';

describe('电子合同签署入口权限', () => {
  it('uses the dedicated action instead of ordinary detail access', () => {
    expect(
      buildApiMethodPermissions(electronicContractService, 'signingEntry'),
    ).toEqual(['com.levin.oak.base:业务数据:电子合同:领取签署入口']);
  });
});
