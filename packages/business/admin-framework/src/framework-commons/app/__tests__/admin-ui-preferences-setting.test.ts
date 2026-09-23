import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const updatePreferences = vi.fn();
const resolveUiSettingRuntimeWithScope = vi.fn();

vi.mock('@vben-core/foundation/preferences', () => ({ updatePreferences }));
vi.mock('../../api', () => ({
  fetchDictOptions: vi.fn(),
  fetchEnumOptions: vi.fn(),
  fetchOptions: vi.fn(),
}));
vi.mock('../api/request', () => ({ requestClient: { get, post, put } }));
vi.mock('../api/ui-setting-runtime', () => ({
  resolveUiSettingRuntimeWithScope,
  UI_SETTING_RETRIEVE_PATH: '/UiSetting/retrieve',
}));

describe('界面偏好设置上传', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    put.mockReset();
    updatePreferences.mockReset();
    resolveUiSettingRuntimeWithScope.mockReset();
  });

  it('加载只解析当前适配设置并应用偏好，不发起写入', async () => {
    const resolution = {
      scope: { domain: 'admin.example.test', tenantId: 'tenant-1' },
      setting: { valueContent: { preferences: { theme: 'dark' } } },
    };
    resolveUiSettingRuntimeWithScope.mockResolvedValue(resolution);
    const { loadAdminUiPreferencesSetting } =
      await import('../admin-ui-preferences-setting');

    await expect(loadAdminUiPreferencesSetting()).resolves.toBe(resolution);

    expect(resolveUiSettingRuntimeWithScope).toHaveBeenCalledWith(
      '界面偏好设置',
      'admin-ui-preferences',
      { refresh: true },
    );
    expect(updatePreferences).toHaveBeenCalledWith({ theme: 'dark' });
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('可单独读取偏好，在调用方选择时应用', async () => {
    const resolution = {
      scope: {},
      setting: { valueContent: { preferences: { theme: 'dark' } } },
    };
    resolveUiSettingRuntimeWithScope.mockResolvedValue(resolution);
    const { applyAdminUiPreferencesSetting, resolveAdminUiPreferencesSetting } =
      await import('../admin-ui-preferences-setting');

    await expect(resolveAdminUiPreferencesSetting()).resolves.toBe(resolution);
    expect(updatePreferences).not.toHaveBeenCalled();

    applyAdminUiPreferencesSetting(resolution);
    expect(updatePreferences).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('does not allow a server preference record to replace backend menu access mode', async () => {
    resolveUiSettingRuntimeWithScope.mockResolvedValue({
      scope: {},
      setting: {
        valueContent: {
          preferences: {
            app: { accessMode: 'frontend', defaultHomePath: '/custom-home' },
            theme: { mode: 'dark' },
          },
        },
      },
    });
    const { loadAdminUiPreferencesSetting } =
      await import('../admin-ui-preferences-setting');

    await loadAdminUiPreferencesSetting();

    expect(updatePreferences).toHaveBeenCalledWith({
      app: { defaultHomePath: '/custom-home' },
      theme: { mode: 'dark' },
    });
  });

  it('仅在命中设置记录时回填上传范围', async () => {
    const { resolveAdminUiPreferencesUploadScope } =
      await import('../admin-ui-preferences-setting');

    expect(
      resolveAdminUiPreferencesUploadScope({
        scope: { domain: '127.0.0.1', tenantId: 'tenant-1' },
        setting: null,
      }),
    ).toEqual({});
    expect(
      resolveAdminUiPreferencesUploadScope({
        scope: { domain: '127.0.0.1', tenantId: 'tenant-1' },
        setting: { code: '界面偏好设置' },
      }),
    ).toEqual({ domain: '127.0.0.1', tenantId: 'tenant-1' });
  });

  it('唯一精确候选只更新 ID、乐观锁和配置内容', async () => {
    get
      .mockResolvedValueOnce({
        items: [{ id: 'setting-1', optimisticLock: 4 }],
        total: 1,
      })
      .mockResolvedValueOnce({ id: 'setting-1', optimisticLock: 5 });
    const { saveAdminUiPreferencesSetting } =
      await import('../admin-ui-preferences-setting');

    await saveAdminUiPreferencesSetting({ theme: 'dark' }, { tenantId: 't-1' });

    expect(get).toHaveBeenNthCalledWith(1, '/UiSetting/findCandidates', {
      params: expect.objectContaining({
        pageIndex: 1,
        pageSize: 10,
        tenantId: 't-1',
        type: 'Preferences',
      }),
    });
    expect(put).toHaveBeenCalledWith('/UiSetting/update', {
      id: 'setting-1',
      optimisticLock: 5,
      valueContent: { preferences: { theme: 'dark' } },
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('多个候选由调用方选择更新目标，未选择时新建', async () => {
    const candidates = [
      { id: 'setting-1', optimisticLock: 1 },
      { id: 'setting-2', optimisticLock: 2 },
    ];
    get.mockResolvedValueOnce({ items: candidates, total: 2 });
    post.mockResolvedValue('setting-3');
    const selectCandidate = vi.fn().mockResolvedValue(undefined);
    const { saveAdminUiPreferencesSetting } =
      await import('../admin-ui-preferences-setting');

    await saveAdminUiPreferencesSetting(
      { theme: 'light' },
      { domain: 'example.test', tenantId: 't-1' },
      selectCandidate,
    );

    expect(selectCandidate).toHaveBeenCalledWith(candidates, 2);
    expect(post).toHaveBeenCalledWith(
      '/UiSetting/create',
      expect.objectContaining({
        type: 'Preferences',
        valueContent: { preferences: { theme: 'light' } },
      }),
    );
    expect(put).not.toHaveBeenCalled();
  });
});
