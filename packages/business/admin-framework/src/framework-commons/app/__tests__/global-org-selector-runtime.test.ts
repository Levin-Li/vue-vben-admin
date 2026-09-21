import { flushPromises } from '@vue/test-utils';
import { reactive } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyCurrentGlobalUserOrgContextToParams,
  getCurrentGlobalOrgId,
  setCurrentGlobalOrgId,
} from '../global-org-context-state';
import {
  registerGlobalOrgSelectorRuntime,
  globalOrgSelectorRuntimeState as state,
} from '../global-org-selector-runtime';

const mocks = vi.hoisted(() => ({
  addHeader: vi.fn(() => vi.fn()),
  resolve: vi.fn(),
  user: undefined as any,
}));
vi.mock('@vben/layouts/basic/header-extension-area', () => ({
  addLayoutHeaderExtensionAreaItem: mocks.addHeader,
}));
vi.mock('@vben/runtime/stores', () => ({
  useTabbarStore: () => ({ invalidateCachedRouteViews: vi.fn() }),
  useAccessStore: () => ({ setIsAccessChecked: vi.fn() }),
  useUserStore: () => ({ userInfo: mocks.user }),
}));
vi.mock('../api/ui-setting-runtime', () => ({
  resolveUiSettingRuntime: mocks.resolve,
}));
vi.mock('../global-org-selector.vue', () => ({ default: {} }));
vi.mock('../router', () => ({
  router: {
    currentRoute: { value: { fullPath: '/' } },
    replace: vi.fn().mockResolvedValue(undefined),
  },
}));

let dispose: (() => void) | undefined;
const enabled = { valueContent: { allowSelectOrg: true } };

describe('全局选择器配置生命周期', () => {
  beforeEach(() => {
    mocks.resolve.mockReset();
    mocks.addHeader.mockClear();
    mocks.user = reactive({ id: 'user-a' });
  });
  afterEach(() => {
    dispose?.();
  });

  it('配置返回前保持关闭，有效配置后才能注入，注销时立即关闭', async () => {
    let complete!: (value: any) => void;
    mocks.resolve.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    dispose = registerGlobalOrgSelectorRuntime();
    setCurrentGlobalOrgId('late-old-org');
    expect(applyCurrentGlobalUserOrgContextToParams({ pageIndex: 1 })).toEqual({
      pageIndex: 1,
    });
    complete(enabled);
    await flushPromises();
    setCurrentGlobalOrgId('current-org');
    expect(applyCurrentGlobalUserOrgContextToParams({})).toEqual({});
    dispose();
    expect(getCurrentGlobalOrgId()).toBeUndefined();
    expect(state.enabled).toBe(false);
    expect(
      applyCurrentGlobalUserOrgContextToParams({ orgId: 'explicit' }),
    ).toEqual({ orgId: 'explicit' });
  });

  it.each([null, { valueContent: {} }])(
    '服务端无有效设置时关闭，不保留加载期间迟到的选择：%s',
    async (setting) => {
      mocks.resolve.mockResolvedValue(setting);
      dispose = registerGlobalOrgSelectorRuntime();
      setCurrentGlobalOrgId('old');
      await flushPromises();
      expect(state.enabled).toBe(false);
      expect(getCurrentGlobalOrgId()).toBeUndefined();
      expect(
        applyCurrentGlobalUserOrgContextToParams(undefined),
      ).toBeUndefined();
    },
  );

  it('旧账号响应晚于新账号关闭结果时不能重新启用', async () => {
    let finishOld!: (value: any) => void;
    mocks.resolve
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishOld = resolve;
        }),
      )
      .mockResolvedValueOnce(null);
    dispose = registerGlobalOrgSelectorRuntime();
    mocks.user.id = 'user-b';
    await flushPromises();
    finishOld(enabled);
    await flushPromises();
    expect(state.enabled).toBe(false);
    expect(getCurrentGlobalOrgId()).toBeUndefined();
  });

  it('同用户重新加载会刷新配置，并立即停止旧上下文补值', async () => {
    mocks.resolve.mockResolvedValueOnce(enabled).mockResolvedValueOnce(null);
    dispose = registerGlobalOrgSelectorRuntime();
    await flushPromises();
    setCurrentGlobalOrgId('old');
    dispose = registerGlobalOrgSelectorRuntime();
    expect(state.enabled).toBe(false);
    expect(getCurrentGlobalOrgId()).toBeUndefined();
    await flushPromises();
    expect(state.enabled).toBe(false);
    expect(mocks.resolve).toHaveBeenLastCalledWith(
      '全局组织与用户选择器',
      'global-org-selector:user-a',
      { refresh: true },
    );
    expect(mocks.addHeader).toHaveBeenCalledWith(
      'center',
      expect.objectContaining({ class: 'max-w-[360px] shrink-0' }),
    );
  });

  it('加载失败和退出后迟到响应都不能启用', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.resolve.mockRejectedValueOnce(new Error('offline'));
    dispose = registerGlobalOrgSelectorRuntime();
    await flushPromises();
    expect(state.enabled).toBe(false);
    let complete!: (value: any) => void;
    mocks.resolve.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    mocks.user.id = 'user-b';
    await flushPromises();
    mocks.user.id = '';
    await flushPromises();
    complete(enabled);
    await flushPromises();
    expect(state.enabled).toBe(false);
    expect(getCurrentGlobalOrgId()).toBeUndefined();
    vi.restoreAllMocks();
  });
  it('切换账号后同一调用栈立即停止旧上下文注入', async () => {
    mocks.resolve
      .mockResolvedValueOnce(enabled)
      .mockReturnValueOnce(new Promise(() => {}));
    dispose = registerGlobalOrgSelectorRuntime();
    await flushPromises();
    setCurrentGlobalOrgId('old-account-org');
    mocks.user.id = 'new-account';
    expect(state.enabled).toBe(false);
    expect(getCurrentGlobalOrgId()).toBeUndefined();
    expect(applyCurrentGlobalUserOrgContextToParams({ pageIndex: 1 })).toEqual({
      pageIndex: 1,
    });
  });
});
