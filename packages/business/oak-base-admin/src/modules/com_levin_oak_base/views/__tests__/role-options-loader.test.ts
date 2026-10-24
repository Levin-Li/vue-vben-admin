import { roleOptionsLoader as sharedRoleOptionsLoader } from '@levin/admin-framework/framework-commons/shared/config-helpers';
import { describe, expect, it } from 'vitest';

import { roleOptionsLoader } from '../api-module';

// 业务配置和框架抽屉使用同一加载入口，避免同页相同角色查询各自发起请求。
describe('业务页面角色选项入口', () => {
  it('复用框架按页面和查询条件去重的加载器', () => {
    expect(roleOptionsLoader).toBe(sharedRoleOptionsLoader);
  });
});
