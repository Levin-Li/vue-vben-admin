import { describe, expect, it } from 'vitest';

import {
  encodeUrlParamValue,
  encodeUrlPathSegments,
} from '../common/url-encoding';

describe('url encoding helpers', () => {
  it('encodes any path parameter segment', () => {
    expect(
      encodeUrlPathSegments(
        '/TenantSite/site id/dnsRecord/com.example.Outer$Inner',
      ),
    ).toBe('/TenantSite/site%20id/dnsRecord/com.example.Outer%24Inner');
  });

  it('keeps already encoded path segments stable', () => {
    expect(encodeUrlPathSegments('/TenantSite/site%20id')).toBe(
      '/TenantSite/site%20id',
    );
  });

  it('does not try to reprocess query strings when encoding path segments', () => {
    expect(
      encodeUrlPathSegments('/enums?enumName=com.example.Outer$Inner'),
    ).toBe('/enums?enumName=com.example.Outer$Inner');
  });

  it('encodes hand-written query values explicitly', () => {
    expect(encodeUrlParamValue('com.example.Outer$Inner')).toBe(
      'com.example.Outer%24Inner',
    );
  });
});
