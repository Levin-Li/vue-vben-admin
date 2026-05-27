import { describe, expect, it, vi } from 'vitest';

import { clientAppPageCrudConfig } from '../config';

vi.mock('../../../api/client-app-service', () => ({
  clientAppService: {},
}));

vi.mock('../../api-module', () => ({
  DEFAULT_CRUD_MODAL_WIDTH: '70%',
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
      help: expect.stringContaining('*和?'),
      key: 'allowedPathPatterns',
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
    expect(payload.allowedIpList).toBe('10.0.?.*\n127.0.0.1');
    expect(payload.allowedPathPatterns).toBe('/api/order/*');
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
    expect(payload.allowedIpList).toBe('10.0.0.1');
    expect(payload.allowedPathPatterns).toBe('/api/*');
  });
});
