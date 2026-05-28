import { describe, expect, it, vi } from 'vitest';

import { sortFormLayoutFields } from '@levin/admin-framework/framework-commons/shared/crud-form-layout';

import { clientAppPageCrudConfig } from '../config';

const mocks = vi.hoisted(() => ({
  authorizedControllerPathOptionsLoader: vi.fn(async () => []),
}));

vi.mock('../../../api/client-app-service', () => ({
  clientAppService: {},
}));

vi.mock('../../api-module', () => ({
  DEFAULT_CRUD_MODAL_WIDTH: '70%',
  authorizedControllerPathOptionsLoader:
    mocks.authorizedControllerPathOptionsLoader,
  tenantOptionsLoader: async () => [],
  userOptionsLoader: async () => [],
}));

describe('client app page config', () => {
  it('uses generated immutable credentials and wildcard pattern editors', () => {
    const fields = clientAppPageCrudConfig.fields;

    expect(fields.find((field) => field.key === 'appId')).toMatchObject({
      disabledOnEdit: true,
      formCreate: false,
      key: 'appId',
    });
    expect(fields.find((field) => field.key === 'appSignSecret')).toMatchObject(
      {
        disabledOnEdit: true,
        key: 'appSignSecret',
        type: 'password',
      },
    );
    expect(
      fields.find((field) => field.key === 'allowedPathPatterns'),
    ).toMatchObject({
      help: expect.stringContaining('URL路径'),
      key: 'allowedPathPatterns',
      loadOptions: mocks.authorizedControllerPathOptionsLoader,
      remoteSearch: true,
      type: 'tags',
    });
    expect(fields.find((field) => field.key === 'allowedIpList')).toMatchObject(
      {
        help: expect.stringContaining('*和?'),
        key: 'allowedIpList',
        type: 'tags',
      },
    );
  });

  it('keeps credential and wildcard editors aligned with related short fields', () => {
    const fields = clientAppPageCrudConfig.fields;
    const indexOf = (key: string) =>
      fields.findIndex((field) => field.key === key);
    const visualKeys = sortFormLayoutFields(fields).map((field) => field.key);
    const visualIndexOf = (key: string) => visualKeys.indexOf(key);

    expect(indexOf('expiredTime')).toBeLessThan(indexOf('appSignSecret'));
    expect(fields.find((field) => field.key === 'appSignSecret')).toMatchObject(
      {
        span: 3,
      },
    );
    expect(
      fields.find((field) => field.key === 'allowedPathPatterns'),
    ).toMatchObject({
      layoutGroup: 'business',
      layoutNewRow: true,
      layoutOrder: 10,
      span: 2,
    });
    expect(fields.find((field) => field.key === 'allowedIpList')).toMatchObject(
      {
        layoutGroup: 'business',
        layoutOrder: 20,
        span: 2,
      },
    );
    expect(fields.find((field) => field.key === 'exInfo')).toMatchObject({
      layoutGroup: 'extension',
      layoutNewRow: true,
    });
    expect(fields.find((field) => field.key === 'orderCode')).toMatchObject({
      layoutGroup: 'business',
      layoutOrder: 30,
    });
    expect(visualIndexOf('allowedPathPatterns')).toBeLessThan(
      visualIndexOf('allowedIpList'),
    );
    expect(visualIndexOf('allowedIpList')).toBeLessThan(
      visualIndexOf('orderCode'),
    );
    expect(visualIndexOf('orderCode')).toBeLessThan(visualIndexOf('enable'));
    expect(visualIndexOf('enable')).toBeLessThan(visualIndexOf('editable'));
    expect(visualIndexOf('editable')).toBeLessThan(visualIndexOf('exInfo'));
  });

  it('generates appId on create and serializes wildcard lists', async () => {
    const payload = await clientAppPageCrudConfig.transformSubmit!(
      {
        allowedIpList: ['10.0.?.*', '127.0.0.1'],
        allowedPathPatterns: ['/api/order/*'],
        appSignSecret: '',
        name: '测试应用',
      },
      null,
    );

    expect(payload.appId).toMatch(/^app_/);
    expect(payload.appSignSecret).toBeUndefined();
    expect(payload.allowedIpList).toEqual(['10.0.?.*', '127.0.0.1']);
    expect(payload.allowedPathPatterns).toEqual(['/api/order/*']);
  });

  it('does not submit immutable credentials on edit', async () => {
    const payload = await clientAppPageCrudConfig.transformSubmit!(
      {
        allowedIpList: ['10.0.0.1'],
        allowedPathPatterns: ['/api/*'],
        appId: 'app_should_not_change',
        appSignSecret: 'secret_should_not_change',
        id: 'client-app-1',
        name: '测试应用',
      },
      { id: 'client-app-1' },
    );

    expect(payload.appId).toBeUndefined();
    expect(payload.appSignSecret).toBeUndefined();
    expect(payload.allowedIpList).toEqual(['10.0.0.1']);
    expect(payload.allowedPathPatterns).toEqual(['/api/*']);
  });
});
