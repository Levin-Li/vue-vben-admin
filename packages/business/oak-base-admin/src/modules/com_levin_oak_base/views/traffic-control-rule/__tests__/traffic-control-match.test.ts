import { describe, expect, it } from 'vitest';

import {
  matchPatternList,
  normalizeNameValueRuleList,
  matchRuleList,
  normalizePatternList,
  normalizeRuleList,
  validateNameValueRuleItem,
  wildcardMatch,
} from '../traffic-control-match';

describe('traffic control match helpers', () => {
  it('matches wildcard patterns with star and question mark', () => {
    expect(wildcardMatch('/api/order/*', '/api/order/list')).toBe(true);
    expect(wildcardMatch('/api/order/??/detail', '/api/order/ab/detail')).toBe(
      true,
    );
    expect(wildcardMatch('/api/order/??/detail', '/api/order/abc/detail')).toBe(
      false,
    );
    expect(wildcardMatch('10.0.?.*', '10.0.1.23')).toBe(true);
  });

  it('normalizes string arrays from arrays and separated text', () => {
    expect(normalizePatternList(['GET', 'POST'])).toEqual(['GET', 'POST']);
    expect(normalizePatternList('GET,POST\nDELETE|PATCH')).toEqual([
      'GET',
      'POST',
      'DELETE',
      'PATCH',
    ]);
    expect(normalizePatternList('GET，POST;PATCH')).toEqual([
      'GET',
      'POST',
      'PATCH',
    ]);
    expect(normalizePatternList('["Rule","Header"]')).toEqual([
      'Rule',
      'Header',
    ]);
  });

  it('tests list fields against real input', () => {
    const result = matchPatternList(
      ['/api/order/*', '/api/pay/??'],
      '/api/order/list',
    );

    expect(result.matched).toBe(true);
    expect(result.matchedPatterns).toEqual(['/api/order/*']);
  });

  it('normalizes and tests parameter or header rules', () => {
    expect(
      normalizeRuleList([{ name: 'tenant*', value: 'ma?ket-*' }, 'status=*']),
    ).toEqual([
      {
        namePatterns: ['tenant*'],
        required: true,
        valuePatterns: ['ma?ket-*'],
      },
      {
        namePatterns: ['status'],
        required: true,
        valuePatterns: ['*'],
      },
    ]);
    expect(normalizeRuleList(['tenant*=ma?ket-*'])).toEqual([
      {
        namePatterns: ['tenant*'],
        required: true,
        valuePatterns: ['ma?ket-*'],
      },
    ]);
    expect(normalizeNameValueRuleList(['tenant*=ma?ket-*'])).toEqual([
      'tenant*=ma?ket-*',
    ]);

    const result = matchRuleList(['X-Tenant-*=vip?'], 'x-tenant-id', 'vip1');

    expect(result.matched).toBe(true);
    expect(result.matchedRules[0]?.namePatterns).toEqual(['X-Tenant-*']);
  });

  it('validates name value rule items before saving them', () => {
    expect(validateNameValueRuleItem('tenant=demo')).toBe(true);
    expect(validateNameValueRuleItem('tenant')).toContain('一个等号');
    expect(validateNameValueRuleItem('tenant=demo=extra')).toContain(
      '一个等号',
    );
    expect(validateNameValueRuleItem('tenant=')).toContain('不能为空');
    expect(validateNameValueRuleItem('=demo')).toContain('不能为空');
  });
});
