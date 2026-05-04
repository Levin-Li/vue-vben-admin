import { describe, expect, it } from 'vitest';

import {
  extractReturnedVerifyCode,
  resolveContactVerifyCodeType,
} from '../login-verify-type';

describe('login-verify-type', () => {
  it('uses email verify code for email accounts', () => {
    expect(resolveContactVerifyCodeType('admin@example.com')).toBe('Email');
  });

  it('uses sms verify code for non-email accounts', () => {
    expect(resolveContactVerifyCodeType('13800138000')).toBe('Sms');
    expect(resolveContactVerifyCodeType('sa')).toBe('Sms');
  });

  it('extracts returned verify code from backend test payload', () => {
    expect(extractReturnedVerifyCode({ code: '1234' })).toBe('1234');
    expect(extractReturnedVerifyCode({ data: { verifyCode: '5678' } })).toBe(
      '5678',
    );
  });
});
