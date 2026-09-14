import { describe, expect, it } from 'vitest';

import {
  buildTableColumnPreference,
  getTableColumnPreferenceStorageKey,
  readTableColumnPreference,
  TABLE_COLUMN_PREFERENCE_VERSION,
} from '../crud-table-column-preference';

describe('crud table column preference', () => {
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
