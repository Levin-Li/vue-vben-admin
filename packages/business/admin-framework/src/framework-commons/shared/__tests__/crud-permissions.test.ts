import { describe, expect, it } from 'vitest';

import { CRUD, ResAuthorize, Service } from '../../api-authorize';
import { buildAdminPageOperations } from '../../page-operation-metadata';
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
  @ResAuthorize({ onlyRequireAuthenticated: true })
  authenticated() {}

  @ResAuthorize({})
  empty() {}

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '专家数据-',
    action: '查询列表',
  })
  list() {}

  @ResAuthorize({ ignored: true, action: '公开访问' })
  publicAction() {}

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '专家数据-Demo',
    action: '查看详情',
  })
  retrieve() {}

  @ResAuthorize({ anyRoles: ['R_ADMIN'] })
  roleOnly() {}

  undecorated() {}

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '专家数据-',
    action: '更新',
  })
  update() {}
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

describe('资源权限不混入接口路径', () => {
  it('页面上传和CRUD使用相同的显式资源表达式', () => {
    expect(buildApiMethodPermissions(demoService, 'retrieve')).toEqual([
      'com.levin.oak.base:专家数据-Demo::查看详情',
    ]);
    expect(
      buildAdminPageOperations(demoService)[0]?.requireAuthorizations,
    ).toEqual(['com.levin.oak.base:专家数据-Demo::更新']);
  });

  it.each([
    'missing',
    'undecorated',
    'empty',
    'roleOnly',
    'authenticated',
    'publicAction',
  ])('%s不生成猜测权限', (method) => {
    expect(buildApiMethodPermissions(demoService, method)).toEqual([]);
  });

  it('缺少API权限声明时不从页面名称或配置补出资源', () => {
    expect(
      buildCrudOperationPermissions(
        {
          apiBase: '/Demo',
          title: 'Demo管理',
          fields: [],
          permissionDomain: 'domain',
          permissionResourceName: 'Demo',
        },
        'delete',
      ),
    ).toEqual([]);
    expect(buildApiMethodPermissions(null, 'delete')).toEqual([]);
  });
});
