import { describe, expect, it, vi } from 'vitest';

import { i18nResPageCrudConfig } from '../config';

vi.mock('../../../api/i18n-res-service', () => ({
  i18nResService: {},
}));

vi.mock('../../api-module', () => ({
  buildDictOptionsLoader: () => async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: '70%',
  tenantOptionsLoader: async () => [],
}));

describe('i18n resource page config', () => {
  it('shows the backend label field as the label value editor in create and edit forms', () => {
    const labelField = i18nResPageCrudConfig.fields.find(
      (field) => field.key === 'label',
    );

    expect(labelField).toMatchObject({
      formCreate: true,
      formEdit: true,
      fullRow: true,
      key: 'label',
      label: '标签值',
      required: true,
      type: 'textarea',
    });
  });

  it('shows module id for filtering and table inspection', () => {
    const moduleIdField = i18nResPageCrudConfig.fields.find(
      (field) => field.key === 'moduleId',
    );

    expect(moduleIdField).toMatchObject({
      key: 'moduleId',
      label: '模块ID',
      search: true,
      table: true,
    });
  });
});
