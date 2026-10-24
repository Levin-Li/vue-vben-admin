import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearAdminSession,
  initializeAdminSession,
  registerAdminSessionInitializer,
} from '../session-resources';

const unregister: Array<() => void> = [];
afterEach(() => {
  clearAdminSession();
  for (const stop of unregister.splice(0)) stop();
});

describe('登录会话共享资源', () => {
  it('重复初始化合并在途调用，失败也不在页面切换时重试', async () => {
    let complete!: () => void;
    const load = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const clear = vi.fn();
    unregister.push(registerAdminSessionInitializer('test', { load, clear }));
    const first = initializeAdminSession();
    const second = initializeAdminSession();
    await Promise.resolve();
    expect(load).toHaveBeenCalledOnce();
    complete();
    await Promise.all([first, second]);
    await initializeAdminSession();
    expect(load).toHaveBeenCalledOnce();
    clearAdminSession();
    const third = initializeAdminSession();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(2);
    complete();
    await third;
    expect(clear).toHaveBeenCalledOnce();
  });

  it('取消尚未开始的任务，活动会话的迟登记任务只执行一次', async () => {
    const stale = vi.fn(async () => {});
    unregister.push(
      registerAdminSessionInitializer('stale', {
        load: stale,
        clear: () => {},
      }),
    );
    const pending = initializeAdminSession();
    clearAdminSession();
    await pending;
    expect(stale).not.toHaveBeenCalled();
    await initializeAdminSession();
    const late = vi.fn(async () => {});
    unregister.push(
      registerAdminSessionInitializer('late', { load: late, clear: () => {} }),
    );
    await initializeAdminSession();
    expect(late).toHaveBeenCalledOnce();
  });
});
