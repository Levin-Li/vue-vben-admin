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
  it('shows runtime scope fields in CRUD forms and tables', () => {
    const expectedFieldKeys = [
      'appCode',
      'appVersion',
      'moduleId',
      'terminalType',
      'siteId',
      'domain',
      'languageCode',
      'nationCode',
      'resKey',
      'label',
      'resValue',
    ];
    const fields = i18nResPageCrudConfig.fields.filter((field) =>
      expectedFieldKeys.includes(field.key),
    );

    expect(fields.map((field) => field.key)).toEqual(expectedFieldKeys);
    for (const field of fields) {
      expect(field.form).not.toBe(false);
    }
    expect(fields.filter((field) => field.table).map((field) => field.key))
      .toEqual(expectedFieldKeys);
  });

  it('uses terminal type select options from the backend enum', () => {
    const terminalTypeField = i18nResPageCrudConfig.fields.find(
      (field) => field.key === 'terminalType',
    );

    expect(terminalTypeField).toMatchObject({
      key: 'terminalType',
      label: '终端类型',
      search: true,
      table: true,
      type: 'select',
    });
    expect(terminalTypeField?.options?.map((item) => item.value)).toEqual([
      'Admin',
      'Web',
      'H5',
      'MiniProgram',
      'App',
      'OpenApi',
    ]);
  });

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

  it('shows the resource value field as a full row editor', () => {
    const resValueField = i18nResPageCrudConfig.fields.find(
      (field) => field.key === 'resValue',
    );

    expect(resValueField).toMatchObject({
      fullRow: true,
      key: 'resValue',
      label: '资源值',
      table: true,
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
      required: true,
      search: true,
      table: true,
    });
  });
});
