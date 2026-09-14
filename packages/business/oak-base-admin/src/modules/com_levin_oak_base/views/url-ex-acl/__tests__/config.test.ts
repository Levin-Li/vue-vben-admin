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
    expect(
      fields.find((field) => field.key === 'headerRuleList'),
    ).toMatchObject({
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

// 覆盖请求体限制的录入边界与后端扩展信息结构，防止只展示字段却保存错位置。
describe('请求体大小限制配置', () => {
  const field = urlExAclPageCrudConfig.fields.find(
    (item) => item.key === 'exInfo.maxRequestBodyBytes',
  );
  if (!field) throw new Error('缺少请求体大小限制字段');

  it('声明字节阈值及适用类型与匹配边界', () => {
    expect(field).toMatchObject({
      defaultValue: 1_048_576,
      type: 'number',
      valueType: 'number',
    });
    expect(field.help).toContain('仅请求体大小限制类型生效');
    expect(field).not.toHaveProperty('visibleOn');
    expect(field.help).toContain('长度未知返回 411');
    expect(field.help).toContain('无正文 GET 也不例外');
    expect(field.help).toContain('建议仅匹配 POST/PUT/PATCH');
    expect(field.help).toContain('不支持用户类型、角色或请求参数');
  });

  it.each([0, -1, 1.5, '', null, 'abc', Number.POSITIVE_INFINITY])(
    '拒绝非法字节阈值 %s',
    (value) => {
      expect(
        field.validator?.(value, { interceptType: 'RequestBodyLimit' }),
      ).toBe('请求体最大字节数必须为正整数');
    },
  );

  it.each([1, 1_048_576, '10485760'])('允许正整数字节阈值 %s', (value) => {
    expect(
      field.validator?.(value, { interceptType: 'RequestBodyLimit' }),
    ).toBeUndefined();
  });

  it('将数值控件映射回扩展信息并保留其他参数', () => {
    const result = urlExAclPageCrudConfig.transformSubmit?.(
      {
        interceptType: 'RequestBodyLimit',
        exInfo: { other: 'keep', maxRequestBodyBytes: 1 },
        'exInfo.maxRequestBodyBytes': 10_485_760,
      },
      null,
    );
    expect(result).toMatchObject({
      exInfo: { other: 'keep', maxRequestBodyBytes: 10_485_760 },
    });
    expect(Object.keys(result ?? {})).not.toContain(
      'exInfo.maxRequestBodyBytes',
    );
  });

  it('未提交阈值时不补入默认值或改变其他类型扩展信息', () => {
    const result = urlExAclPageCrudConfig.transformSubmit?.(
      {
        interceptType: 'Sign',
        exInfo: { other: 'keep' },
        'exInfo.maxRequestBodyBytes': 0,
      },
      null,
    );
    expect(result).toMatchObject({ exInfo: { other: 'keep' } });
    expect((result as any).exInfo).not.toHaveProperty('maxRequestBodyBytes');
  });
});

// 其他类型仍可编辑和保存，残留阈值不会写入无关规则。
it('其他拦截类型不校验也不提交请求体阈值', () => {
  const field = urlExAclPageCrudConfig.fields.find(
    (item) => item.key === 'exInfo.maxRequestBodyBytes',
  );
  expect(field?.validator?.(0, { interceptType: 'Sign' })).toBeUndefined();
  expect(
    urlExAclPageCrudConfig.transformSubmit?.(
      { interceptType: 'Sign', 'exInfo.maxRequestBodyBytes': 0 },
      null,
    ),
  ).not.toHaveProperty('exInfo');
});
