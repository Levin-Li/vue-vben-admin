import { describe, expect, it, vi } from 'vitest';

import { simpleApiPageCrudConfig } from '../config';

vi.mock('../../../api/simple-api-service', () => ({
  simpleApiService: {},
}));

vi.mock('../../api-module', () => ({
  DEFAULT_CRUD_MODAL_WIDTH: '80%',
  buildDictOptionsLoader: () => async () => [],
  buildEnumOptionsLoader: () => async () => [],
  tenantOptionsLoader: async () => [],
}));

describe('simple api page config', () => {
  it('keeps implementation-only fields out of the generic create/edit form', () => {
    const fields = simpleApiPageCrudConfig.fields;

    expect(fields.find((field) => field.key === 'content')).toMatchObject({
      form: false,
      key: 'content',
    });
    expect(fields.find((field) => field.key === 'setting')).toMatchObject({
      form: false,
      key: 'setting',
    });
    expect(
      fields.find((field) => field.key === 'requireAuthorizations'),
    ).toMatchObject({
      form: false,
      key: 'requireAuthorizations',
    });
  });

  it('offers HTTP method options in the create and edit form', () => {
    const methodFields = simpleApiPageCrudConfig.fields.filter(
      (field) => field.key === 'methods',
    );

    expect(methodFields).toHaveLength(2);
    methodFields.forEach((field) => {
      expect(field).toMatchObject({
        key: 'methods',
        label: 'HTTP方法',
        options: expect.arrayContaining([
          expect.objectContaining({ value: 'GET' }),
          expect.objectContaining({ value: 'POST' }),
          expect.objectContaining({ value: 'PUT' }),
          expect.objectContaining({ value: 'DELETE' }),
          expect.objectContaining({ value: 'PATCH' }),
        ]),
        type: 'select',
      });
    });
  });
});
