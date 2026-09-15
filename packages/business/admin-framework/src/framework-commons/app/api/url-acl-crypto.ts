export const CLIENT_CRYPTO_PATH_SUFFIXES = [
  '/rbac/getverifycode',
  '/rbac/login',
  '/rbac/loginverifychallenge',
  '/rbac/loginverifychallenge/complete',
  'getverifycode',
  'login',
  'loginverifychallenge',
  'loginverifychallenge/complete',
];

export function isClientCryptoPath(url: unknown) {
  const value = String(url || '').toLowerCase();
  return CLIENT_CRYPTO_PATH_SUFFIXES.some((suffix) => value.endsWith(suffix));
}

export function hex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

export async function sha256(bytes: Uint8Array) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

export async function resolveMinuteByNonce(
  nonce: string,
  domain: string,
  nowMillis = Date.now(),
) {
  const encoder = new TextEncoder();
  const nowMinute = Math.floor(nowMillis / 60_000);
  for (let minute = nowMinute - 1; minute <= nowMinute + 1; minute++) {
    if (hex(await sha256(encoder.encode(`${minute}\n${domain}`))) === nonce) {
      return minute;
    }
  }
  throw new Error('加密响应已过期');
}

export async function importCryptoKey(
  domain: string,
  source: string,
  minute: number,
) {
  const material = await sha256(
    new TextEncoder().encode(`${domain}\n${source}\n${minute}`),
  );
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}
