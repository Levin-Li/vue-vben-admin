import { describe, expect, it } from 'vitest';

import {
  CRUD,
  getCrudListTableMeta,
  getCrudOpMeta,
} from '../common/api-authorize';

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
