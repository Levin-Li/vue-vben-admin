import { authenticateResponseInterceptor, RequestClient } from '@vben/runtime/request';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDynamicVerifyCodeInterceptor } from '../dynamic-verify-code';
import { createMultipartRequestInterceptor } from '../multipart-request';
import { unwrapServiceResp } from '../service-resp';

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

const captchaSvgBase64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMTIiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCAxMTIgNDAiPjxyZWN0IHdpZHRoPSIxMTIiIGhlaWdodD0iNDAiIHJ4PSI2IiBmaWxsPSIjZjhmYWZjIi8+PHRleHQgeD0iNTYiIHk9IjI3IiBmb250LXNpemU9IjI0IiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiBmb250LWZlaWdodD0iNzAwIiBmaWxsPSIjMTExODI3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4xNzA3PC90ZXh0PjxsaW5lIHgxPSI2IiB5MT0iMzAiIHgyPSIxMDYiIHkyPSIxMCIgc3Ryb2tlPSIjNmQ1ZGZjIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=';
const hmiChallenge = {
  challengeId: 'hmi-1',
  mode: 'click',
  publicData: {
    image: captchaSvgBase64,
    thumb: captchaSvgBase64,
    viewport: { height: 180, width: 320 },
  },
};
const unknownHmiChallenge = {
  challengeId: 'hmi-unknown',
  mode: 'UNKNOWN_MODE',
  publicData: {},
};

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
    error: vi.fn(),
    warning: vi.fn(),
  },
  Modal: {
    confirm: modalConfirm,
  },
}));

describe('dynamic verify code interceptor', () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    modalConfirm.mockClear();
    modalInstances.length = 0;
  });

  it('未触发二次验证的上传只复制条目，不读取或编码整个文件', async () => {
    const encodeBody = vi.spyOn(Response.prototype, 'arrayBuffer');
    const file = new File([new Uint8Array([0, 128, 255])], 'binary.bin');
    const readFile = vi.spyOn(file, 'arrayBuffer');
    const body = new FormData();
    body.append('file', file);
    body.append('label', '原始标签');
    let sent: any;
    const client = new RequestClient({
      adapter: async (config) => {
        sent = config.data;
        return {
          config,
          data: { ok: true },
          headers: {},
          status: 200,
          statusText: 'OK',
        };
      },
    });
    client.addRequestInterceptor(createMultipartRequestInterceptor());
    client.addResponseInterceptor(createDynamicVerifyCodeInterceptor(client));
    await client.post('/ordinary/upload', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    expect(sent).toBeInstanceOf(FormData);
    expect(sent).not.toBe(body);
    expect([...sent.keys()]).toEqual(['file', 'label']);
    expect(sent.get('file')).toBe(file);
    expect(sent.get('label')).toBe('原始标签');
    expect(encodeBody).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
    expect(modalConfirm).not.toHaveBeenCalled();
  });

  it.each([413, 429, 503])(
    '安全拒绝 %s 不刷新令牌或退出登录',
    async (status) => {
      const doReAuthenticate = vi.fn();
      const doRefreshToken = vi.fn();
      const interceptor = authenticateResponseInterceptor({
        client: new RequestClient(),
        doReAuthenticate,
        doRefreshToken,
        enableRefreshToken: true,
        formatToken: (token) => token,
      });
      const error = { config: { headers: {} }, response: { status } };
      await expect(interceptor.rejected?.(error)).rejects.toBe(error);
      expect(doReAuthenticate).not.toHaveBeenCalled();
      expect(doRefreshToken).not.toHaveBeenCalled();
    },
  );

  it.each(
    [
      ['JSON', 'delete'],
      ['multipart', 'delete'],
      ['multipart', 'post'],
    ].flatMap(([bodyType, method]) =>
      ['confirm', 'cancelBeforeApply', 'cancelAfterApply'].map((action) => [
        bodyType,
        method,
        action,
      ]),
    ),
  )(
    '普通 %s %s 请求在二次验证期间暂挂并按 %s 保真继续或取消',
    async (bodyType, method, action) => {
      const encodeBody = vi.spyOn(Response.prototype, 'arrayBuffer');
      let modal: any;
      modalConfirm.mockImplementationOnce((options: any) => {
        modal = options;
        return {
          update: (next: any) => {
            modal = { ...modal, ...next };
          },
        };
      });
      const seen: Array<{
        bytes?: number[];
        data: any;
        headers: Record<string, any>;
        method?: string;
        params: any;
        url?: string;
      }> = [];
      let businessExecutions = 0;
      const client = new RequestClient({
        adapter: async (config) => {
          seen.push({
            method: config.method,
            url: config.url,
            params: { ...config.params },
            data:
              config.data instanceof ArrayBuffer
                ? new TextDecoder().decode(config.data)
                : config.data,
            bytes:
              config.data instanceof ArrayBuffer
                ? [...new Uint8Array(config.data)]
                : undefined,
            headers: { ...config.headers },
          });
          if (config.headers['DVC-action'] === '123456') {
            businessExecutions += 1;
            return {
              config,
              data: { code: 0, data: { deleted: true } },
              headers: {},
              status: 200,
              statusText: 'OK',
            };
          }
          const applying = config.headers['-DynamicVerifyCode-'] === 'Apply';
          return {
            config,
            data: null,
            status: 200,
            statusText: 'OK',
            headers: applying
              ? {
                  '-DynamicVerifyCode-ParamName': 'DVC-action',
                  '-DynamicVerifyCode-VerifyId': 'delete-challenge',
                  '-DynamicVerifyCode-Type': 'Sms',
                }
              : {
                  '-DynamicVerifyCode-': 'Apply',
                  '-DynamicVerifyCode-Type': 'Sms',
                },
          };
        },
        responseReturn: 'data',
      });
      client.addRequestInterceptor(createMultipartRequestInterceptor());
      client.addResponseInterceptor(createDynamicVerifyCodeInterceptor(client));
      client.addResponseInterceptor({
        fulfilled: (response: any) =>
          response.config.__dynamicVerifyKeepRaw
            ? response
            : unwrapServiceResp(response.data),
      });
      const onSuccess = vi.fn();
      const onRejected = vi.fn();
      const params = { reason: '用户申请', tag: ['one', 'two'] };
      const body =
        bodyType === 'multipart'
          ? new FormData()
          : { revision: 7, selection: ['record-42'] };
      if (body instanceof FormData) {
        body.append('revision', '7');
        body.append('selection', 'record-42');
        body.append(
          'file',
          new Blob(['真实文件内容\u0000', new Uint8Array([128, 255, 0])], {
            type: 'application/octet-stream',
          }),
          'sample.bin',
        );
      }
      const pending = client
        .request('/ordinary/orders/42?dryRun=false', {
          method,
          params,
          data: body,
          headers: {
            'Content-Type':
              bodyType === 'multipart'
                ? 'multipart/form-data'
                : 'application/json',
            'X-Trace-Id': 'original-trace',
            'X-Business-Token': 'original-token',
          },
        })
        .then(onSuccess, onRejected);
      await vi.waitFor(() => expect(modal).toBeDefined());
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onRejected).not.toHaveBeenCalled();
      expect(seen).toHaveLength(1);
      expect(businessExecutions).toBe(0);
      expect(encodeBody).not.toHaveBeenCalled();
      if (body instanceof FormData) {
        expect(seen[0]?.data).toBeInstanceOf(FormData);
        expect(seen[0]?.data).not.toBe(body);
        body.append('late', '弹窗期间的外部修改');
        expect(seen[0]?.data.has('late')).toBe(false);
      }

      if (action !== 'cancelBeforeApply') {
        await findNode(modal.content, 'button').props.onClick();
        expect(seen).toHaveLength(2);
        expect(onSuccess).not.toHaveBeenCalled();
        expect(onRejected).not.toHaveBeenCalled();
        expect(businessExecutions).toBe(0);
      }
      if (action === 'confirm') {
        findNode(modal.content, 'input').props['onUpdate:value']('123456');
        await modal.onOk();
      } else {
        modal.onCancel();
      }
      await pending;
      if (action === 'confirm') {
        expect(onSuccess).toHaveBeenCalledExactlyOnceWith({ deleted: true });
        expect(onRejected).not.toHaveBeenCalled();
        expect(businessExecutions).toBe(1);
        expect(seen).toHaveLength(3);
        expect(seen[2]?.headers).toMatchObject({
          'DVC-action': '123456',
          '-DynamicVerifyCode-VerifyId': 'delete-challenge',
        });
        expect(seen[2]?.headers['-DynamicVerifyCode-']).toBeUndefined();
      } else {
        expect(onSuccess).not.toHaveBeenCalled();
        expect(onRejected).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ code: 'ERR_CANCELED' }),
        );
        expect(businessExecutions).toBe(0);
        expect(seen).toHaveLength(action === 'cancelBeforeApply' ? 1 : 2);
      }
      for (const request of seen) {
        expect(request).toMatchObject({
          method,
          url: '/ordinary/orders/42?dryRun=false',
          params,
        });
        expect(request.headers).toMatchObject({
          'X-Trace-Id': 'original-trace',
          'X-Business-Token': 'original-token',
        });
        expect(
          request.headers['-DynamicVerifyCode-RequestHash'],
        ).toBeUndefined();
      }
      if (body instanceof FormData) {
        expect(encodeBody).toHaveBeenCalledTimes(
          action === 'cancelBeforeApply' ? 0 : 1,
        );
        for (const request of seen.slice(1)) {
          expect(request.headers['Content-Type']).toBe(
            seen[1]?.headers['Content-Type'],
          );
          expect(request.bytes).toEqual(seen[1]?.bytes);
          expect(request.headers['Content-Type']).toMatch(
            /^multipart\/form-data; boundary=/,
          );
          const boundary =
            request.headers['Content-Type'].split('boundary=')[1];
          expect(request.data).toContain(`--${boundary}\r\n`);
          expect(request.data).toContain('真实文件内容\u0000');
          expect(request.data.match(/name="revision"/g)).toHaveLength(1);
          expect(request.data.match(/name="selection"/g)).toHaveLength(1);
          expect(request.data).not.toContain('name="reason"');
          expect(request.data).not.toContain('name="late"');
        }
      } else {
        expect(encodeBody).not.toHaveBeenCalled();
        for (const request of seen) {
          expect(request.data).toBe(JSON.stringify(body));
        }
      }
    },
  );

  it.each([
    [
      'Sms',
      {
        '-DynamicVerifyCode-Prompt': encodeURIComponent('短信已发送'),
        '-DynamicVerifyCode-MockCode': '654321',
      },
    ],
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
        closable: true,
        keyboard: false,
        maskClosable: false,
        okText: '确定',
        width: 520,
        icon: null,
        wrapClassName: 'dynamic-verify-dialog',
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
      expect(vnodeText(modalOptions.content)).not.toContain('Api接口需要');
      expect(vnodeText(modalOptions.content)).not.toContain('才能继续');
      expect(modalOptions.content.props.style).not.toContain('min-height');
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
      const getCodeButton = findNode(modalOptions.content, 'button');
      expect(Boolean(getCodeButton)).toBe(
        verifyType === 'Sms' || verifyType === 'Email',
      );
      if (verifyType === 'Sms' || verifyType === 'Email') {
        expect(getCodeButton?.props).toMatchObject({
          class: 'min-w-[116px] text-[11px]',
          size: 'large',
          style: 'height:40px;',
        });
      }
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
      const latestContent =
        modalInstances[0]?.update.mock.calls.at(-1)?.[0]?.content;
      if (verifyType === 'Sms') {
        expect(vnodeText(latestContent)).toContain(
          '测试验证码（非生产）：654321',
        );
      } else {
        expect(vnodeText(latestContent)).not.toContain('测试验证码（非生产）');
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
      expect(
        seenRequests[2]?.headers?.['-DynamicVerifyCode-RequestHash'],
      ).toBeUndefined();
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
        closable: true,
        keyboard: false,
        maskClosable: false,
        okText: '确定',
        width: 520,
        icon: null,
        wrapClassName: 'dynamic-verify-dialog',
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
      expect(
        seenRequests[1]?.headers?.['-DynamicVerifyCode-RequestHash'],
      ).toBeUndefined();
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

  it.each([
    ['标准题面', `data:image/svg+xml;base64,${captchaSvgBase64}`],
    ['128KB 大题面', `data:image/png;base64,${'A'.repeat(128_000)}`],
  ])(
    '从响应体读取%s并复用行为组件完成刷新和原请求重放',
    async (_label, image) => {
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
              data: {
                ...hmiChallenge,
                publicData: { ...hmiChallenge.publicData, image },
              },
              headers: {
                '-DynamicVerifyCode-VerifyId': verifyId,
                '-DynamicVerifyCode-ParamName': 'DVC-hmi-token',
                '-DynamicVerifyCode-Type': 'Hmi',
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
      expect(modalInstances[0].options.width).toBe(
        Math.min(behaviorNode.props.challenge.payload.width + 48, 700),
      );
      expect(modalInstances[0].options.okButtonProps).toEqual({
        style: { display: 'none' },
      });
      expect(modalInstances[0].options.icon).toBeNull();
      expect(behaviorNode.props.challenge.payload.image).toBe(image);
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
    },
  );

  it('rejects unknown behavior captcha modes instead of falling back to plain text input', async () => {
    const client = new RequestClient({
      adapter: async (config) => {
        if (config.headers?.['-DynamicVerifyCode-'] === 'Apply') {
          return {
            config,
            data: unknownHmiChallenge,
            headers: {
              '-DynamicVerifyCode-VerifyId': 'verify-hmi-unknown',
              '-DynamicVerifyCode-ParamName': 'DVC-hmi-token',
              '-DynamicVerifyCode-Type': 'Hmi',
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
    await expect(pending).rejects.toThrow('当前行为验证码模式暂不支持');
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
      closable: true,
      keyboard: false,
      maskClosable: false,
      okText: '确定',
      width: 520,
      icon: null,
      wrapClassName: 'dynamic-verify-dialog',
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
