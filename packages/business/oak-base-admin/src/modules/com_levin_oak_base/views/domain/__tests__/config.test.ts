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

  it('keeps the domain dialog at the wide content-form width', () => {
    expect(domainPageCrudConfig.modalWidth).toBe(1200);
  });
});
