import { describe, expect, it, vi } from 'vitest';

import {
  publishValidatedBatch,
  runDependencyLayers,
} from '../on-demand-release-execution.mjs';

const packageInfo = [
  { name: '@scope/a', version: '1.0.1' },
  { name: '@scope/b', version: '1.0.1' },
];
const tarballs = new Map([
  ['@scope/a', '/tmp/a.tgz'],
  ['@scope/b', '/tmp/b.tgz'],
]);

describe('按依赖层发布', () => {
  it('同层独立任务并行，下游等待整个上游层', async () => {
    const events: string[] = [];
    await runDependencyLayers(
      [['a', 'b'], ['c']],
      async (name: string) => {
        events.push(`start:${name}`);
        await Promise.resolve();
        events.push(`end:${name}`);
      },
      2,
    );
    expect(events.slice(0, 2)).toEqual(['start:a', 'start:b']);
    expect(events.indexOf('start:c')).toBeGreaterThan(events.indexOf('end:b'));
  });

  it('同层失败后等待在途任务，不启动下游', async () => {
    const events: string[] = [];
    await expect(
      runDependencyLayers(
        [['a', 'b'], ['c']],
        async (name: string) => {
          events.push(`start:${name}`);
          await Promise.resolve();
          events.push(`end:${name}`);
          if (name === 'a') throw new Error('失败');
        },
        2,
      ),
    ).rejects.toThrow('失败');
    expect(events).toContain('end:b');
    expect(events).not.toContain('start:c');
  });
});

describe('发布成功即收口与失败恢复', () => {
  it('正常成功只做上传前版本查询，不做成功后回查', async () => {
    const versionStatus = vi.fn().mockResolvedValue('absent');
    const publish = vi.fn().mockResolvedValue(undefined);
    await publishValidatedBatch(
      packageInfo,
      [['@scope/a', '@scope/b']],
      tarballs,
      {
        publish,
        versionStatus,
        concurrency: 2,
      },
    );
    expect(publish).toHaveBeenCalledTimes(2);
    expect(versionStatus).toHaveBeenCalledTimes(2);
  });

  it('确认未发布才用同一 tarball 重试一次', async () => {
    const publish = vi
      .fn()
      .mockRejectedValueOnce(new Error('网络中断'))
      .mockResolvedValueOnce(undefined);
    const versionStatus = vi.fn().mockResolvedValue('absent');
    await publishValidatedBatch([packageInfo[0]], [['@scope/a']], tarballs, {
      publish,
      versionStatus,
    });
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish.mock.calls[0][1]).toBe('/tmp/a.tgz');
    expect(publish.mock.calls[1][1]).toBe('/tmp/a.tgz');
  });

  it('版本已存在或状态不明时不重传', async () => {
    for (const afterFailure of ['present', 'unknown']) {
      const publish = vi.fn().mockRejectedValue(new Error('结果不明'));
      const versionStatus = vi
        .fn()
        .mockResolvedValueOnce('absent')
        .mockResolvedValueOnce(afterFailure);
      await expect(
        publishValidatedBatch([packageInfo[0]], [['@scope/a']], tarballs, {
          publish,
          versionStatus,
        }),
      ).rejects.toThrow();
      expect(publish).toHaveBeenCalledTimes(1);
    }
  });
});
