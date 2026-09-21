import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();

vi.mock('../request', () => ({ requestClient: { get, post, put } }));

describe('三套界面设置共用候选保存', () => {
  const data = {
    code: '/clob/V1/User',
    domain: null,
    name: '用户页面展示设置',
    orgCategory: null,
    orgType: null,
    tenantId: null,
    type: 'PageDisplay',
    userCategory: null,
    userType: null,
    valueContent: { pageDisplay: { version: 1 } },
  };

  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    put.mockReset();
  });

  it('只查询第一页十条；没有候选时创建', async () => {
    get.mockResolvedValue({ items: [] });
    post.mockResolvedValue('new-setting');
    const { saveUiSettingWithCandidates } = await import(
      '../ui-setting-candidate-save'
    );

    await expect(saveUiSettingWithCandidates(data)).resolves.toMatchObject({
      id: 'new-setting',
    });

    expect(get).toHaveBeenCalledWith('/UiSetting/findCandidates', {
      params: expect.objectContaining({
        code: '/clob/V1/User',
        pageIndex: 1,
        pageSize: 10,
        type: 'PageDisplay',
      }),
    });
    expect(post).toHaveBeenCalledWith('/UiSetting/create', data);
    expect(put).not.toHaveBeenCalled();
  });

  it('唯一候选仅用 ID、最新乐观锁和配置内容更新', async () => {
    get
      .mockResolvedValueOnce({ items: [{ id: 'setting-1', optimisticLock: 2 }] })
      .mockResolvedValueOnce({ id: 'setting-1', optimisticLock: 3 });
    const { saveUiSettingWithCandidates } = await import(
      '../ui-setting-candidate-save'
    );

    await saveUiSettingWithCandidates(data);

    expect(put).toHaveBeenCalledWith('/UiSetting/update', {
      id: 'setting-1',
      optimisticLock: 3,
      valueContent: data.valueContent,
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('多个候选只更新调用方选择的一条', async () => {
    const candidates = [
      { id: 'setting-1', optimisticLock: 1 },
      { id: 'setting-2', optimisticLock: 2 },
    ];
    get
      .mockResolvedValueOnce({ items: candidates })
      .mockResolvedValueOnce({ id: 'setting-2', optimisticLock: 4 });
    const selectCandidate = vi.fn().mockResolvedValue(candidates[1]);
    const { saveUiSettingWithCandidates } = await import(
      '../ui-setting-candidate-save'
    );

    await saveUiSettingWithCandidates(data, selectCandidate);

    expect(selectCandidate).toHaveBeenCalledWith(candidates, 2);
    expect(put).toHaveBeenCalledWith('/UiSetting/update', {
      id: 'setting-2',
      optimisticLock: 4,
      valueContent: data.valueContent,
    });
    expect(post).not.toHaveBeenCalled();
  });
});
