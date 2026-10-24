import { effectScope } from 'vue';

import { useAccessStore, useUserStore } from '@vben/runtime/stores';

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setCurrentGlobalDomainIds } from '../../global-domain-context-state';
import {
  setCurrentGlobalUserOrgRecord,
  setGlobalUserOrgContextEnabled,
} from '../../global-org-context-state';

const get = vi.fn();

vi.mock('../request', () => ({ requestClient: { get } }));

describe('uiSetting runtime cache', () => {
  afterEach(() => {
    vi.useRealTimers();
    setActivePinia(undefined);
    setCurrentGlobalDomainIds([]);
    setGlobalUserOrgContextEnabled(false);
  });
  it('uses the generated UiSetting detail route when a saved setting is refreshed', async () => {
    const { UI_SETTING_RETRIEVE_PATH } = await import('../ui-setting-runtime');

    expect(UI_SETTING_RETRIEVE_PATH).toBe('/UiSetting/retrieve');
  });

  beforeEach(async () => {
    get.mockReset();
    setActivePinia(undefined);
    const module = await import('../ui-setting-runtime');
    module.clearUiSettingRuntimeCache();
  });

  it('treats an ApiResp null data payload as a cacheable no-setting result', async () => {
    get.mockResolvedValue({ data: { data: null }, headers: {} });
    const { resolveUiSettingRuntime } = await import('../ui-setting-runtime');

    expect(await resolveUiSettingRuntime('/Tenant', 'tenant:site')).toBeNull();
    expect(await resolveUiSettingRuntime('/Tenant', 'tenant:site')).toBeNull();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['empty object', {}],
    ['empty list', []],
  ])(
    'treats an ApiResp %s data payload as a no-setting result',
    async (_, data) => {
      get.mockResolvedValue({ data: { data }, headers: {} });
      const { resolveUiSettingRuntimeWithScope } =
        await import('../ui-setting-runtime');

      await expect(
        resolveUiSettingRuntimeWithScope('/Tenant', `tenant:${_}`),
      ).resolves.toEqual({ scope: {}, setting: null });
    },
  );

  it('uses the ApiResp data record rather than the response envelope', async () => {
    get.mockResolvedValue({
      data: { data: { code: '/Tenant', id: 'setting-1' } },
      headers: {
        'x-ui-setting-domain': 'tenant.example.test',
        'x-ui-setting-tenant-id': 'tenant-1',
      },
    });
    const { resolveUiSettingRuntime, resolveUiSettingRuntimeWithScope } =
      await import('../ui-setting-runtime');

    await expect(
      resolveUiSettingRuntime('/Tenant', 'tenant:site'),
    ).resolves.toMatchObject({
      code: '/Tenant',
      id: 'setting-1',
    });
    await expect(
      resolveUiSettingRuntimeWithScope('/Tenant', 'tenant:site'),
    ).resolves.toMatchObject({
      scope: { domain: 'tenant.example.test', tenantId: 'tenant-1' },
    });
  });
  it('主动刷新覆盖旧启用缓存，其它调用继续复用缓存', async () => {
    const { resolveUiSettingRuntime } = await import('../ui-setting-runtime');
    get.mockResolvedValueOnce({
      data: { data: { code: 'selector', valueContent: { multiple: false } } },
      headers: {},
    });
    expect(await resolveUiSettingRuntime('selector', 'user')).not.toBeNull();
    get.mockResolvedValueOnce({ data: { data: null }, headers: {} });
    expect(
      await resolveUiSettingRuntime('selector', 'user', { refresh: true }),
    ).toBeNull();
    expect(await resolveUiSettingRuntime('selector', 'user')).toBeNull();
    expect(get).toHaveBeenCalledTimes(2);
  });
});

// 在真实 Pinia 状态下验证缓存边界，普通 token 续期不改变主体身份。
function login(id = 'user-a') {
  setActivePinia(createPinia());
  const access = useAccessStore();
  const user = useUserStore();
  access.accessToken = 'token-1';
  user.userInfo = {
    id,
    userId: id,
    username: id,
    avatar: '',
    realName: id,
    roles: ['reader'],
  };
  return { access, user };
}
function response(id: string) {
  return {
    data: { data: { code: 'page', id, valueContent: { fields: ['name'] } } },
    headers: { 'x-ui-setting-domain': 'example.test' },
  };
}
function deferredResponse() {
  let resolve: (value: ReturnType<typeof response>) => void = () => {
    throw new Error('请求尚未初始化');
  };
  const promise = new Promise<ReturnType<typeof response>>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('展示设置缓存的有效期与主体边界', () => {
  beforeEach(async () => {
    get.mockReset();
    setActivePinia(undefined);
    const module = await import('../ui-setting-runtime');
    module.clearUiSettingRuntimeCache();
  });
  afterEach(() => {
    vi.useRealTimers();
    setActivePinia(undefined);
    setCurrentGlobalDomainIds([]);
    setGlobalUserOrgContextEnabled(false);
  });

  it('20秒过期且最多保留256个设置键', async () => {
    vi.useFakeTimers();
    get.mockImplementation(async () => response('cached'));
    const { resolveUiSettingRuntime } = await import('../ui-setting-runtime');
    await resolveUiSettingRuntime('first', 'scope');
    vi.advanceTimersByTime(19_999);
    await resolveUiSettingRuntime('first', 'scope');
    expect(get).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    await resolveUiSettingRuntime('first', 'scope');
    expect(get).toHaveBeenCalledTimes(2);
    for (let index = 0; index < 256; index++)
      await resolveUiSettingRuntime(`page-${index}`, 'scope');
    await resolveUiSettingRuntime('first', 'scope');
    expect(get).toHaveBeenCalledTimes(259);
  });

  it('并发合并但每个调用方和缓存均持有独立深拷贝，替换输入也不外泄', async () => {
    const { resolveUiSettingRuntimeWithScope, replaceUiSettingRuntimeCache } =
      await import('../ui-setting-runtime');
    const deferred = deferredResponse();
    get.mockReturnValueOnce(deferred.promise);
    const first = resolveUiSettingRuntimeWithScope('page', 'scope');
    const second = resolveUiSettingRuntimeWithScope('page', 'scope');
    expect(get).toHaveBeenCalledOnce();
    const payload = response('original');
    deferred.resolve(payload);
    const [a, b] = await Promise.all([first, second]);
    a.setting?.valueContent?.fields.push('changed');
    a.scope.domain = 'changed';
    payload.data.data.valueContent.fields.push('source-change');
    expect(b.setting?.valueContent?.fields).toEqual(['name']);
    const cached = await resolveUiSettingRuntimeWithScope('page', 'scope');
    expect(cached.scope.domain).toBe('example.test');
    const replacement = {
      code: 'page',
      valueContent: { fields: ['replacement'] },
    };
    replaceUiSettingRuntimeCache('page', 'scope', replacement);
    replacement.valueContent.fields.push('changed');
    const replaced = await resolveUiSettingRuntimeWithScope('page', 'scope');
    expect(replaced.setting?.valueContent?.fields).toEqual(['replacement']);
  });

  it('主体、权限、角色和领域上下文隔离，token续期保留命中，匿名不复用登录缓存', async () => {
    const { access, user } = login();
    get.mockImplementation(async () => response('current'));
    const { resolveUiSettingRuntime } = await import('../ui-setting-runtime');
    await resolveUiSettingRuntime('page', 'scope');
    access.accessToken = 'rotated-token';
    await resolveUiSettingRuntime('page', 'scope');
    expect(get).toHaveBeenCalledTimes(1);
    user.userInfo = {
      ...user.userInfo,
      id: 'user-b',
      userId: 'user-b',
    } as NonNullable<typeof user.userInfo>;
    await resolveUiSettingRuntime('page', 'scope');
    access.accessCodes = ['new-permission'];
    await resolveUiSettingRuntime('page', 'scope');
    user.userRoles = ['writer'];
    await resolveUiSettingRuntime('page', 'scope');
    setCurrentGlobalDomainIds(['domain-b']);
    await resolveUiSettingRuntime('page', 'scope');
    expect(get).toHaveBeenCalledTimes(5);
    setGlobalUserOrgContextEnabled(true);
    setCurrentGlobalUserOrgRecord({
      kind: 'org',
      id: 'org-a',
      tenantId: 'tenant-a',
    });
    await resolveUiSettingRuntime('page', 'scope');
    setCurrentGlobalUserOrgRecord({
      kind: 'org',
      id: 'org-b',
      tenantId: 'tenant-a',
    });
    await resolveUiSettingRuntime('page', 'scope');
    setCurrentGlobalUserOrgRecord({
      kind: 'org',
      id: 'org-b',
      tenantId: 'tenant-b',
    });
    await resolveUiSettingRuntime('page', 'scope');
    expect(get).toHaveBeenCalledTimes(8);
    setActivePinia(undefined);
    await resolveUiSettingRuntime('page', 'scope');
    expect(get).toHaveBeenCalledTimes(9);
  });

  it('请求中身份短暂切换后返回原用户，旧响应仍拒绝且不能回填', async () => {
    const { access } = login();
    const { resolveUiSettingRuntime } = await import('../ui-setting-runtime');
    const deferred = deferredResponse();
    get.mockReturnValueOnce(deferred.promise);
    const caller = effectScope();
    const old = caller.run(() => resolveUiSettingRuntime('page', 'scope'));
    if (!old) throw new Error('测试作用域未创建');
    caller.stop();
    const rejected = expect(old).rejects.toThrow('上下文已变化');
    access.accessToken = null;
    access.accessToken = 'new-login';
    deferred.resolve(response('stale'));
    await rejected;
    get.mockResolvedValueOnce(response('fresh'));
    const fresh = await resolveUiSettingRuntime('page', 'scope');
    expect(fresh?.id).toBe('fresh');
  });

  it.each(['clear', 'replace', 'refresh'] as const)(
    '与%s竞争的旧请求不能回填，其他code请求不被force取消',
    async (action) => {
      const {
        clearUiSettingRuntimeCache,
        replaceUiSettingRuntimeCache,
        resolveUiSettingRuntime,
      } = await import('../ui-setting-runtime');
      const oldResponse = deferredResponse();
      const otherResponse = deferredResponse();
      get
        .mockReturnValueOnce(oldResponse.promise)
        .mockReturnValueOnce(otherResponse.promise);
      const old = resolveUiSettingRuntime('page', 'scope');
      const rejected = expect(old).rejects.toThrow('上下文已变化');
      const other = resolveUiSettingRuntime('other', 'scope');
      const otherResult =
        action === 'clear'
          ? expect(other).rejects.toThrow('上下文已变化')
          : expect(other).resolves.toMatchObject({ id: 'other' });
      if (action === 'clear') clearUiSettingRuntimeCache();
      else if (action === 'replace')
        replaceUiSettingRuntimeCache('page', 'scope', {
          code: 'page',
          id: 'fresh',
        });
      else {
        get.mockResolvedValueOnce(response('fresh'));
        const refreshed = await resolveUiSettingRuntime('page', 'scope', {
          refresh: true,
        });
        expect(refreshed?.id).toBe('fresh');
      }
      otherResponse.resolve(response('other'));
      await otherResult;
      oldResponse.resolve(response('stale'));
      await rejected;
      if (action === 'clear') get.mockResolvedValueOnce(response('fresh'));
      const fresh = await resolveUiSettingRuntime('page', 'scope');
      expect(fresh?.id).toBe('fresh');
    },
  );
});
