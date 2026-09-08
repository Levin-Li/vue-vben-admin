import type { CrudFieldConfig } from '../types';

import { describe, expect, it } from 'vitest';

import {
  getCrudFieldJsonSchemaInput,
  getJsonSchemaSourceInput,
  getJsonValueJsonSchemaInput,
  hasCrudFieldJsonSchema,
  isCrudFieldJsonSchemaInline,
  resolveJsonSchemaSource,
} from '../json-schema-source';

describe('json schema source', () => {
  it('reads schema metadata from supported field property names', () => {
    expect(
      getCrudFieldJsonSchemaInput({
        '@JsonSchema': 'class:com.example.User',
        key: 'exInfo',
        label: '扩展信息',
        type: 'json',
      }),
    ).toBe('class:com.example.User');

    expect(
      getCrudFieldJsonSchemaInput({
        JsonSchema: 'url:/schema/ex-info.json',
        key: 'exInfo',
        label: '扩展信息',
        type: 'json',
      }),
    ).toBe('url:/schema/ex-info.json');

    expect(
      getCrudFieldJsonSchemaInput({
        jsonSchema: { properties: { name: { type: 'string' } } },
        key: 'exInfo',
        label: '扩展信息',
        type: 'json',
      }),
    ).toEqual({ properties: { name: { type: 'string' } } });

    expect(
      getCrudFieldJsonSchemaInput({
        '@Jsonschema': 'class:com.example.Profile',
        key: 'exInfo',
        label: '扩展信息',
        type: 'json',
      }),
    ).toBe('class:com.example.Profile');
  });

  it('resolves class url and inline schema formats', () => {
    expect(resolveJsonSchemaSource('class:com.example.User')).toEqual({
      kind: 'java-type',
      typeGenericStr: 'com.example.User',
    });

    expect(resolveJsonSchemaSource('url:/schema/ex-info.json')).toEqual({
      kind: 'url',
      url: '/schema/ex-info.json',
    });

    expect(
      resolveJsonSchemaSource(
        '{"type":"object","properties":{"enabled":{"type":"boolean"}}}',
      ),
    ).toEqual({
      kind: 'inline',
      schema: {
        properties: {
          enabled: {
            type: 'boolean',
          },
        },
        type: 'object',
      },
    });
  });

  it('reads schema metadata from the json object value when field metadata is absent', () => {
    const field: CrudFieldConfig = {
      key: 'exInfo',
      label: '扩展信息',
      type: 'json',
    };
    const value = {
      '@JsonSchema': 'class:com.example.ExInfo',
      enabled: true,
    };

    expect(getJsonValueJsonSchemaInput(value)).toBe('class:com.example.ExInfo');
    expect(getJsonSchemaSourceInput(field, value)).toBe(
      'class:com.example.ExInfo',
    );
    expect(hasCrudFieldJsonSchema(field, value)).toBe(true);
  });

  it('uses json value schema metadata before field metadata', () => {
    const field: CrudFieldConfig = {
      '@JsonSchema': 'class:com.example.FieldConfig',
      key: 'exInfo',
      label: '扩展信息',
      type: 'json',
    };

    expect(
      getJsonSchemaSourceInput(field, {
        JsonSchema: 'url:/schema/ex-info.json',
      }),
    ).toBe('url:/schema/ex-info.json');
  });

  it('resolves object source shorthand formats', () => {
    expect(resolveJsonSchemaSource({ class: 'com.example.User' })).toEqual({
      kind: 'java-type',
      typeGenericStr: 'com.example.User',
    });

    expect(resolveJsonSchemaSource({ url: '/schema/ex-info.json' })).toEqual({
      kind: 'url',
      url: '/schema/ex-info.json',
    });
  });

  it('uses popup mode by default and inline mode only when explicitly configured', () => {
    const popupField: CrudFieldConfig = {
      '@JsonSchema': '{"type":"object"}',
      key: 'exInfo',
      label: '扩展信息',
      type: 'json',
    };
    const inlineField: CrudFieldConfig = {
      JsonSchema: '{"type":"object"}',
      JsonSchemaMode: 'inline',
      key: 'exInfo',
      label: '扩展信息',
      type: 'json',
    };

    expect(hasCrudFieldJsonSchema(popupField)).toBe(true);
    expect(isCrudFieldJsonSchemaInline(popupField)).toBe(false);
    expect(isCrudFieldJsonSchemaInline(inlineField)).toBe(true);
  });

  it('treats blank schema metadata as absent', () => {
    expect(
      hasCrudFieldJsonSchema({
        '@JsonSchema': '  ',
        key: 'exInfo',
        label: '扩展信息',
        type: 'json',
      }),
    ).toBe(false);
  });

  const referenceField: CrudFieldConfig = {
    jsonSchema: ':configDataEditor',
    key: 'configData',
    label: '配置数据',
    type: 'json',
  };

  it('resolves an explicit editor reference separately for each record', () => {
    for (const source of [
      'class:com.example.TaskConfig',
      'url:/schema/task-config.json',
      { properties: { enabled: { type: 'boolean' } }, type: 'object' },
    ]) {
      const record = { configDataEditor: source };
      expect(getJsonSchemaSourceInput(referenceField, null, record)).toEqual(
        source,
      );
      expect(hasCrudFieldJsonSchema(referenceField, null, record)).toBe(true);
    }
    expect(
      hasCrudFieldJsonSchema(referenceField, null, { configDataEditor: '' }),
    ).toBe(false);
  });

  it.each([undefined, null, '', '   ', 'unknown', ':anotherEditor', [], 42])(
    'ignores an unusable referenced editor: %j',
    (source) => {
      const record = { configDataEditor: source };
      expect(
        getJsonSchemaSourceInput(referenceField, undefined, record),
      ).toBeUndefined();
      expect(hasCrudFieldJsonSchema(referenceField, undefined, record)).toBe(
        false,
      );
    },
  );

  it('does not use unresolved references or infer an editor from other fields', () => {
    for (const record of [
      undefined,
      {},
      { anotherEditor: 'class:com.example.TaskConfig' },
      Object.create({ configDataEditor: 'class:com.example.TaskConfig' }),
    ]) {
      expect(
        getJsonSchemaSourceInput(referenceField, undefined, record),
      ).toBeUndefined();
      expect(hasCrudFieldJsonSchema(referenceField, undefined, record)).toBe(
        false,
      );
    }
  });

  it.each([
    '__proto__',
    'prototype',
    'constructor',
    'nested.editor',
    'editor()',
    '',
    ' configDataEditor',
  ])('rejects unsafe or non-field references: %s', (key) => {
    const field = { ...referenceField, jsonSchema: `:${key}` };
    const record = { [key]: 'class:com.example.TaskConfig' };
    expect(getJsonSchemaSourceInput(field, undefined, record)).toBeUndefined();
    expect(hasCrudFieldJsonSchema(field, undefined, record)).toBe(false);
  });

  it('keeps embedded schema precedence over referenced editors', () => {
    const value = { '@JsonSchema': 'class:com.example.EmbeddedConfig' };
    expect(
      getJsonSchemaSourceInput(referenceField, value, {
        configDataEditor: 'class:com.example.RecordConfig',
      }),
    ).toBe('class:com.example.EmbeddedConfig');
    expect(
      getJsonSchemaSourceInput(referenceField, JSON.stringify(value)),
    ).toBe('class:com.example.EmbeddedConfig');
    expect(hasCrudFieldJsonSchema(referenceField, value)).toBe(true);
  });

  it('keeps ordinary explicit schema sources independent of the record', () => {
    for (const source of [
      'class:com.example.TaskConfig',
      'url:/schema/task-config.json',
      '{"type":"object"}',
    ]) {
      const field = { ...referenceField, jsonSchema: source };
      expect(getJsonSchemaSourceInput(field, null, {})).toBe(source);
      expect(hasCrudFieldJsonSchema(field, null, {})).toBe(true);
    }
    expect(
      hasCrudFieldJsonSchema({ ...referenceField, jsonSchema: 'unknown' }),
    ).toBe(false);
  });
});
