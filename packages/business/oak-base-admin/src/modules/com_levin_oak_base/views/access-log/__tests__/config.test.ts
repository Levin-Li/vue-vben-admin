import { describe, expect, it, vi } from 'vitest';

import { accessLogPageCrudConfig } from '../config';

vi.mock('../../../api/access-log-service', () => ({
  accessLogService: {},
}));

vi.mock('../../api-module', () => ({
  DEFAULT_CRUD_MODAL_WIDTH: '80%',
  tenantOptionsLoader: async () => [],
}));

describe('access log page config', () => {
  function fieldByKey(key: string) {
    return accessLogPageCrudConfig.fields.find((field) => field.key === key);
  }

  it('merges request uri and method into one table column', () => {
    const field = fieldByKey('requestUri');

    expect(field).toMatchObject({
      key: 'requestUri',
      label: '请求信息',
      table: true,
      width: 320,
    });
    expect(
      field?.tableValue?.({
        requestMethod: 'GET',
        requestUri: '/clob/V1/api/rbac/getUser',
      }),
    ).toBe('GET /clob/V1/api/rbac/getUser');
    expect(fieldByKey('requestMethod')).toMatchObject({
      key: 'requestMethod',
      table: false,
    });
  });

  it('merges remote address and access region into one table column', () => {
    const field = fieldByKey('remoteAddr');

    expect(field).toMatchObject({
      key: 'remoteAddr',
      label: '来源信息',
      table: true,
      width: 180,
    });
    expect(
      field?.tableValue?.({
        accessRegion: '福建省 福州市 电信',
        remoteAddr: '39.144.124.184',
      }),
    ).toBe('39.144.124.184\n福建省 福州市 电信');
    expect(fieldByKey('accessRegion')).toMatchObject({
      form: false,
      key: 'accessRegion',
      table: false,
    });
    expect(fieldByKey('createTime')).toMatchObject({
      key: 'createTime',
      table: true,
    });
  });

  it('labels exception info for the detail display without adding a table column', () => {
    expect(fieldByKey('exceptionInfo')).toMatchObject({
      form: false,
      fullRow: true,
      key: 'exceptionInfo',
      label: '异常信息',
      table: false,
      type: 'textarea',
    });
  });
});
