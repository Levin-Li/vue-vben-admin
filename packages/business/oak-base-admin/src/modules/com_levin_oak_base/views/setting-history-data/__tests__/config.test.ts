import { describe, expect, it, vi } from 'vitest';

import { pageMeta, settingHistoryDataPageCrudConfig } from '../config';

vi.mock('../../../api/setting-history-data-service', () => ({
  settingHistoryDataService: {},
}));
vi.mock('../../api-module', () => ({
  DEFAULT_CRUD_MODAL_WIDTH: '80%',
  tenantOptionsLoader: async () => [],
  buildDictOptionsLoader: () => async () => [],
}));

describe('设置历史独立管理页面', () => {
  it('仅允许查询、只读详情和删除', () => {
    expect(pageMeta.name).toBe('SettingHistoryData');
    expect(settingHistoryDataPageCrudConfig).toMatchObject({
      apiBase: '/SettingHistoryData',
      allowCreate: false,
      allowEdit: false,
      allowDelete: true,
      allowRetrieve: true,
    });
    expect(
      settingHistoryDataPageCrudConfig.fields.find(
        (field) => field.key === 'content',
      ),
    ).toMatchObject({ type: 'json', fullRow: true, form: false });
  });

  it('隐藏租户名称扩展字段，避免详情重复归属租户', () => {
    expect(
      settingHistoryDataPageCrudConfig.fields.find(
        (field) => field.key === 'tenantName',
      ),
    ).toMatchObject({
      label: '租户名称',
      detail: false,
      form: false,
      table: false,
    });
  });

  it('提供历史定位和版本时间查询，正文不参与查询', () => {
    const keys = settingHistoryDataPageCrudConfig.fields
      .filter((field) => field.search)
      .map((field) => field.key);
    expect(keys).toEqual([
      'tenantId',
      'containsTitle',
      'bizType',
      'bizDataId',
      'gteCreateTime',
      'lteCreateTime',
    ]);
    expect(keys).not.toContain('content');
  });
});
