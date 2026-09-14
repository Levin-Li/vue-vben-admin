/** 使用与实际发送一致的正文及应用标识生成 URL ACL 签名；密钥不持久化。 */
export async function createAclSignatureHeaders(input: {
  appId: string;
  body: string;
  nonce?: string;
  secret: string;
  timestamp?: string;
}) {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      '当前浏览器不支持安全签名，请使用 HTTPS 或 localhost 访问。',
    );
  }
  const encoder = new TextEncoder();
  const hex = (bytes: ArrayBuffer) =>
    Array.from(new Uint8Array(bytes), (value) =>
      value.toString(16).padStart(2, '0'),
    ).join('');
  const timestamp = input.timestamp ?? String(Date.now());
  const nonce = input.nonce ?? crypto.randomUUID();
  const digest = hex(
    await crypto.subtle.digest('SHA-256', encoder.encode(input.body)),
  );
  const text = [input.appId, timestamp, nonce, digest].join('\n');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(input.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = hex(
    await crypto.subtle.sign('HMAC', key, encoder.encode(text)),
  );
  return {
    'X-UrlAcl-App-Id': input.appId,
    'X-UrlAcl-Timestamp': timestamp,
    'X-UrlAcl-Nonce': nonce,
    'X-UrlAcl-Body-Sha256': digest,
    'X-UrlAcl-Signature': signature,
  };
}
