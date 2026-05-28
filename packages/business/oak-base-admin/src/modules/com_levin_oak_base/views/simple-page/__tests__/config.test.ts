import { describe, expect, it, vi } from 'vitest';

import { simplePagePageCrudConfig } from '../config';

vi.mock('../../../api/simple-page-service', () => ({
  simplePageService: {},
}));

vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: () => 'SimplePage:action',
  }),
);

vi.mock('../../api-module', () => ({
  DEFAULT_CRUD_MODAL_WIDTH: '80%',
  buildDictOptionsLoader: () => async () => [],
  buildEnumOptionsLoader: () => async () => [],
  tenantOptionsLoader: async () => [],
}));

describe('simple page config', () => {
  it('keeps permission and content fields out of the generic create/edit form', () => {
    const fields = simplePagePageCrudConfig.fields;

    expect(
      fields.find((field) => field.key === 'requireAuthorizations'),
    ).toMatchObject({
      form: false,
      key: 'requireAuthorizations',
    });
    expect(fields.find((field) => field.key === 'content')).toMatchObject({
      form: false,
      key: 'content',
    });
  });
});
