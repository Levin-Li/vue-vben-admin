import { describe, expect, it, vi } from 'vitest';

import { createModelMetadataCache } from '../model-metadata';

describe('动态模型元数据缓存隔离与失效', () => {
  it('同上下文合并在途请求并返回独立副本', async () => {
    let release: (value: { key: string }[]) => void = () => {};
    const loader = vi.fn(
      () =>
        new Promise<{ key: string }[]>((resolve) => {
          release = resolve;
        }),
    );
    const cache = createModelMetadataCache();
    const first = cache.read('actor-a:tenant-a', 'catalog', loader);
    const second = cache.read('actor-a:tenant-a', 'catalog', loader);
    release([{ key: 'invoice' }]);
    const [a, b] = await Promise.all([first, second]);
    expect(loader).toHaveBeenCalledOnce();
    if (a[0]) a[0].key = 'changed';
    expect(b[0]?.key).toBe('invoice');
    const cached = await cache.read('actor-a:tenant-a', 'catalog', loader);
    expect(cached[0]?.key).toBe('invoice');
  });
  it('租户主体或权限代际变更不复用原目录，TTL过期重新读取', async () => {
    let now = 0;
    const cache = createModelMetadataCache(20, () => now);
    const loader = vi.fn().mockResolvedValue([]);
    await cache.read('a:org1:perm1', 'catalog', loader);
    await cache.read('a:org1:perm1', 'catalog', loader);
    expect(loader).toHaveBeenCalledTimes(1);
    now = 21;
    await cache.read('a:org1:perm1', 'catalog', loader);
    await cache.read('a:org2:perm1', 'catalog', loader);
    await cache.read('a:org2:perm2', 'catalog', loader);
    expect(loader).toHaveBeenCalledTimes(4);
  });
  it('失效或上下文切换后旧promise不能恢复旧目录，包括去重等待者', async () => {
    const cache = createModelMetadataCache();
    let release: (value: string[]) => void = () => {};
    const loader = () =>
      new Promise<string[]>((resolve) => {
        release = resolve;
      });
    const first = cache.read('a', 'catalog', loader);
    const second = cache.read('a', 'catalog', loader);
    const checks = [
      expect(first).rejects.toThrow('上下文'),
      expect(second).rejects.toThrow('上下文'),
    ];
    cache.invalidate();
    await cache.read('b', 'catalog', async () => ['b']);
    release(['a']);
    await Promise.all(checks);
    expect(await cache.read('b', 'catalog', async () => ['wrong'])).toEqual([
      'b',
    ]);
  });
});

it('同一上下文缓存有容量上限并在写入时清理过期项', async () => {
  let now = 0;
  const cache = createModelMetadataCache(20, () => now, 2);
  const loader = vi.fn(async () => []);
  await cache.read('a', '1', loader);
  await cache.read('a', '2', loader);
  await cache.read('a', '3', loader);
  await cache.read('a', '1', loader);
  expect(loader).toHaveBeenCalledTimes(4);
  now = 21;
  await cache.read('a', '4', loader);
  await cache.read('a', '3', loader);
  expect(loader).toHaveBeenCalledTimes(6);
});
