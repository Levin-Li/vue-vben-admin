import { describe, expect, it } from 'vitest';

import { legalSubjectOptionsLoader } from '../../api-module';
import { orgPageCrudConfig } from '../config';

describe('orgPageCrudConfig', () => {
  it('uses the legal subject field for create, edit, and query', () => {
    expect(orgPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'externalLegalSubjectId',
          loadOptions: legalSubjectOptionsLoader,
          remoteSearch: true,
          search: true,
          type: 'select',
        }),
      ]),
    );
  });

  it('requires the category required by the Org entity', () => {
    expect(orgPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'category', required: true }),
      ]),
    );
  });
});
