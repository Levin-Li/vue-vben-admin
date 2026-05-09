import { describe, expect, it } from 'vitest';

import {
  CRUD,
  getCrudListTableMeta,
  getCrudOpMeta,
  getResAuthorizeMeta,
  RES_AUTHORIZE_META_KEYS,
  ResAuthorize,
} from '../../../api-authorize';

class ExampleCrudApi {
  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.User',
  })
  list() {}

  @CRUD.Op()
  update() {}

  @CRUD.Op({
    confirmText: 'None',
    successAction: 'ShowForm',
  })
  viewForm() {}
}

const api = new ExampleCrudApi();

class ExampleAuthorizeApi {
  @ResAuthorize()
  defaults() {}

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-用户',
    res: '用户',
    action: '查询列表',
    ignored: true,
    onlyRequireAuthenticated: true,
    anyUserTypes: ['Admin'],
    confidentialLevel: 3,
    isAndMode: true,
    anyRoles: ['SA'],
    verifyExpression: "hasRole('SA')",
    remark: '角色支持 * 通配符',
  })
  full() {}
}

const authorizeApi = new ExampleAuthorizeApi();

describe('api CRUD annotation metadata', () => {
  it('copies ListTable metadata with Java annotation defaults', () => {
    expect(getCrudListTableMeta(api.list)).toEqual({
      desc: '',
      name: 'default',
      refEntityClass: 'com.levin.oak.base.entities.User',
      style: '',
      title: '',
      visibleOn: '',
    });
  });

  it('copies Op metadata with Java annotation defaults', () => {
    expect(getCrudOpMeta(api.update)).toMatchObject({
      action: 'Auto',
      confirmText: '',
      opRefTargetListName: 'default',
      opRefTargetType: 'SingleRow',
      successAction: 'Auto',
    });
  });

  it('keeps explicit Op overrides from controller annotations', () => {
    expect(getCrudOpMeta(api.viewForm)).toMatchObject({
      confirmText: 'None',
      successAction: 'ShowForm',
    });
  });
});

describe('api ResAuthorize annotation metadata', () => {
  it('keeps the same property list as com.levin.commons.rbac.ResAuthorize', () => {
    expect(RES_AUTHORIZE_META_KEYS).toEqual([
      'domain',
      'type',
      'res',
      'action',
      'ignored',
      'onlyRequireAuthenticated',
      'anyUserTypes',
      'confidentialLevel',
      'isAndMode',
      'anyRoles',
      'verifyExpression',
      'remark',
    ]);
  });

  it('copies ResAuthorize defaults from service-support 2.0.0-SNAPSHOT', () => {
    expect(getResAuthorizeMeta(authorizeApi.defaults)).toEqual({
      domain: '',
      type: '',
      res: '',
      action: '',
      ignored: false,
      onlyRequireAuthenticated: false,
      anyUserTypes: [],
      confidentialLevel: 0,
      isAndMode: false,
      anyRoles: [],
      verifyExpression: '',
      remark: '',
    });
  });

  it('supports every current backend ResAuthorize property', () => {
    expect(getResAuthorizeMeta(authorizeApi.full)).toEqual({
      domain: 'com.levin.oak.base',
      type: '系统数据-用户',
      res: '用户',
      action: '查询列表',
      ignored: true,
      onlyRequireAuthenticated: true,
      anyUserTypes: ['Admin'],
      confidentialLevel: 3,
      isAndMode: true,
      anyRoles: ['SA'],
      verifyExpression: "hasRole('SA')",
      remark: '角色支持 * 通配符',
    });
  });
});
