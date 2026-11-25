import { describe, expect, it } from 'vitest';

import { orgResponsibilityOptionsLoader } from '../../api-module';
import { orgPageCrudConfig } from '../config';

describe('orgPageCrudConfig', () => {
  it('queries field policies through the actual CRUD endpoints', () => {
    expect(orgPageCrudConfig.dataAttrTargets).toMatchObject({
      create: { method: 'POST', path: '/com.levin.oak.base/V1/api/Org/create' },
      update: { method: 'PUT', path: '/com.levin.oak.base/V1/api/Org/update' },
      delete: {
        method: 'DELETE',
        path: '/com.levin.oak.base/V1/api/Org/delete',
      },
      list: { method: 'GET', path: '/com.levin.oak.base/V1/api/Org/list' },
      retrieve: {
        method: 'GET',
        path: '/com.levin.oak.base/V1/api/Org/retrieve',
      },
    });
  });
  it('不再编辑或查询组织上的主体 ID', () => {
    expect(orgPageCrudConfig.fields.some((field) => field.key === 'legalSubjectId')).toBe(false);
  });

  it('exposes a responsible user selector for every organization node', () => {
    expect(orgPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'responsibleUserId',
          label: '组织负责人',
          search: true,
          type: 'user-tree-select',
        }),
      ]),
    );
  });

  it('组织类别可选且保留字典选择', () => {
    const category = orgPageCrudConfig.fields.find((field) => field.key === 'category');
    expect(category).toMatchObject({ type: 'select', loadOptions: expect.any(Function) });
    expect(category?.required).not.toBe(true);
  });

  it('清空已授权类别时提交空字符串且不补入未授权字段', async () => {
    const transform = orgPageCrudConfig.transformSubmit;
    if (!transform) throw new Error('缺少组织提交转换');
    expect(await transform({ category: null }, { id: '1' })).toEqual({ category: '' });
    expect(await transform({ category: '分销' }, { id: '1' })).toEqual({ category: '分销' });
    expect(await transform({ name: '组织' }, { id: '1' })).toEqual({ name: '组织' });
  });

  it('offers an optional dictionary-backed organization responsibility', () => {
    expect(orgPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'responsibility',
          label: '组织职能',
          loadOptions: orgResponsibilityOptionsLoader,
          search: true,
          table: true,
          type: 'select',
        }),
      ]),
    );
    expect(
      orgPageCrudConfig.fields.find(
        (field) => field.key === 'responsibility',
      ),
    ).not.toHaveProperty('required', true);
  });

  it('qualifies the organization type sort field after loading parents', () => {
    expect(orgPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'type', sortField: '_org.type' }),
      ]),
    );
  });

  it('uses the current organization alias for all default table sort fields', () => {
    expect(orgPageCrudConfig.sortFieldPrefix).toBe('_org.');
  });

  it('supports organization contact information', () => {
    expect(orgPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'contractPerson',
          layoutGroup: 'contact',
          table: true,
        }),
        expect.objectContaining({
          key: 'contractEmail',
          layoutGroup: 'contact',
          search: true,
          table: true,
        }),
        expect.objectContaining({
          key: 'contractPhone',
          layoutGroup: 'contact',
          table: true,
        }),
      ]),
    );
  });

  it('does not expose the removed organization area code', () => {
    expect(
      orgPageCrudConfig.fields.some((field) => field.key === 'areaCode'),
    ).toBe(false);
  });
});
