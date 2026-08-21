import { RequestClient } from '@vben/request';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../views/_core/authentication/behavior-captcha.vue', async () => {
  const { defineComponent, h } = await import('vue');

  return {
    default: defineComponent({
      emits: ['complete', 'refresh'],
      name: 'BehaviorCaptcha',
      props: {
        challenge: {
          default: null,
          type: Object,
        },
        loading: {
          default: false,
          type: Boolean,
        },
      },
      setup() {
        return () => h('behavior-captcha-stub');
      },
    }),
  };
});

import { createDynamicVerifyCodeInterceptor } from '../dynamic-verify-code';
import { unwrapServiceResp } from '../service-resp';

const captchaSvgBase64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMTIiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCAxMTIgNDAiPjxyZWN0IHdpZHRoPSIxMTIiIGhlaWdodD0iNDAiIHJ4PSI2IiBmaWxsPSIjZjhmYWZjIi8+PHRleHQgeD0iNTYiIHk9IjI3IiBmb250LXNpemU9IjI0IiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiBmb250LWZlaWdodD0iNzAwIiBmaWxsPSIjMTExODI3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4xNzA3PC90ZXh0PjxsaW5lIHgxPSI2IiB5MT0iMzAiIHgyPSIxMDYiIHkyPSIxMCIgc3Ryb2tlPSIjNmQ1ZGZjIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=';
const hmiChallengeJson = encodeURIComponent(
  JSON.stringify({
    challengeId: 'hmi-1',
    mode: 'click',
    publicData: {
      image: captchaSvgBase64,
      thumb: captchaSvgBase64,
      viewport: { height: 180, width: 320 },
    },
  }),
);
const unknownHmiChallengeJson = encodeURIComponent(
  JSON.stringify({
    challengeId: 'hmi-unknown',
    mode: 'UNKNOWN_MODE',
    publicData: {},
  }),
);

const {
  findBehaviorCaptchaNode,
  findNode,
  modalConfirm,
  modalInstances,
  vnodeText,
} = vi.hoisted(() => {
  const findNode = (node: any, type: string): any => {
    if (!node) {
      return undefined;
    }

    if (node.type === type) {
      return node;
    }

    const children =
      typeof node.children === 'function' ? node.children() : node.children;

    if (!Array.isArray(children)) {
      return undefined;
    }

    for (const child of children) {
      const matched = findNode(child, type);
      if (matched) {
        return matched;
      }
    }

    return undefined;
  };
  const findBehaviorCaptchaNode = (node: any): any => {
    if (!node) {
      return undefined;
    }

    const componentName = node.type?.name || node.type?.__name;
    if (componentName === 'BehaviorCaptcha') {
      return node;
    }

    const children =
      typeof node.children === 'function' ? node.children() : node.children;

    if (!Array.isArray(children)) {
      return undefined;
    }

    for (const child of children) {
      const matched = findBehaviorCaptchaNode(child);
      if (matched) {
        return matched;
      }
    }

    return undefined;
  };
  const modalInstances: any[] = [];
  const vnodeText = (node: any): string => {
    if (typeof node === 'string') {
      return node;
    }

    const children =
      typeof node?.children === 'function' ? node.children() : node?.children;

    if (typeof children === 'string') {
      return children;
    }

    if (Array.isArray(children)) {
      return children.map((child) => vnodeText(child)).join('');
    }

    return '';
  };

  const modalConfirm = vi.fn((options: any) => {
    const state = {
      options,
      update: vi.fn((nextOptions: any) => {
        state.options = {
          ...state.options,
          ...nextOptions,
        };
      }),
    };
    modalInstances.push(state);

    queueMicrotask(async () => {
      const getCodeButton = findNode(state.options.content, 'button');
      if (!getCodeButton && vnodeText(state.options.title).includes('人机')) {
        return;
      }

      await getCodeButton?.props?.onClick?.();

      const inputNode = findNode(state.options.content, 'input');
      inputNode?.props?.['onUpdate:value']?.('123456');
      await state.options.onOk?.();
    });

    return {
      update: state.update,
    };
  });

  return {
    findBehaviorCaptchaNode,
    findNode,
    modalConfirm,
    modalInstances,
    vnodeText,
  };
});

vi.mock('ant-design-vue', () => ({
  Button: 'button',
  Input: 'input',
  message: {
    warning: vi.fn(),
  },
  Modal: {
    confirm: modalConfirm,
  },
}));

describe('dynamic verify code interceptor', () => {
  beforeEach(() => {
    modalConfirm.mockClear();
    modalInstances.length = 0;
  });

  it.each([
    ['Sms', { '-DynamicVerifyCode-Prompt': encodeURIComponent('短信已发送') }],
    [
      'Email',
      { '-DynamicVerifyCode-Prompt': encodeURIComponent('邮箱已发送') },
    ],
    [
      'Mfa',
      {
        '-DynamicVerifyCode--InteractionData': encodeURIComponent(
          'otpauth://totp/admin',
        ),
      },
    ],
    [
      'Captcha',
      {
        '-DynamicVerifyCode--InteractionData':
          encodeURIComponent(captchaSvgBase64),
      },
    ],
  ])(
    'completes the frontend/backend dynamic verify contract for %s without real servers',
    async (verifyType, codeHeaders) => {
      const seenRequests: Array<{
        data: any;
        headers: Record<string, any>;
        method?: string;
        url?: string;
      }> = [];
      const client = new RequestClient({
        adapter: async (config) => {
          seenRequests.push({
            data: config.data,
            headers: { ...config.headers },
            method: config.method,
            url: config.url,
          });

          if (config.url === '/api/public/pay') {
            return {
              config,
              data: {
                code: 0,
                data: { access: 'public' },
              },
              headers: {},
              status: 200,
              statusText: 'OK',
            };
          }

          if (config.url !== '/api/secure/pay') {
            throw new Error(`Unexpected URL: ${config.url}`);
          }

          if (config.headers?.['DVC-login-token'] === '123456') {
            return {
              config,
              data: {
                code: 0,
                data: { access: 'protected', verifyType },
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
                '-DynamicVerifyCode-VerifyId': `verify-${verifyType}`,
                '-DynamicVerifyCode-ParamName': 'DVC-login-token',
                '-DynamicVerifyCode-Type': verifyType,
                '-DynamicVerifyCode-开发提示':
                  '请在http请求头中提交参数[DVC-login-token=xxx验证码] 进行验证',
                ...codeHeaders,
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
              '-DynamicVerifyCode-Prompt': encodeURIComponent(
                `Api接口需要${verifyType}才能调用`,
              ),
              '-DynamicVerifyCode-Type': verifyType,
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

      await expect(client.get('/api/public/pay')).resolves.toEqual({
        access: 'public',
      });
      expect(modalConfirm).not.toHaveBeenCalled();

      await expect(
        client.post(
          '/api/secure/pay',
          { amount: 100 },
          {
            headers: {
              'X-Trace-Id': 'trace-contract',
            },
          },
        ),
      ).resolves.toEqual({ access: 'protected', verifyType });

      expect(modalConfirm).toHaveBeenCalledTimes(1);
      const modalOptions = modalConfirm.mock.calls[0]?.[0];
      expect(modalOptions).toMatchObject({
        cancelText: '取消',
        centered: true,
        closable: false,
        keyboard: false,
        maskClosable: false,
        okText: '确定',
        width: 400,
      });
      expect(vnodeText(modalOptions.title)).toBe(
        verifyType === 'Sms'
          ? '该操作需要短信验证'
          : verifyType === 'Email'
            ? '该操作需要邮箱验证'
            : verifyType === 'Mfa'
              ? '该操作需要MFA验证'
              : '该操作需要图片验证',
      );
      expect(modalOptions.title?.props?.style).toContain('font-size:16px');
      const inputNode = findNode(modalOptions.content, 'input');
      expect(inputNode).toBeTruthy();
      expect(inputNode?.props?.placeholder).toBe(
        verifyType === 'Sms'
          ? '请输入短信验证码'
          : verifyType === 'Email'
            ? '请输入邮箱验证码'
            : verifyType === 'Mfa'
              ? '请输入MFA 验证码'
              : '请输入图片验证码',
      );
      expect(Boolean(findNode(modalOptions.content, 'button'))).toBe(
        verifyType === 'Sms' || verifyType === 'Email',
      );
      if (verifyType === 'Captcha') {
        const updatedContent =
          modalInstances[0]?.update.mock.calls.at(-1)?.[0]?.content;
        const imgNode = findNode(
          updatedContent || modalInstances[0]?.options.content,
          'img',
        );
        expect(imgNode?.props?.src).toBe(
          `data:image/svg+xml;base64,${captchaSvgBase64}`,
        );
      }
      expect(seenRequests).toHaveLength(4);
      expect(seenRequests[1]).toMatchObject({
        data: JSON.stringify({ amount: 100 }),
        method: 'post',
        url: '/api/secure/pay',
      });
      expect(seenRequests[2]).toMatchObject({
        data: JSON.stringify({ amount: 100 }),
        method: 'post',
        url: '/api/secure/pay',
      });
      expect(seenRequests[2]?.headers?.['-DynamicVerifyCode-']).toBe('Apply');
      expect(seenRequests[2]?.headers?.['-DynamicVerifyCode-RequestHash']).toBe(
        seenRequests[3]?.headers?.['-DynamicVerifyCode-RequestHash'],
      );
      expect(seenRequests[3]).toMatchObject({
        data: JSON.stringify({ amount: 100 }),
        method: 'post',
        url: '/api/secure/pay',
      });
      expect(seenRequests[3]?.headers?.['DVC-login-token']).toBe('123456');
      expect(seenRequests[3]?.headers?.['-DynamicVerifyCode-VerifyId']).toBe(
        `verify-${verifyType}`,
      );
      expect(seenRequests[3]?.headers?.['X-Trace-Id']).toBe('trace-contract');
    },
  );

  it.each([
    ['Sms', '短信已发送'],
    ['Email', '邮箱已发送'],
    ['Mfa', 'otpauth://totp/admin'],
    ['Captcha', captchaSvgBase64],
  ])(
    'requests a %s verify code and replays the same protected request with DVC header',
    async (verifyType, interactionOrPrompt) => {
      const seenRequests: Array<{
        data: any;
        headers: Record<string, any>;
        method?: string;
        url?: string;
      }> = [];

      const client = new RequestClient({
        adapter: async (config) => {
          seenRequests.push({
            data: config.data,
            headers: { ...config.headers },
            method: config.method,
            url: config.url,
          });

          if (config.headers?.['DVC-token'] === '123456') {
            return {
              config,
              data: {
                code: 0,
                data: { ok: true, verifyType },
              },
              headers: {},
              status: 200,
              statusText: 'OK',
            };
          }

          if (config.headers?.['-DynamicVerifyCode-'] === 'Apply') {
            const isInteractionType =
              verifyType === 'Mfa' || verifyType === 'Captcha';

            return {
              config,
              data: null,
              headers: {
                '-DynamicVerifyCode-VerifyId': `verify-${verifyType}`,
                '-DynamicVerifyCode-ParamName': 'DVC-token',
                '-DynamicVerifyCode-Type': verifyType,
                ...(isInteractionType
                  ? {
                      '-DynamicVerifyCode--InteractionData':
                        encodeURIComponent(interactionOrPrompt),
                    }
                  : {
                      '-DynamicVerifyCode-Prompt':
                        encodeURIComponent(interactionOrPrompt),
                    }),
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
              '-DynamicVerifyCode-Prompt': encodeURIComponent(
                `需要${verifyType}验证`,
              ),
              '-DynamicVerifyCode-Type': verifyType,
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

      await expect(
        client.post(
          '/protected-api',
          { amount: 100 },
          { headers: { 'X-Trace-Id': 'trace-1' } },
        ),
      ).resolves.toEqual({ ok: true, verifyType });
      expect(modalConfirm).toHaveBeenCalledTimes(1);
      const codeModalOptions = modalConfirm.mock.calls[0]?.[0];
      expect(codeModalOptions).toMatchObject({
        cancelText: '取消',
        centered: true,
        closable: false,
        keyboard: false,
        maskClosable: false,
        okText: '确定',
        width: 400,
      });
      expect(Boolean(findNode(codeModalOptions.content, 'button'))).toBe(
        verifyType === 'Sms' || verifyType === 'Email',
      );
      expect(seenRequests).toHaveLength(3);
      const serializedPayload = JSON.stringify({ amount: 100 });
      expect(seenRequests[0]).toMatchObject({
        data: serializedPayload,
        method: 'post',
        url: '/protected-api',
      });
      expect(seenRequests[1]).toMatchObject({
        data: serializedPayload,
        method: 'post',
        url: '/protected-api',
      });
      expect(seenRequests[1]?.headers?.['-DynamicVerifyCode-']).toBe('Apply');
      expect(seenRequests[1]?.headers?.['-DynamicVerifyCode-RequestHash']).toBe(
        seenRequests[2]?.headers?.['-DynamicVerifyCode-RequestHash'],
      );
      expect(seenRequests[2]).toMatchObject({
        data: serializedPayload,
        method: 'post',
        url: '/protected-api',
      });
      expect(seenRequests[2]?.headers?.['DVC-token']).toBe('123456');
      expect(seenRequests[2]?.headers?.['-DynamicVerifyCode-VerifyId']).toBe(
        `verify-${verifyType}`,
      );
      expect(seenRequests[2]?.headers?.['X-Trace-Id']).toBe('trace-1');
      expect(seenRequests[2]?.headers?.['-DynamicVerifyCode-']).toBeUndefined();
    },
  );

  it('reuses the shared behavior captcha component for Hmi verify and replays the request after refresh', async () => {
    const seenRequests: Array<{
      data: any;
      headers: Record<string, any>;
      method?: string;
      url?: string;
    }> = [];

    const client = new RequestClient({
      adapter: async (config) => {
        seenRequests.push({
          data: config.data,
          headers: { ...config.headers },
          method: config.method,
          url: config.url,
        });

        if (
          config.headers?.['DVC-hmi-token'] &&
          config.headers?.['-DynamicVerifyCode-VerifyId'] === 'verify-Hmi-2'
        ) {
          return {
            config,
            data: {
              code: 0,
              data: { ok: true, verifyType: 'Hmi' },
            },
            headers: {},
            status: 200,
            statusText: 'OK',
          };
        }

        if (config.headers?.['-DynamicVerifyCode-'] === 'Apply') {
          const verifyId =
            seenRequests.filter(
              (item) => item.headers?.['-DynamicVerifyCode-'] === 'Apply',
            ).length > 1
              ? 'verify-Hmi-2'
              : 'verify-Hmi-1';

          return {
            config,
            data: null,
            headers: {
              '-DynamicVerifyCode-VerifyId': verifyId,
              '-DynamicVerifyCode-ParamName': 'DVC-hmi-token',
              '-DynamicVerifyCode-Type': 'Hmi',
              '-DynamicVerifyCode--InteractionData': hmiChallengeJson,
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
            '-DynamicVerifyCode-Prompt': encodeURIComponent('需要行为验证'),
            '-DynamicVerifyCode-Type': 'Hmi',
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

    const pending = client.post('/protected-hmi', { amount: 1 });
    await Promise.resolve();
    await Promise.resolve();

    expect(modalConfirm).toHaveBeenCalledTimes(1);
    const modalOptions = modalConfirm.mock.calls[0]?.[0];
    expect(vnodeText(modalOptions.title)).toBe('该操作需要人机验证');

    for (let index = 0; index < 6; index += 1) {
      if ((modalInstances[0]?.update.mock.calls.length || 0) >= 2) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    let behaviorNode = findBehaviorCaptchaNode(
      modalInstances[0]?.update.mock.calls.at(-1)?.[0]?.content ||
        modalInstances[0]?.options.content,
    );
    expect(behaviorNode).toBeTruthy();
    await behaviorNode?.props?.onRefresh?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    behaviorNode = findBehaviorCaptchaNode(
      modalInstances[0]?.update.mock.calls.at(-1)?.[0]?.content ||
        modalInstances[0]?.options.content,
    );
    behaviorNode?.props?.onComplete?.(
      JSON.stringify({
        challengeId: 'hmi-1',
        data: 'hmi-1',
        mode: 'CLICK',
        operations: [{ type: 'click', x: 80, y: 60 }],
      }),
    );

    await expect(pending).resolves.toEqual({
      ok: true,
      verifyType: 'Hmi',
    });

    expect(seenRequests).toHaveLength(4);
    expect(seenRequests[1]?.headers?.['-DynamicVerifyCode-']).toBe('Apply');
    expect(seenRequests[2]?.headers?.['-DynamicVerifyCode-']).toBe('Apply');
    expect(seenRequests[3]?.headers?.['DVC-hmi-token']).toContain(
      '"mode":"CLICK"',
    );
    expect(seenRequests[3]?.headers?.['-DynamicVerifyCode-VerifyId']).toBe(
      'verify-Hmi-2',
    );
  });

  it('rejects unknown behavior captcha modes instead of falling back to plain text input', async () => {
    const client = new RequestClient({
      adapter: async (config) => {
        if (config.headers?.['-DynamicVerifyCode-'] === 'Apply') {
          return {
            config,
            data: null,
            headers: {
              '-DynamicVerifyCode-VerifyId': 'verify-hmi-unknown',
              '-DynamicVerifyCode-ParamName': 'DVC-hmi-token',
              '-DynamicVerifyCode-Type': 'Hmi',
              '-DynamicVerifyCode--InteractionData': unknownHmiChallengeJson,
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
            '-DynamicVerifyCode-Prompt': encodeURIComponent('需要行为验证'),
            '-DynamicVerifyCode-Type': 'Hmi',
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

    const pending = client.post('/protected-hmi-unknown');
    await Promise.resolve();
    await Promise.resolve();

    expect(modalConfirm).toHaveBeenCalledTimes(1);
    await expect(modalConfirm.mock.calls[0]?.[0]?.onOk?.()).rejects.toThrow(
      '当前行为验证码模式暂不支持',
    );
    await expect(pending).rejects.toThrow(
      '当前行为验证码模式暂不支持',
    );
  });

  it('reads dynamic verify response headers case-insensitively', async () => {
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
              '-dynamicverifycode-verifyid': 'verify-Sms',
              '-dynamicverifycode-paramname': 'DVC-token',
              '-dynamicverifycode-prompt': encodeURIComponent('短信已发送'),
              '-dynamicverifycode-type': 'Sms',
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
            '-DynamicVerifyCode-Type': 'Sms',
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
    expect(modalConfirm).toHaveBeenCalledTimes(1);
    expect(modalConfirm.mock.calls[0]?.[0]).toMatchObject({
      cancelText: '取消',
      centered: true,
      closable: false,
      keyboard: false,
      maskClosable: false,
      okText: '确定',
      width: 400,
    });
    expect(vnodeText(modalConfirm.mock.calls[0]?.[0]?.title)).toBe(
      '该操作需要短信验证',
    );
    expect(
      findNode(modalConfirm.mock.calls[0]?.[0]?.content, 'button'),
    ).toBeTruthy();
    expect(seenHeaders[1]?.['-DynamicVerifyCode-']).toBe('Apply');
    expect(seenHeaders[2]?.['DVC-token']).toBe('123456');
    expect(seenHeaders[2]?.['-DynamicVerifyCode-VerifyId']).toBe('verify-Sms');
  });
});
