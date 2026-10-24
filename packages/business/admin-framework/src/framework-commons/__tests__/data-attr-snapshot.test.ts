import type { DataAttrPolicy } from '../data-attr-policy';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  initializeDataAttrPolicySnapshot,
  isDataAttrPolicyReady,
  loadDataAttrPolicy,
  loadDataAttrPolicyByOperation,
  suspendDataAttrPolicies,
} from '../data-attr-policy';

function policy(path: string): DataAttrPolicy {
  return {
    groups: [],
    id: path,
    methods: ['GET'],
    nodes: {},
    operation: path,
    pathPatterns: [path],
    requestRoots: [],
    restricted: false,
    viewRoots: { request: [], response: [] },
  };
}

beforeEach(() => suspendDataAttrPolicies());

describe('登录字段权限快照', () => {
  it('并发初始化及多页面读取仅加载一次，实际接口优先于页面操作名称', async () => {
    const load = vi.fn(async () => ({
      version: 1,
      policies: [policy('/a'), policy('/b')],
    }));
    await Promise.all([
      initializeDataAttrPolicySnapshot(load),
      initializeDataAttrPolicySnapshot(load),
    ]);
    for (let index = 0; index < 20; index++) {
      const first = await loadDataAttrPolicy('GET', '/a?x=1');
      expect(first.id).toBe('/a');
      const second = await loadDataAttrPolicyByOperation('页面别名', {
        method: 'GET',
        path: '/b',
      });
      expect(second.id).toBe('/b');
    }
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('缺失或歧义接口拒绝读取，不补发策略查询', async () => {
    const load = vi.fn(async () => ({
      version: 1,
      policies: [policy('/a'), policy('/a')],
    }));
    await initializeDataAttrPolicySnapshot(load);
    await expect(loadDataAttrPolicy('GET', '/a')).rejects.toThrow('不唯一');
    await expect(loadDataAttrPolicy('GET', '/missing')).rejects.toThrow(
      '未包含',
    );
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('退出后的迟到快照不能恢复旧用户权限', async () => {
    let resolve!: (value: {
      policies: DataAttrPolicy[];
      version: number;
    }) => void;
    const pending = initializeDataAttrPolicySnapshot(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await Promise.resolve();
    suspendDataAttrPolicies();
    resolve({ version: 1, policies: [policy('/old')] });
    await expect(pending).rejects.toThrow('登录身份已变化');
    expect(isDataAttrPolicyReady()).toBe(false);
    await initializeDataAttrPolicySnapshot(async () => ({
      version: 1,
      policies: [policy('/new')],
    }));
    await expect(loadDataAttrPolicy('GET', '/old')).rejects.toThrow('未包含');
  });

  it('失败及无效权限保持关闭，当前会话不会反复重试', async () => {
    const invalid = {
      ...policy('/a'),
      groups: [{ id: 'secret', name: '秘密', allowed: undefined }],
    } as unknown as DataAttrPolicy;
    const load = vi.fn(async () => ({ version: 1, policies: [invalid] }));
    await expect(initializeDataAttrPolicySnapshot(load)).rejects.toThrow(
      '无效',
    );
    await expect(initializeDataAttrPolicySnapshot(load)).rejects.toThrow(
      '无效',
    );
    expect(load).toHaveBeenCalledTimes(1);
    expect(isDataAttrPolicyReady()).toBe(false);
  });
});
