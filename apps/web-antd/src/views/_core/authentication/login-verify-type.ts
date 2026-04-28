export type ContactVerifyCodeType = 'Email' | 'Sms';

export function resolveContactVerifyCodeType(
  account: string,
): ContactVerifyCodeType {
  const normalized = account.trim();
  const atIndex = normalized.indexOf('@');
  const lastDotIndex = normalized.lastIndexOf('.');

  return atIndex > 0 &&
    lastDotIndex > atIndex + 1 &&
    lastDotIndex < normalized.length - 1
    ? 'Email'
    : 'Sms';
}

export function extractReturnedVerifyCode(payload: any) {
  return (
    payload?.code ||
    payload?.verifyCode ||
    payload?.data?.code ||
    payload?.data?.verifyCode ||
    ''
  );
}
