import { describe, expect, it, vi } from 'vitest';

import { trafficControlRulePageCrudConfig } from '../config';

vi.mock('../../../api/traffic-control-rule-service', () => ({
  trafficControlRuleService: {},
}));

vi.mock('../../api-module', () => ({
  authorizedControllerPathOptionsLoader: async () => [],
  buildDictOptionsLoader: () => async () => [],
  buildEnumOptionsLoader: () => async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: '70%',
  roleOptionsLoader: async () => [],
  tenantSiteDomainOptionsLoader: async () => [],
  tenantOptionsLoader: async () => [],
}));

describe('traffic control rule page config', () => {
  const patternEditorFieldKeys = [
    'urlPathList',
    'urlPathExcludeList',
    'methodList',
    'domainList',
    'regionList',
    'ipList',
    'ipExcludeList',
    'userTypeList',
    'userRoleList',
    'limitDimensionList',
  ];

  it('exposes wildcard-aware path ip header and request parameter fields', () => {
    const fields = trafficControlRulePageCrudConfig.fields;

    expect(fields.find((field) => field.key === 'urlPathList')).toMatchObject({
      key: 'urlPathList',
      label: 'URL包含列表',
      loadOptions: expect.any(Function),
      remoteSearch: true,
      search: true,
      span: 2,
      table: true,
      type: 'tags',
    });
    expect(
      fields.find((field) => field.key === 'urlPathExcludeList'),
    ).toMatchObject({
      key: 'urlPathExcludeList',
      label: 'URL排除列表',
      loadOptions: expect.any(Function),
      remoteSearch: true,
      span: 2,
      type: 'tags',
    });
    expect(fields.find((field) => field.key === 'ipList')).toMatchObject({
      key: 'ipList',
      label: 'IP包含列表',
      search: true,
      span: 2,
      table: true,
      type: 'tags',
    });
    expect(fields.find((field) => field.key === 'domainList')).toMatchObject({
      help: expect.stringContaining('租户站点'),
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
      fullRow: true,
      help: expect.stringContaining('"name":"tenant*"'),
      key: 'requestParamRuleList',
      label: '请求参数匹配数组',
      placeholder:
        '[{"name":"tenant*","value":"ma?ket-*"},{"name":"status","value":"*"}]',
      type: 'json',
    });
    expect(
      fields.find((field) => field.key === 'headerRuleList'),
    ).toMatchObject({
      fullRow: true,
      help: expect.stringContaining('"name":"X-Tenant-*"'),
      key: 'headerRuleList',
      label: '请求头匹配数组',
      placeholder:
        '[{"name":"X-Tenant-*","value":"vip?"},{"name":"X-Client-App-Id","value":"*"}]',
      type: 'json',
    });
  });

  it('keeps traffic-control list-like fields available for the common pattern editor slots', () => {
    const fields = trafficControlRulePageCrudConfig.fields;

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
  });

  it('offers the supported limit dimensions in the form', () => {
    const field = trafficControlRulePageCrudConfig.fields.find(
      (item) => item.key === 'limitDimensionList',
    );

    expect(field).toMatchObject({
      key: 'limitDimensionList',
      label: '限流维度',
      options: expect.arrayContaining([
        expect.objectContaining({ value: 'Rule' }),
        expect.objectContaining({ value: 'Tenant' }),
        expect.objectContaining({ value: 'User' }),
        expect.objectContaining({ value: 'Ip' }),
        expect.objectContaining({ value: 'Path' }),
        expect.objectContaining({ value: 'Method' }),
        expect.objectContaining({ value: 'Header' }),
        expect.objectContaining({ value: 'Param' }),
      ]),
      span: 2,
      type: 'tags',
    });
  });

  it('keeps all list-like form values as arrays for the backend normalizer', async () => {
    expect(
      trafficControlRulePageCrudConfig.transformSubmit?.(
        {
          headerRuleList: [{ name: 'X-Tenant-*', value: 'vip?' }],
          ipList: ['10.0.?.*'],
          limitDimensionList: ['Rule', 'Header', 'Param'],
          methodList: ['GET', 'POST'],
          requestParamRuleList: [{ name: 'tenant*', value: 'ma?ket-*' }],
          urlPathList: ['/api/order/*'],
        },
        null,
      ),
    ).toMatchObject({
      headerRuleList: [{ name: 'X-Tenant-*', value: 'vip?' }],
      ipList: ['10.0.?.*'],
      limitDimensionList: ['Rule', 'Header', 'Param'],
      methodList: ['GET', 'POST'],
      requestParamRuleList: [{ name: 'tenant*', value: 'ma?ket-*' }],
      urlPathList: ['/api/order/*'],
    });
  });
});
