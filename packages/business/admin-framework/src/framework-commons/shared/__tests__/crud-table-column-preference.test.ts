import { describe, expect, it } from 'vitest';

import {
  buildTableColumnPreference,
  getTableColumnPreferenceStorageKey,
  readTableColumnPreference,
  TABLE_COLUMN_PREFERENCE_VERSION,
} from '../crud-table-column-preference';
import { normalizeLeftFixedTableColumns } from '../crud-table-columns';

describe('crud table column preference', () => {
  it('keeps every left and right fixed column in its fixed group', () => {
    expect(
      normalizeLeftFixedTableColumns(
        [
          { fixed: 'left', key: '__tenant' },
          { fixed: 'left', key: 'orgName' },
          { fixed: undefined, key: 'name' },
          { fixed: 'right', key: '__actions' },
        ],
        (field) => field.fixed,
        (field) => field.key,
      ),
    ).toEqual({ __actions: 'right', __tenant: 'left', orgName: 'left' });
  });

  it('persists hidden columns and local column order', () => {
    expect(buildTableColumnPreference(['tenantType'], ['tenantName'])).toEqual({
      hiddenKeys: ['tenantType'],
      orderedKeys: ['tenantName'],
      version: TABLE_COLUMN_PREFERENCE_VERSION,
    });
  });

  it('isolates preferences by route and list table name', () => {
    expect(
      getTableColumnPreferenceStorageKey('/clob/V1/Tenant', 'default'),
    ).toBe('vben:crud-table-columns:/clob/V1/Tenant:default');
    expect(
      getTableColumnPreferenceStorageKey('/clob/V1/Tenant', 'archived'),
    ).toBe('vben:crud-table-columns:/clob/V1/Tenant:archived');
    expect(
      getTableColumnPreferenceStorageKey('/clob/V1/Organization', 'default'),
    ).toBe('vben:crud-table-columns:/clob/V1/Organization:default');
  });

  it('keeps only hidden columns available after page display settings resolve', () => {
    expect(
      readTableColumnPreference(
        JSON.stringify({
          fixedMap: { tenantName: 'left' },
          hiddenKeys: ['tenantType', 'removedColumn'],
          orderedKeys: ['tenantType', 'tenantName'],
          version: 2,
        }),
        ['tenantName', 'tenantType'],
      ),
    ).toEqual({
      hasStoredPreference: true,
      hiddenKeys: ['tenantType'],
      invalid: false,
      orderedKeys: ['tenantType', 'tenantName'],
    });
  });

  it('marks malformed cache as invalid so callers can clear it', () => {
    expect(readTableColumnPreference('{', ['tenantName'])).toEqual({
      hasStoredPreference: false,
      hiddenKeys: [],
      invalid: true,
      orderedKeys: [],
    });
  });
});
