import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();

vi.mock('@vben/preferences', () => ({ updatePreferences: vi.fn() }));
vi.mock('../../api', () => ({
  fetchDictOptions: vi.fn(),
  fetchEnumOptions: vi.fn(),
  fetchOptions: vi.fn(),
}));
vi.mock('../api/request', () => ({ requestClient: { get, post, put } }));
vi.mock('../api/ui-setting-runtime', () => ({
  resolveUiSettingRuntimeWithScope: vi.fn(),
  UI_SETTING_RETRIEVE_PATH: '/UiSetting/retrieve',
}));

describe('界面偏好设置上传', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    put.mockReset();
  });

  it('唯一精确候选只更新 ID、乐观锁和配置内容', async () => {
    get
      .mockResolvedValueOnce({
        items: [{ id: 'setting-1', optimisticLock: 4 }],
        total: 1,
      })
      .mockResolvedValueOnce({ id: 'setting-1', optimisticLock: 5 });
    const { saveAdminUiPreferencesSetting } = await import(
      '../admin-ui-preferences-setting'
    );

    await saveAdminUiPreferencesSetting({ theme: 'dark' }, { tenantId: 't-1' });

    expect(get).toHaveBeenNthCalledWith(1, '/UiSetting/findCandidates', {
      params: expect.objectContaining({ tenantId: 't-1', type: 'Preferences' }),
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
    const { saveAdminUiPreferencesSetting } = await import(
      '../admin-ui-preferences-setting'
    );

    await saveAdminUiPreferencesSetting(
      { theme: 'light' },
      { domain: 'example.test', tenantId: 't-1' },
      selectCandidate,
    );

    expect(selectCandidate).toHaveBeenCalledWith(candidates, 2);
    expect(post).toHaveBeenCalledWith(
      '/UiSetting/create',
      expect.objectContaining({ type: 'Preferences', valueContent: { preferences: { theme: 'light' } } }),
    );
    expect(put).not.toHaveBeenCalled();
  });
});
