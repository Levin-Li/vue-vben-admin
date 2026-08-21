import { describe, expect, it } from 'vitest';

import { resolveOverviewTotal } from '../overview-utils';

describe('resolveOverviewTotal', () => {
  it('uses the server total before the current page records', () => {
    expect(
      resolveOverviewTotal({
        items: [{ id: 'tenant-1' }],
        totals: 128,
      }),
    ).toBe(128);
  });

  it('supports common list response fields and array responses', () => {
    expect(resolveOverviewTotal({ totalCount: 12 })).toBe(12);
    expect(resolveOverviewTotal({ records: [{ id: 'brand-1' }] })).toBe(1);
    expect(resolveOverviewTotal([{ id: 'pay-order-1' }])).toBe(1);
  });

  it('does not turn an unknown response into zero', () => {
    expect(resolveOverviewTotal({ message: 'forbidden' })).toBeUndefined();
    expect(resolveOverviewTotal(undefined)).toBeUndefined();
  });
});
