import { describe, expect, it } from 'vitest';

import { domainSslCertPageCrudConfig } from '../config';

describe('domain SSL certificate page config', () => {
  it('delegates dialog width and columns to the shared responsive CRUD layout', () => {
    expect(domainSslCertPageCrudConfig.formMaxColumns).toBeUndefined();
    expect(domainSslCertPageCrudConfig.modalWidth).toBeUndefined();
    expect(domainSslCertPageCrudConfig.modalWidthStrict).toBeUndefined();
  });

  it('keeps remark as the explicit full-row field', () => {
    expect(
      domainSslCertPageCrudConfig.fields.find(
        (field) => field.key === 'remark',
      ),
    ).toMatchObject({ fullRow: true, key: 'remark', type: 'textarea' });
  });

});
