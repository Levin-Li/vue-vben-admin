import { describe, expect, it } from 'vitest';

import { ResAuthorize, Service } from '../../api-authorize';
import {
  buildApiMethodPermissions,
  buildCrudOperationPermissions,
  resolvePermissionType,
} from '../crud-permissions';

@Service({
  basePath: '/Demo',
  controllerClass: 'com.levin.oak.base.controller.BizDemoController',
  description: 'Demo管理',
  title: 'Demo',
  type: '专家数据-Demo',
})
class DemoService {
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '专家数据-',
    action: '查询列表',
  })
  list() {}

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '专家数据-Demo',
    action: '查看详情',
  })
  retrieve() {}
}

const demoService = new DemoService();

describe('crud permission metadata', () => {
  it('appends Service.title as @Tag.name when ResAuthorize.type ends with dash', () => {
    expect(buildApiMethodPermissions(demoService, 'list')).toContain(
      'com.levin.oak.base:专家数据-Demo::查询列表',
    );
  });

  it('keeps complete ResAuthorize.type unchanged', () => {
    expect(buildApiMethodPermissions(demoService, 'retrieve')).toContain(
      'com.levin.oak.base:专家数据-Demo::查看详情',
    );
  });

  it('uses API method ResAuthorize metadata for built-in CRUD operations', () => {
    expect(
      buildCrudOperationPermissions(
        {
          apiBase: '/WrongPageName',
          apiService: demoService,
          fields: [],
          title: '错误页面标题',
        },
        'list',
      ),
    ).toContain('com.levin.oak.base:专家数据-Demo::查询列表');
  });

  it('falls back to Service.type when method type is empty', () => {
    expect(
      resolvePermissionType('', {
        title: 'Demo',
        type: '专家数据-Demo',
      }),
    ).toBe('专家数据-Demo');
  });
});
