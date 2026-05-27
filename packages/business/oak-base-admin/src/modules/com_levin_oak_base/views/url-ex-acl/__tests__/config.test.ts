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
  const patternEditorFieldKeys = [
    'urlPathList',
    'urlPathExcludeList',
    'methodList',
    'domainList',
    'regionList',
    'ipList',
    'ipExcludeList',
    'osList',
    'userTypeList',
    'userRoleList',
  ];

  it('uses authorized controller path lookup for URL include and exclude fields', () => {
    const fields = urlExAclPageCrudConfig.fields;

    expect(fields.find((field) => field.key === 'urlPathList')).toMatchObject({
      help: expect.stringContaining('授权控制器路径'),
      key: 'urlPathList',
      label: 'URL包含列表',
      loadOptions: expect.any(Function),
      remoteSearch: true,
      span: 2,
      type: 'tags',
    });
    expect(
      fields.find((field) => field.key === 'urlPathExcludeList'),
    ).toMatchObject({
      help: expect.stringContaining('授权控制器路径'),
      key: 'urlPathExcludeList',
      label: 'URL排除列表',
      loadOptions: expect.any(Function),
      remoteSearch: true,
      span: 2,
      type: 'tags',
    });
  });

  it('keeps every ACL match list on the compact any-match editor shape', () => {
    const fields = urlExAclPageCrudConfig.fields;

    expect(
      patternEditorFieldKeys.map((key) =>
        fields.find((field) => field.key === key),
      ),
    ).toEqual(
      patternEditorFieldKeys.map((key) =>
        expect.objectContaining({
          key,
          span: 2,
          type: 'tags',
        }),
      ),
    );
    expect(fields.find((field) => field.key === 'userRoleList')).toMatchObject({
      loadOptions: expect.any(Function),
      remoteSearch: true,
      type: 'tags',
    });
  });
});
