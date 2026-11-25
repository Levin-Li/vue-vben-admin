import { RequestClient } from '@vben/runtime/request';
import { describe, expect, it } from 'vitest';

import { isReportRateLimited } from '../report-rate-limit';

describe('报表限流响应', () => {
  it('识别实际请求客户端解包后的 429 响应体', async () => {
    const client = new RequestClient();
    client.instance.defaults.adapter = async () => {
      throw { response: { status: 429, data: { code: 429, httpStatusCode: 429, msg: '操作过快，请稍后再试' } } };
    };
    const error = await client.post('/report', {}).catch((cause: unknown) => cause);
    expect(isReportRateLimited(error)).toBe(true);
    expect(error).toMatchObject({ httpStatusCode: 429 });
  });

  it('网络中断和服务不可用不能误判为限流', async () => {
    const client = new RequestClient();
    client.instance.defaults.adapter = async (config) => {
      if (config.url === '/network') throw new Error('连接中断');
      throw { response: { status: 503, data: { httpStatusCode: 503, msg: '报表写入暂不可用' } } };
    };
    expect(isReportRateLimited(await client.post('/network', {}).catch((cause: unknown) => cause))).toBe(false);
    expect(isReportRateLimited(await client.post('/unavailable', {}).catch((cause: unknown) => cause))).toBe(false);
  });
});
