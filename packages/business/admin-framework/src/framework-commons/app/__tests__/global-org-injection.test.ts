import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyCurrentGlobalUserOrgContextToParams as inject,
  setCurrentGlobalOrgId,
  setCurrentGlobalUserOrgRecord,
} from '../global-org-context-state';

describe('全局参数条件注入', () => {
  beforeEach(() => {
    setCurrentGlobalUserOrgRecord({
      id: 'u',
      kind: 'user',
      name: '用户',
      orgId: 'o',
    });
  });

  it('补充 null 和 undefined，保持原对象不变', () => {
    const params = { orgId: null, orgIdList: undefined, pageIndex: 2 };
    expect(inject(params)).toEqual({
      orgId: 'o',
      orgIdList: ['o'],
      ownerId: 'u',
      pageIndex: 2,
    });
    expect(params).toEqual({ orgId: null, orgIdList: undefined, pageIndex: 2 });
  });

  it('保留空字符串和空数组', () => {
    expect(inject({ orgId: '', orgIdList: [], ownerId: '' })).toEqual({
      orgId: '',
      orgIdList: [],
      ownerId: '',
    });
  });

  it('非强制且非必填时不补值', () => {
    expect(inject(undefined, { isRequired: false })).toBeUndefined();
  });

  it('强制且非必填时仍注入可用值', () => {
    expect(
      inject({ ownerId: 'old' }, { isOverride: true, isRequired: false }),
    ).toEqual({ orgId: 'o', orgIdList: ['o'], ownerId: 'u' });
  });

  it('条件函数按账号、字段和原始请求判断', () => {
    const isOverride = vi.fn(
      ({ user, fieldName, params, request }) =>
        user.superAdmin === true &&
        fieldName === 'ownerId' &&
        params.orgId === 'other' &&
        request.method === 'GET',
    );
    expect(
      inject(
        { orgId: 'other', orgIdList: ['other'], ownerId: 'old' },
        {
          isOverride,
          user: { superAdmin: true },
          request: { method: 'GET' },
        },
      ),
    ).toEqual({ orgId: 'other', orgIdList: ['other'], ownerId: 'u' });
    expect(isOverride).toHaveBeenCalledTimes(3);
  });

  it('受限表达式可以按字段决定是否注入', () => {
    expect(
      inject(
        { orgId: 'other' },
        {
          isOverride: "user.superAdmin === true && fieldName === 'ownerId'",
          isRequired: "fieldName === 'ownerId'",
          user: { superAdmin: true },
        },
      ),
    ).toEqual({ orgId: 'other', ownerId: 'u' });
  });

  it('选择组织时不默认要求拥有者，显式要求但无值时失败', () => {
    setCurrentGlobalOrgId('o');
    expect(inject(undefined)).toEqual({ orgId: 'o', orgIdList: ['o'] });
    expect(() => inject(undefined, { isRequired: true })).toThrow('ownerId');
    expect(inject({ ownerId: 'old' }, { isRequired: true })).toEqual({
      orgId: 'o',
      orgIdList: ['o'],
      ownerId: 'old',
    });
  });

  it('全局无对应值且非必填时保留原值', () => {
    setCurrentGlobalUserOrgRecord({ id: 'u', kind: 'user', name: '用户' });
    expect(
      inject({ orgId: 'other', orgIdList: ['other'] }, { isOverride: true }),
    ).toEqual({ orgId: 'other', orgIdList: ['other'], ownerId: 'u' });
  });

  it.each(['user.run()', 'user.constructor', "'true'"])(
    '拒绝非法表达式或非布尔结果 %s',
    (isOverride) => {
      expect(() => inject(undefined, { isOverride })).toThrow();
    },
  );

  it('完全跳过或无选择时不执行规则', () => {
    const isOverride = vi.fn(() => {
      throw new Error('不应执行');
    });
    const params = { ownerId: 'old' };
    expect(inject(params, { skip: true, isOverride })).toBe(params);
    setCurrentGlobalOrgId(undefined);
    expect(inject(params, { isOverride })).toBe(params);
    expect(isOverride).not.toHaveBeenCalled();
  });
  it('字段独立补值，保留原组织但补充全局组织列表', () => {
    expect(inject({ orgId: 'other' })).toEqual({
      orgId: 'other',
      orgIdList: ['o'],
      ownerId: 'u',
    });
  });

  it('强制且必填时即使有原值，来源缺失仍报错', () => {
    setCurrentGlobalOrgId('o');
    expect(() =>
      inject({ ownerId: 'old' }, { isOverride: true, isRequired: true }),
    ).toThrow('ownerId');
  });

  it('拒绝运行时误传的异步条件', () => {
    const isOverride: any = async () => true;
    expect(() => inject(undefined, { isOverride })).toThrow('布尔值');
  });
});
