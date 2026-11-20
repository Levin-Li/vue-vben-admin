import { describe, expect, it, vi } from 'vitest';

import {
  createSessionRecheck,
  createSessionRecovery,
  isExplicitSessionExpired,
} from '../auth-session-recheck';

const error = (status: number, msg: string) => ({
  response: { status, data: { msg } },
});
describe('业务401会话复核', () => {
  it('本人信息 401 表示失效，已知上下文故障除外', () => {
    expect(isExplicitSessionExpired(error(401, '未登录：token 已过期'))).toBe(
      true,
    );
    expect(
      isExplicitSessionExpired(error(401, '认证异常：Not logged in')),
    ).toBe(true);
    expect(
      isExplicitSessionExpired(
        error(401, '认证异常：SaTokenContext 上下文尚未初始化'),
      ),
    ).toBe(false);
    expect(isExplicitSessionExpired(error(403, '未登录：拒绝'))).toBe(false);
    expect(isExplicitSessionExpired(error(401, ''))).toBe(true);
    expect(
      isExplicitSessionExpired({
        response: { status: 401, data: 'SaTokenContext 上下文尚未初始化' },
      }),
    ).toBe(false);
    expect(
      isExplicitSessionExpired(
        error(401, '未登录：SaTokenContext 上下文尚未初始化'),
      ),
    ).toBe(false);
  });
  it('用户正常及探测故障都不清除会话', async () => {
    const reauthenticate = vi.fn();
    for (const probe of [
      vi.fn().mockResolvedValue({}),
      vi.fn().mockRejectedValue(error(503, '故障')),
      vi.fn().mockRejectedValue(error(401, '上下文故障')),
      vi.fn().mockRejectedValue(new Error('network')),
    ]) {
      await createSessionRecheck({
        currentToken: () => 'a',
        probe,
        reauthenticate,
      })('a');
    }
    expect(reauthenticate).not.toHaveBeenCalled();
  });
  it('并发合并复核且会话已切换时不清理新登录', async () => {
    let token = 'a';
    let reject!: (e: unknown) => void;
    const probe = vi.fn(
      () =>
        new Promise((_resolve, r) => {
          reject = r;
        }),
    );
    const reauthenticate = vi.fn();
    const check = createSessionRecheck({
      currentToken: () => token,
      probe,
      reauthenticate,
    });
    const first = check('a');
    const second = check('a');
    expect(probe).toHaveBeenCalledTimes(1);
    token = 'b';
    reject(error(401, '未登录：已过期'));
    await Promise.all([first, second]);
    expect(reauthenticate).not.toHaveBeenCalled();
  });
  it('同一失效会话只退出一次', async () => {
    const probe = vi.fn().mockRejectedValue(error(401, '未登录：已过期'));
    const reauthenticate = vi.fn().mockResolvedValue(undefined);
    const check = createSessionRecheck({
      currentToken: () => 'a',
      probe,
      reauthenticate,
    });
    await Promise.all([check('a'), check('a')]);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(reauthenticate).toHaveBeenCalledTimes(1);
  });
});

describe('会话恢复', () => {
  it('关闭刷新时直接重新认证', async () => {
    const refresh = vi.fn();
    const reauthenticate = vi.fn().mockResolvedValue(undefined);
    const recover = createSessionRecovery({
      currentToken: () => 'a',
      refreshEnabled: () => false,
      refresh,
      setToken: vi.fn(),
      reauthenticate,
    });
    await recover('a');
    expect(refresh).not.toHaveBeenCalled();
    expect(reauthenticate).toHaveBeenCalledTimes(1);
  });
  it('开启刷新时更新令牌，且不触发重新认证', async () => {
    const setToken = vi.fn();
    const reauthenticate = vi.fn();
    const recover = createSessionRecovery({
      currentToken: () => 'a',
      refreshEnabled: () => true,
      refresh: vi.fn().mockResolvedValue('b'),
      setToken,
      reauthenticate,
    });
    await recover('a');
    expect(setToken).toHaveBeenCalledWith('b');
    expect(reauthenticate).not.toHaveBeenCalled();
  });
  it('刷新等待期间切换账号不能覆盖新会话', async () => {
    let token = 'a';
    let resolve!: (value: string) => void;
    const setToken = vi.fn();
    const reauthenticate = vi.fn();
    const recover = createSessionRecovery({
      currentToken: () => token,
      refreshEnabled: () => true,
      refresh: () =>
        new Promise((r) => {
          resolve = r;
        }),
      setToken,
      reauthenticate,
    });
    const flight = recover('a');
    token = 'new';
    resolve('old-refresh');
    await flight;
    expect(setToken).not.toHaveBeenCalled();
    expect(reauthenticate).not.toHaveBeenCalled();
  });
});
