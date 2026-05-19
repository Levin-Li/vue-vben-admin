import { describe, expect, it } from 'vitest';

import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import {
  omitSimpleManagedFields,
  resolveSimpleContentEditorMeta,
  withSimpleManagedSubmit,
} from '../src/modules/com_levin_oak_base/views/simple-content-resource';

describe('simple content resource helpers', () => {
  it('omits managed content fields from full form submit values', () => {
    expect(
      omitSimpleManagedFields({
        content: '{"a":1}',
        name: '页面',
        requireAuthorizations: ['a:b:c:d'],
        type: 'json',
      }),
    ).toEqual({
      name: '页面',
      type: 'json',
    });
  });

  it('keeps existing transformSubmit while omitting managed fields', async () => {
    const config = withSimpleManagedSubmit({
      apiBase: '/SimplePage',
      fields: [],
      title: '简单页面',
      transformSubmit: (values) => ({
        ...values,
        name: String(values.name || '').trim(),
        touched: true,
      }),
    } satisfies CrudPageConfig);

    await expect(
      config.transformSubmit?.(
        {
          content: 'body',
          name: ' 页面 ',
          requireAuthorizations: ['perm'],
        },
        null,
      ),
    ).resolves.toEqual({
      name: '页面',
      touched: true,
    });
  });

  it('selects editors from simple page and form content types', () => {
    expect(
      resolveSimpleContentEditorMeta('page', { type: 'JsonSchema' }),
    ).toMatchObject({
      kind: 'json',
      title: 'JSON Schema',
    });
    expect(
      resolveSimpleContentEditorMeta('page', { type: 'Jsonp' }),
    ).toMatchObject({
      kind: 'code',
      language: 'javascript',
    });
    expect(
      resolveSimpleContentEditorMeta('page', { type: 'Freemark' }),
    ).toMatchObject({
      kind: 'code',
      language: 'html',
    });
    expect(
      resolveSimpleContentEditorMeta('form', { type: 'html' }),
    ).toMatchObject({
      kind: 'code',
      language: 'html',
    });
  });

  it('selects api content editor from script language', () => {
    expect(
      resolveSimpleContentEditorMeta('api', { language: 'JavaScript' }),
    ).toMatchObject({
      kind: 'code',
      language: 'javascript',
    });
    expect(
      resolveSimpleContentEditorMeta('api', { language: 'Groovy' }),
    ).toMatchObject({
      kind: 'code',
      language: 'groovy',
    });
  });
});
