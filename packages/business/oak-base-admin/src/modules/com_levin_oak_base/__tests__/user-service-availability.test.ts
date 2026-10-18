import { describe, expect, it } from 'vitest';

import { UserService } from '../api/user-service';

describe('用户服务只登记已启用接口', () => {
  it('后端禁用全部批量操作时不再暴露批量导入或预取其字段策略', () => {
    const service = new UserService();
    for (const method of ['batchCreate', 'batchDelete', 'batchUpdate']) {
      expect(Reflect.get(service, method)).toBeUndefined();
    }
    for (const method of ['list', 'retrieve', 'update'])
      expect(Reflect.get(service, method)).toBeTypeOf('function');
  });
});
