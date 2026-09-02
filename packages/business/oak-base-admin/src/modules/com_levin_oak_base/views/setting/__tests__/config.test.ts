import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
}));

vi.mock('../../../api/setting-service', () => ({
  settingService: {
    create: vi.fn(),
    delete: vi.fn(),
    list: listMock,
    retrieve: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../api-module', () => ({
  DEFAULT_CRUD_MODAL_WIDTH: 960,
  buildEnumOptionsLoader: () => async () => [],
  tenantOptionsLoader: async () => [],
}));

vi.mock('../../setting-crud-submit', () => ({
  transformSettingCrudSubmit: (payload: Record<string, any>) => payload,
}));

vi.mock(
  '@levin/admin-framework/framework-commons/shared/user-identity',
  () => ({
    isSuperAdminUser: () => false,
  }),
);

import {
  LEGACY_OAUTH_SETTING_CODE_PREFIX,
  settingPageCrudConfig,
} from '../config';

describe('settingPageCrudConfig', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it('filters legacy oauth settings from the system setting list', async () => {
    listMock.mockResolvedValueOnce({
      items: [
        { code: `${LEGACY_OAUTH_SETTING_CODE_PREFIX}FEISHU`, id: 'oauth-1' },
        { code: 'siteTitle', id: 'keep-1' },
        { code: 'loginTheme', id: 'keep-2' },
      ],
      totals: 3,
    });

    const result = await settingPageCrudConfig.apiService?.list?.({
      pageIndex: 1,
      pageSize: 10,
    });

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pageIndex: 1,
        pageSize: 100,
      }),
      undefined,
    );
    expect(result).toMatchObject({
      items: [
        { code: 'siteTitle', id: 'keep-1' },
        { code: 'loginTheme', id: 'keep-2' },
      ],
      totals: 2,
    });
  });

  it('continues loading backend pages until the visible page is filled', async () => {
    const firstPageItems = Array.from({ length: 100 }, (_, index) => ({
      code: `${LEGACY_OAUTH_SETTING_CODE_PREFIX}LEGACY_${index}`,
      id: `oauth-${index}`,
    }));
    firstPageItems[0] = { code: 'siteTitle', id: 'keep-1' };

    listMock
      .mockResolvedValueOnce({
        items: firstPageItems,
        totals: 101,
      })
      .mockResolvedValueOnce({
        items: [
          { code: 'loginTheme', id: 'keep-2' },
        ],
        totals: 101,
      });

    const result = await settingPageCrudConfig.apiService?.list?.({
      pageIndex: 1,
      pageSize: 2,
    });

    expect(listMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        pageIndex: 1,
        pageSize: 100,
      }),
      undefined,
    );
    expect(listMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pageIndex: 2,
        pageSize: 100,
      }),
      undefined,
    );
    expect(result).toMatchObject({
      items: [
        { code: 'siteTitle', id: 'keep-1' },
        { code: 'loginTheme', id: 'keep-2' },
      ],
      totals: 2,
    });
  });
});
