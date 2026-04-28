import { describe, expect, it } from 'vitest';

import { ResAuthorize, Service } from '#/api/common/api-authorize';

import {
  buildApiMethodPermissions,
  buildCrudOperationPermissions,
} from '../crud-permissions';

@Service({
  basePath: '/Example',
  type: '专家数据-示例',
})
class ExampleService {
  @ResAuthorize({
    action: '发布上线',
    domain: 'com.levin.oak.base',
  })
  publish() {}

  @ResAuthorize({
    action: '查询列表',
    domain: 'com.levin.oak.base',
    onlyRequireAuthenticated: true,
  })
  list() {}
}

const exampleService = new ExampleService();

describe('crud-permissions', () => {
  it('builds RBAC expression and URL candidates for an update operation', () => {
    expect(
      buildCrudOperationPermissions(
        {
          apiBase: '/Role',
          fields: [],
          permissionResourceName: '角色',
          title: '角色管理',
        },
        'update',
      ),
    ).toEqual(['com.levin.oak.base:系统数据-角色::修改', '/Role/update']);
  });

  it('derives resource name from title when explicit resource name is absent', () => {
    expect(
      buildCrudOperationPermissions(
        {
          apiBase: '/User',
          fields: [],
          title: '用户管理',
        },
        'delete',
      ),
    ).toEqual(['com.levin.oak.base:系统数据-用户::删除', '/User/delete']);
  });

  it('builds permissions from API method metadata', () => {
    expect(buildApiMethodPermissions(exampleService, 'publish')).toEqual([
      'com.levin.oak.base:专家数据-示例::发布上线',
      '/Example/publish',
    ]);
  });

  it('returns no permissions for only-authenticated API methods', () => {
    expect(buildApiMethodPermissions(exampleService, 'list')).toEqual([]);
  });
});
