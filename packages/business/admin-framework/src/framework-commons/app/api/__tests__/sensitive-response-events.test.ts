import { describe, expect, it } from 'vitest';

import { emitApiRequestEvent, onApiRequestTopic } from '../request-events';

describe('敏感接口响应事件隔离', () => {
  it('不广播成功、原始响应或异常中的凭据，普通事件继续可用', () => {
    const received: unknown[] = [];
    const dispose = onApiRequestTopic('*', (event) => received.push(event));
    const config = { __sensitiveResponse: true, url: '/private-config' };
    const data = { apiKey: 'test-only-browser-key' };

    // 覆盖响应拦截器的各条广播入口，凭据只能返回原始调用方。
    emitApiRequestEvent({ config, data, rawData: data });
    emitApiRequestEvent({ response: { config, data } });
    emitApiRequestEvent({ error: { config, response: { data } } });
    emitApiRequestEvent({ error: { response: { config, data } } });
    expect(received).toHaveLength(0);

    emitApiRequestEvent({ config: { url: '/normal' }, data: { count: 1 } });
    expect(received).toHaveLength(1);
    dispose();
  });
});
