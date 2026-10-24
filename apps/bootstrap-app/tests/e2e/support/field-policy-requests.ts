import type { BrowserContext } from '@playwright/test';

/** 运行时禁止通过字段策略目录或快照补齐本地 API 声明。 */
export function isFieldPolicyRequest(url: string): boolean {
  return /\/apiDataAttrPolic[^/]*(?:\/|$)/i.test(new URL(url).pathname);
}

/** 在登录前监听整个上下文，覆盖重定向、多个页面及失败的请求。 */
export function captureFieldPolicyRequests(context: BrowserContext) {
  const requests: { method: string; url: string }[] = [];
  context.on('request', (request) => {
    if (isFieldPolicyRequest(request.url()))
      requests.push({ method: request.method(), url: request.url() });
  });
  return requests;
}
