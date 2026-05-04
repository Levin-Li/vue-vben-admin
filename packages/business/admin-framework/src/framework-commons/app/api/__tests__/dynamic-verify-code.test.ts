import { RequestClient } from '@vben/request';

import { describe, expect, it, vi } from 'vitest';

import { createDynamicVerifyCodeInterceptor } from '../dynamic-verify-code';
import { unwrapServiceResp } from '../service-resp';

const { modalConfirm } = vi.hoisted(() => ({
  modalConfirm: vi.fn((options: any) => {
    const inputNode = options.content.children.find(
      (child: any) => child?.type === 'input',
    );

    inputNode?.props?.['onUpdate:value']?.('123456');
    return options.onOk?.();
  }),
}));

vi.mock('ant-design-vue', () => ({
  Input: 'input',
  message: {
    warning: vi.fn(),
  },
  Modal: {
    confirm: modalConfirm,
  },
}));

describe('dynamic verify code interceptor', () => {
  it('requests a verify code and replays the original request with DVC header', async () => {
    const seenHeaders: Record<string, any>[] = [];
    const client = new RequestClient({
      adapter: async (config) => {
        seenHeaders.push({ ...config.headers });

        if (config.headers?.['DVC-token'] === '123456') {
          return {
            config,
            data: {
              code: 0,
              data: { ok: true },
            },
            headers: {},
            status: 200,
            statusText: 'OK',
          };
        }

        if (config.headers?.['-DynamicVerifyCode-'] === 'Apply') {
          return {
            config,
            data: null,
            headers: {
              '-DynamicVerifyCode-ParamName': 'DVC-token',
              '-DynamicVerifyCode-Type': 'Sms',
              '-DynamicVerifyCode-Prompt': encodeURIComponent('短信已发送'),
            },
            status: 200,
            statusText: 'OK',
          };
        }

        return {
          config,
          data: null,
          headers: {
            '-DynamicVerifyCode-': 'Apply',
            '-DynamicVerifyCode-Prompt': encodeURIComponent('需要短信验证'),
          },
          status: 200,
          statusText: 'OK',
        };
      },
      responseReturn: 'data',
    });

    client.addResponseInterceptor(createDynamicVerifyCodeInterceptor(client));
    client.addResponseInterceptor({
      fulfilled: (response: any) => {
        if (
          response.config.__dynamicVerifyKeepRaw ||
          response.config.responseReturn === 'raw'
        ) {
          return response;
        }

        return unwrapServiceResp(response.data);
      },
    });

    await expect(client.get('/protected-api')).resolves.toEqual({ ok: true });
    expect(modalConfirm).toHaveBeenCalledOnce();
    expect(seenHeaders[1]?.['-DynamicVerifyCode-']).toBe('Apply');
    expect(seenHeaders[2]?.['DVC-token']).toBe('123456');
  });
});
