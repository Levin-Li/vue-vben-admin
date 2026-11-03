import { describe, expect, it } from 'vitest';

import {
  classifyLoginAccount,
  mapBriefLoginAccount,
  preferredLoginAccount,
} from '../brief-account';

describe('组织与用户简要表单登录账号', () => {
  it('将邮箱、手机号和普通登录名映射到各自字段', () => {
    expect(classifyLoginAccount(' a@example.com ')).toEqual({
      field: 'email',
      value: 'a@example.com',
    });
    expect(classifyLoginAccount('13800138000')).toEqual({
      field: 'telephone',
      value: '13800138000',
    });
    expect(classifyLoginAccount('team_admin')).toEqual({
      field: 'loginName',
      value: 'team_admin',
    });
  });

  it('拒绝明显但无效的邮箱和手机号', () => {
    expect(() => classifyLoginAccount('a@invalid')).toThrow('邮箱格式错误');
    expect(() => classifyLoginAccount('11111111111')).toThrow('手机号格式错误');
  });

  it('编辑时只替换当前主要登录标识并保留其它登录方式', () => {
    const original = {
      loginName: 'old_user',
      telephone: '13800138000',
    };
    expect(preferredLoginAccount(original)).toBe('old_user');
    expect(
      mapBriefLoginAccount('new@example.com', original, original).values,
    ).toEqual({
      email: 'new@example.com',
      loginName: null,
      telephone: '13800138000',
    });
  });

  it('目标登录方式已有不同值时拒绝简要覆盖', () => {
    const original = {
      email: 'other@example.com',
      loginName: 'old_user',
    };
    expect(() =>
      mapBriefLoginAccount('new@example.com', original, original),
    ).toThrow('目标登录方式已有不同账号');
  });
});
