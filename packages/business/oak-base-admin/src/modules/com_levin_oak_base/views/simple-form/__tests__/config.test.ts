import { describe, expect, it, vi } from 'vitest';

import { simpleFormPageCrudConfig } from '../config';

vi.mock('../../../api/simple-form-service', () => ({
  simpleFormService: {},
}));

vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: () => 'SimpleForm:action',
  }),
);

vi.mock('../../api-module', () => ({
  DEFAULT_CRUD_MODAL_WIDTH: '80%',
  buildDictOptionsLoader: () => async () => [],
  buildEnumOptionsLoader: () => async () => [],
  tenantOptionsLoader: async () => [],
}));

describe('simple form config', () => {
  it('keeps permission and content fields out of the generic create/edit form', () => {
    const fields = simpleFormPageCrudConfig.fields;

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
