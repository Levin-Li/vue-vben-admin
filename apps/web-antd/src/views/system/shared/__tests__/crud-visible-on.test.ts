import { describe, expect, it } from 'vitest';

import { evaluateCrudVisibleOn } from '../crud-visible-on';

describe('crud-visible-on', () => {
  it('allows empty visibleOn expressions', () => {
    expect(evaluateCrudVisibleOn('', { status: 'Draft' }, {})).toBe(true);
  });

  it('evaluates expressions against the current record properties', () => {
    expect(
      evaluateCrudVisibleOn(
        "(status == 'Draft' || status == 'AuditRejected')",
        { status: 'Draft' },
        {},
      ),
    ).toBe(true);

    expect(
      evaluateCrudVisibleOn(
        "(status == 'Draft' || status == 'AuditRejected')",
        { status: 'Published' },
        {},
      ),
    ).toBe(false);
  });

  it('supports the __user variable from current login user info', () => {
    expect(
      evaluateCrudVisibleOn(
        "__user && __user.saasUser && status == 'Draft'",
        { status: 'Draft' },
        { saasUser: true },
      ),
    ).toBe(true);
  });

  it('returns false for invalid scripts instead of throwing', () => {
    expect(evaluateCrudVisibleOn('status ===', { status: 'Draft' }, {})).toBe(
      false,
    );
  });
});
