import {
  errorMessageResponseInterceptor,
  isCancel,
} from '@vben/runtime/request';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertDataAttrSessionReady,
  configureDataAttrPolicyLoader,
  suspendDataAttrPolicies,
} from '../../data-attr-policy';
import { setAdminFrameworkRuntime } from '../../runtime';
import { loadAdministrativeAreaOverride } from '../administrative-area-data';

// 通用代理直接委托宿主；宿主在发送前检查会话，不逐接口查询策略。
const send = vi.fn().mockResolvedValue(null);
const hostGet = vi.fn((url: string, config: unknown) => {
  assertDataAttrSessionReady();
  return send(url, config);
});
const loader = vi.fn().mockResolvedValue({
  version: 1,
  policies: [
    {
      id: 'area-config',
      operation: 'area:read',
      methods: ['GET'],
      pathPatterns: ['/com.levin.oak.base/V1/api/Setting/use/areaCodes'],
      restricted: false,
      groups: [],
      nodes: {},
      requestRoots: [],
      responseRoot: null,
      viewRoots: { request: [], response: [] },
    },
  ],
});

beforeEach(() => {
  hostGet.mockClear();
  send.mockClear();
  loader.mockClear();
  setAdminFrameworkRuntime({
    requestClient: {
      get: hostGet,
      delete: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      request: vi.fn(),
    },
  });
  configureDataAttrPolicyLoader(loader);
});

describe('行政区划运行时正式策略目标', () => {
  it('代理保留宿主baseURL与相对路径，不为行政区划查询字段策略', async () => {
    await expect(loadAdministrativeAreaOverride()).resolves.toBe(false);
    expect(loader).not.toHaveBeenCalled();
    expect(hostGet).toHaveBeenCalledWith('/Setting/use/areaCodes', {
      baseURL: '/com.levin.oak.base/V1/api',
      __silentError: true,
    });
  });

  it('退出暂停期间仍拒绝请求，不把接口加入匿名旁路', async () => {
    suspendDataAttrPolicies();
    const canceled = await loadAdministrativeAreaOverride().catch(
      (error) => error,
    );
    expect(canceled.message).toContain('登录会话尚未就绪');
    expect(isCancel(canceled)).toBe(true);
    const showError = vi.fn();
    await expect(
      errorMessageResponseInterceptor(showError).rejected?.(canceled),
    ).rejects.toBe(canceled);
    expect(showError).not.toHaveBeenCalled();
    expect(loader).not.toHaveBeenCalled();
    expect(hostGet).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });
});
