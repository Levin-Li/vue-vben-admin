import { describe, expect, it } from 'vitest';

import {
  getCrudFieldJsonSchemaInput,
  getJsonSchemaSourceInput,
  getJsonValueJsonSchemaInput,
  hasCrudFieldJsonSchema,
  isCrudFieldJsonSchemaInline,
  resolveJsonSchemaSource,
} from '../json-schema-source';
import type { CrudFieldConfig } from '../types';

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

    expect(getJsonValueJsonSchemaInput(value)).toBe(
      'class:com.example.ExInfo',
    );
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
});
