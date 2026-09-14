import { RequestService, ResAuthorize, Service } from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

export type AclTestKind = 'email' | 'hmi' | 'mfa' | 'sign' | 'sms';

@Service({
  basePath: '/aclTest',
  title: '访问控制测试',
  controllerClass: 'com.levin.oak.base.controller.BizAclTestController',
})
export class AclTestService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({ ignored: true })
  email(data: string) {
    return this.post('email', {
      data,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  @ResAuthorize({ ignored: true })
  hmi(data: string) {
    return this.post('hmi', {
      data,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  @ResAuthorize({ ignored: true })
  mfa(data: string) {
    return this.post('mfa', {
      data,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  @ResAuthorize({ ignored: true })
  async sign(data: string, headers: Record<string, string>) {
    // 签名拒绝的 401 不代表登录过期；此入口独立发送，不参与会话刷新或重试。
    const response = await fetch(this.buildRequestPath('sign'), {
      body: data,
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'X-UrlAcl-App-Id': headers['X-UrlAcl-App-Id'] ?? '',
        'X-UrlAcl-Timestamp': headers['X-UrlAcl-Timestamp'] ?? '',
        'X-UrlAcl-Nonce': headers['X-UrlAcl-Nonce'] ?? '',
        'X-UrlAcl-Body-Sha256': headers['X-UrlAcl-Body-Sha256'] ?? '',
        'X-UrlAcl-Signature': headers['X-UrlAcl-Signature'] ?? '',
      },
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    let result: unknown = text;
    try {
      result = JSON.parse(text);
    } catch {
      // 保留非 JSON 拒绝响应，便于页面显示服务端原因。
    }
    if (!response.ok) {
      const detail =
        result && typeof result === 'object'
          ? String(
              (result as Record<string, unknown>).msg ||
                (result as Record<string, unknown>).message ||
                text,
            )
          : text;
      let headerDetail = response.headers.get('X-UrlAcl-Error') || '';
      try {
        headerDetail = decodeURIComponent(headerDetail);
      } catch {
        // 无效编码仍按纯文本展示，不影响拒绝结果。
      }
      throw new Error(
        `签名请求被拒绝（HTTP ${response.status}）：${detail || headerDetail || response.statusText}`,
      );
    }
    return result;
  }

  @ResAuthorize({ ignored: true })
  sms(data: string) {
    return this.post('sms', {
      data,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const aclTestService = new AclTestService();
