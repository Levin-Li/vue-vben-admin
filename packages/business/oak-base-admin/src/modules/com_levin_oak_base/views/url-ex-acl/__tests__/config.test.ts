import { describe, expect, it, vi } from 'vitest';

import { urlExAclPageCrudConfig } from '../config';

vi.mock('../../../api/url-ex-acl-service', () => ({
  urlExAclService: {},
}));

vi.mock('../../api-module', () => ({
  authorizedControllerPathOptionsLoader: async () => [],
  buildEnumOptionsLoader: () => async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: '80%',
  roleOptionsLoader: async () => [],
  tenantSiteDomainOptionsLoader: async () => [],
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
    'requestParamRuleList',
    'headerRuleList',
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
    expect(fields.find((field) => field.key === 'methodList')).toMatchObject({
      key: 'methodList',
      label: '请求方法包含列表',
      options: expect.arrayContaining([
        expect.objectContaining({ value: 'GET' }),
        expect.objectContaining({ value: 'POST' }),
        expect.objectContaining({ value: 'PUT' }),
        expect.objectContaining({ value: 'DELETE' }),
        expect.objectContaining({ value: 'PATCH' }),
      ]),
      span: 2,
      type: 'tags',
    });
    expect(fields.find((field) => field.key === 'domainList')).toMatchObject({
      key: 'domainList',
      label: '域名包含列表',
      loadOptions: expect.any(Function),
      remoteSearch: true,
      span: 2,
      type: 'tags',
    });
    expect(
      fields.find((field) => field.key === 'requestParamRuleList'),
    ).toMatchObject({
      help: expect.stringContaining('name=value'),
      key: 'requestParamRuleList',
      label: '请求参数匹配列表',
      placeholder: '例如 tenant*=ma?ket-*',
      span: 2,
      type: 'tags',
    });
    expect(fields.find((field) => field.key === 'headerRuleList')).toMatchObject({
      help: expect.stringContaining('name=value'),
      key: 'headerRuleList',
      label: '请求头匹配列表',
      placeholder: '例如 X-Tenant-*=vip?',
      span: 2,
      type: 'tags',
    });
  });

  it('normalizes parameter and header rule lists without storing URL encoded text', () => {
    expect(
      urlExAclPageCrudConfig.transformSubmit?.(
        {
          headerRuleList: [{ name: 'X-Tenant-*', value: 'vip?' }],
          requestParamRuleList: ['tenant*=ma?ket-*'],
          urlPathList: ['/api/*'],
        },
        null,
      ),
    ).toMatchObject({
      headerRuleList: ['X-Tenant-*=vip?'],
      requestParamRuleList: ['tenant*=ma?ket-*'],
      urlPathList: ['/api/*'],
    });
  });
});
