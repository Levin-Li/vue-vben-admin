import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyCurrentGlobalOrgIdToParams,
  applyCurrentGlobalUserOrgContextToParams as inject,
  setCurrentGlobalOrgId,
  setCurrentGlobalUserOrgRecord,
  setGlobalUserOrgContextEnabled,
} from '../global-org-context-state';

describe('全局上下文的遗留参数兼容入口', () => {
  beforeEach(() => {
    setGlobalUserOrgContextEnabled(true);
    setCurrentGlobalUserOrgRecord({
      id: 'u',
      kind: 'user',
      name: '用户',
      orgId: 'o',
    });
  });

  afterEach(() => setGlobalUserOrgContextEnabled(false));

  // 上下文只走 Header，显式条件与空值均不得被改写或复制。
  it.each([
    { orgId: null, orgIdList: undefined, pageIndex: 2 },
    { orgId: '', orgIdList: [], ownerId: '' },
    { orgId: 'other', orgIdList: ['other'], ownerId: 'old' },
    undefined,
  ])('保持原业务参数引用和值：%j', (params) => {
    const snapshot = params && structuredClone(params);
    expect(inject(params)).toBe(params);
    expect(applyCurrentGlobalOrgIdToParams(params)).toBe(params);
    expect(params).toEqual(snapshot);
  });

  it('旧覆盖与必填配置不能向空请求添加范围', () => {
    for (const isOverride of [false, true]) {
      for (const isRequired of [false, true]) {
        expect(inject(undefined, { isOverride, isRequired })).toBeUndefined();
      }
    }
    setCurrentGlobalOrgId('o');
    const params = Object.freeze({ ownerId: 'old' });
    expect(inject(params, { isOverride: true, isRequired: true })).toBe(params);
  });

  it('不执行遗留条件函数或表达式', () => {
    const condition = vi.fn(() => {
      throw new Error('不得执行旧参数注入条件');
    });
    const params = Object.freeze({ orgId: 'explicit' });
    expect(
      inject(params, { isOverride: condition, isRequired: condition }),
    ).toBe(params);
    expect(condition).not.toHaveBeenCalled();
    for (const expression of ['user.run()', 'user.constructor', "'true'"]) {
      expect(
        inject(params, { isOverride: expression, isRequired: expression }),
      ).toBe(params);
    }
  });

  it('关闭上下文、清空选择及显式跳过时仍保持业务参数', () => {
    const params = { ownerId: 'old' };
    expect(inject(params, { skip: true })).toBe(params);
    setCurrentGlobalOrgId(undefined);
    expect(inject(params)).toBe(params);
    setGlobalUserOrgContextEnabled(false);
    expect(inject(params)).toBe(params);
  });
});
