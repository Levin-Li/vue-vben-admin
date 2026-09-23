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

  it('qualifies the organization type sort field after loading parents', () => {
    expect(orgPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'type', sortField: '_org.type' }),
      ]),
    );
  });

  it('uses the current organization alias for all default table sort fields', () => {
    expect(orgPageCrudConfig.sortFieldPrefix).toBe('_org.');
  });

  it('supports contact information and district-level area selection', () => {
    expect(orgPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'contractPerson',
          layoutGroup: 'contact',
          table: true,
        }),
        expect.objectContaining({
          key: 'contractEmail',
          layoutGroup: 'contact',
          search: true,
          table: true,
        }),
        expect.objectContaining({
          key: 'contractPhone',
          layoutGroup: 'contact',
          table: true,
        }),
        expect.objectContaining({
          areaCascader: {
            selectableLevels: ['district'],
            valueKey: 'areaCode',
          },
          key: 'areaCode',
          search: true,
          table: true,
          type: 'area-cascader',
        }),
      ]),
    );
  });
});
