import { describe, expect, it } from 'vitest';

import { legalSubjectOptionsLoader } from '../../api-module';
import { orgPageCrudConfig } from '../config';

describe('orgPageCrudConfig', () => {
  it('uses the legal subject field for create, edit, and query', () => {
    expect(orgPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'legalSubjectId',
          loadOptions: legalSubjectOptionsLoader,
          remoteSearch: true,
          search: true,
          type: 'select',
        }),
      ]),
    );
  });

  it('exposes a responsible user selector for every organization node', () => {
    expect(orgPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'responsibleUserId',
          label: '组织负责人',
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

  it('supports organization contact information', () => {
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
      ]),
    );
  });

  it('does not expose the removed organization area code', () => {
    expect(
      orgPageCrudConfig.fields.some((field) => field.key === 'areaCode'),
    ).toBe(false);
  });
});
