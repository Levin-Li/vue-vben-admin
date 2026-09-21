import { describe, expect, it } from 'vitest';

import { domainPageCrudConfig } from '../config';

describe('domain page config', () => {
  it('keeps remark as a full-row textarea in the edit form', () => {
    const remarkField = domainPageCrudConfig.fields.find(
      (field) => field.key === 'remark',
    );

    expect(remarkField).toMatchObject({
      fullRow: true,
      key: 'remark',
      layoutNewRow: true,
      type: 'textarea',
    });
  });

  it('delegates dialog width and columns to the shared responsive CRUD layout', () => {
    expect(domainPageCrudConfig.formMaxColumns).toBeUndefined();
    expect(domainPageCrudConfig.modalWidth).toBeUndefined();
    expect(domainPageCrudConfig.modalWidthStrict).toBeUndefined();
  });

});
