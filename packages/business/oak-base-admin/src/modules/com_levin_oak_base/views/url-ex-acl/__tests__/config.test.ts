import { describe, expect, it, vi } from 'vitest';

import { urlExAclPageCrudConfig } from '../config';

vi.mock('../../../api/url-ex-acl-service', () => ({
  urlExAclService: {},
}));

vi.mock('../../api-module', () => ({
  authorizedControllerPathOptionsLoader: async () => [],
  buildEnumOptionsLoader: () => async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: '70%',
  roleOptionsLoader: async () => [],
  tenantOptionsLoader: async () => [],
}));

describe('url ex acl page config', () => {
  it('uses authorized controller path lookup for URL include and exclude fields', () => {
    const fields = urlExAclPageCrudConfig.fields;

    expect(fields.find((field) => field.key === 'urlPathList')).toMatchObject({
      fullRow: true,
      help: expect.stringContaining('授权控制器路径'),
      key: 'urlPathList',
      label: 'URL包含列表',
      loadOptions: expect.any(Function),
      remoteSearch: true,
      type: 'tags',
    });
    expect(fields.find((field) => field.key === 'urlPathExcludeList'))
      .toMatchObject({
        fullRow: true,
        help: expect.stringContaining('授权控制器路径'),
        key: 'urlPathExcludeList',
        label: 'URL排除列表',
        loadOptions: expect.any(Function),
        remoteSearch: true,
        type: 'tags',
      });
  });
});
