import { describe, expect, it, vi } from 'vitest';

import {
  fixedCrudDataAttrTargets,
  standardCrudDataAttrTargets,
} from '../standard-crud-data-attr-targets';

describe('标准 CRUD 字段策略请求目标', () => {
  it('构建配置时不提前读取服务路径，实际读取时使用完整真实路径', () => {
    const buildRequestPath = vi.fn((path: string) => `/module/Entity/${path}`);
    const targets = standardCrudDataAttrTargets({ buildRequestPath });

    expect(buildRequestPath).not.toHaveBeenCalled();
    expect(targets.list).toEqual({
      method: 'GET',
      path: '/module/Entity/list',
    });
    expect(buildRequestPath).toHaveBeenCalledWith('list');
  });

  it('别名目标同样延后解析，缺少服务路径构造器时保持失败关闭', () => {
    const service = { buildRequestPath: undefined as never };
    const targets = fixedCrudDataAttrTargets(service, {
      list: { method: 'GET', path: 'search' },
    });

    expect(() => targets.list?.path).toThrow('无法确定属性权限对应的接口');
  });
});
