import { describe, expect, it } from 'vitest';

import { personalPeriodStart } from './workflow-personal-filters';

describe('个人流程时间范围', () => {
  it('近半年按日历月回推，目标月没有同一天时取月末', () => {
    const now = new Date(2026, 7, 31, 12, 30);
    const actual = new Date(personalPeriodStart('halfYear', now) ?? '');
    expect(actual.getFullYear()).toBe(2026);
    expect(actual.getMonth()).toBe(1);
    expect(actual.getDate()).toBe(28);
    expect(actual.getHours()).toBe(12);
  });

  it('全部时间不限制开始时间', () => {
    expect(personalPeriodStart('all')).toBeUndefined();
  });
});
