import type {
  RequestClient,
  RequestClientConfig,
  RequestResponse,
  ResponseInterceptorConfig,
} from '@vben/request';

import { h } from 'vue';

import { CanceledError } from '@vben/request';

import { Button, Input, message, Modal } from 'ant-design-vue';

import BehaviorCaptcha from '../views/_core/authentication/behavior-captcha.vue';
import {
  normalizeBehaviorCaptchaChallenge,
  type BehaviorCaptchaChallenge,
} from '../views/_core/authentication/behavior-captcha';

import { prepareMultipartReplay } from './multipart-request';
import './dynamic-verify-code.css';

type DynamicVerifyRequestConfig = RequestClientConfig & {
  __dynamicVerifyKeepRaw?: boolean;
  __dynamicVerifyRetried?: boolean;
};

type DynamicVerifyPromptInfo = {
  friendlyMessage?: string;
  interactionData?: string;
  prompt?: string;
  type?: string;
};

type DynamicVerifyApplyResult = Required<
  Pick<DynamicVerifyPromptInfo, 'type'>
> &
  Pick<DynamicVerifyPromptInfo, 'friendlyMessage' | 'interactionData'> & {
    mockCode?: string;
    paramName: string;
    verifyId: string;
  };

const DYNAMIC_VERIFY_HEADER = '-DynamicVerifyCode-';
const DYNAMIC_VERIFY_APPLY_VALUE = 'Apply';
const DYNAMIC_VERIFY_PARAM_NAME_HEADER = '-DynamicVerifyCode-ParamName';
const DYNAMIC_VERIFY_ID_HEADER = '-DynamicVerifyCode-VerifyId';
const DYNAMIC_VERIFY_TYPE_HEADER = '-DynamicVerifyCode-Type';
const DYNAMIC_VERIFY_PROMPT_HEADER = '-DynamicVerifyCode-Prompt';
const DYNAMIC_VERIFY_INTERACTION_DATA_HEADER =
  '-DynamicVerifyCode--InteractionData';

const VERIFY_TYPE_LABELS: Record<string, string> = {
  Bio: '生物验证',
  Captcha: '图片验证码',
  Email: '邮箱验证码',
  Hmi: '人机验证',
  Mfa: 'MFA 验证码',
  Sms: '短信验证码',
};

const VERIFY_TYPE_TITLE_NAMES: Record<string, string> = {
  Bio: '生物',
  Captcha: '图片',
  Email: '邮箱',
  Hmi: '人机',
  Mfa: 'MFA',
  Sms: '短信',
};

function cloneHeaders(headers: any) {
  if (!headers) {
    return {};
  }

  if (typeof headers.toJSON === 'function') {
    return { ...headers.toJSON() };
  }

  return { ...headers };
}

function getHeader(headers: any, name: string) {
  if (!headers) {
    return undefined;
  }

  const directValue = headers[name];
  if (directValue !== undefined) {
    return normalizeHeaderValue(directValue);
  }

  if (typeof headers.get === 'function') {
    const value = headers.get(name);
    if (value !== undefined && value !== null) {
      return normalizeHeaderValue(value);
    }
  }

  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return normalizeHeaderValue(value);
    }
  }

  return undefined;
}

function normalizeHeaderValue(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] === undefined ? undefined : String(value[0]);
  }

  return value === undefined || value === null ? undefined : String(value);
}

function decodeHeaderValue(value?: string) {
  if (!value) {
    return undefined;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isDynamicVerifyRequired(response: RequestResponse) {
  const value = getHeader(
    response.headers,
    DYNAMIC_VERIFY_HEADER,
  )?.toLowerCase();

  return value === DYNAMIC_VERIFY_APPLY_VALUE.toLowerCase();
}

function buildReplayConfig(
  config: DynamicVerifyRequestConfig,
  extraHeaders: Record<string, string>,
  extraConfig: Partial<DynamicVerifyRequestConfig> = {},
): DynamicVerifyRequestConfig {
  const headers = cloneHeaders(config.headers);

  for (const [name, value] of Object.entries(extraHeaders)) {
    headers[name] = value;
  }

  return {
    ...config,
    ...extraConfig,
    headers,
  };
}

function toImageSrc(data: string) {
  if (data.startsWith('data:image/')) {
    return data;
  }

  if (data.startsWith('/9j/')) {
    return `data:image/jpeg;base64,${data}`;
  }

  if (data.startsWith('iVBOR')) {
    return `data:image/png;base64,${data}`;
  }

  if (data.startsWith('R0lGOD')) {
    return `data:image/gif;base64,${data}`;
  }

  if (data.startsWith('PHN2Zy')) {
    return `data:image/svg+xml;base64,${data}`;
  }

  return undefined;
}

function renderInteractionData(interactionData?: string) {
  if (!interactionData) {
    return undefined;
  }

  const imageSrc = toImageSrc(interactionData);
  if (imageSrc) {
    return h('img', {
      alt: '验证码',
      src: imageSrc,
      style:
        'display:block;max-width:100%;min-height:40px;margin:12px 0;border:1px solid hsl(var(--border));border-radius:6px;',
    });
  }

  if (/^https?:\/\//i.test(interactionData)) {
    return h(
      'a',
      {
        href: interactionData,
        rel: 'noopener noreferrer',
        target: '_blank',
      },
      interactionData,
    );
  }

  try {
    const json = JSON.parse(interactionData);
    return h(
      'pre',
      {
        style:
          'max-height:180px;overflow:auto;margin:12px 0;padding:8px;border-radius:6px;background:hsl(var(--muted));white-space:pre-wrap;',
      },
      JSON.stringify(json, null, 2),
    );
  } catch {
    return h(
      'div',
      {
        style:
          'margin:12px 0;padding:8px;border-radius:6px;background:hsl(var(--muted));word-break:break-all;',
      },
      interactionData,
    );
  }
}

function getVerifyTypeLabel(type?: string) {
  return type ? (VERIFY_TYPE_LABELS[type] ?? `${type} 验证`) : '动态验证码';
}

function getVerifyModalTitle(type?: string) {
  const name = type ? (VERIFY_TYPE_TITLE_NAMES[type] ?? type) : '动态';
  return `该操作需要${name}验证`;
}

function renderVerifyModalTitle(type?: string) {
  return h(
    'span',
    {
      style: 'font-size:16px;font-weight:600;line-height:1.4;letter-spacing:0;',
    },
    getVerifyModalTitle(type),
  );
}

function isCaptchaVerify(type?: string) {
  return type === 'Captcha';
}

function isBehaviorVerify(type?: string) {
  return type === 'Hmi';
}

function shouldShowGetCodeButton(type?: string) {
  return type !== 'Mfa' && !isCaptchaVerify(type) && !isBehaviorVerify(type);
}

function parseBehaviorChallengeInput(value?: string) {
  if (!value) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function promptDynamicVerifyCode(
  info: DynamicVerifyPromptInfo,
  applyCode: () => Promise<DynamicVerifyApplyResult>,
) {
  return new Promise<{
    paramName: string;
    verifyId: string;
    verifyCode: string;
  }>((resolve, reject) => {
    let verifyCode = '';
    let applyResult: DynamicVerifyApplyResult | undefined;
    let applying = false;
    let applyPromise: Promise<DynamicVerifyApplyResult> | undefined;
    let behaviorChallenge: BehaviorCaptchaChallenge | null = null;
    let modalRef:
      | {
          destroy?: () => void;
          update?: (config: Record<string, unknown>) => void;
        }
      | undefined;
    let settled = false;

    const getCurrentType = () => applyResult?.type || info.type;

    // 外层生命周期独立；展示宽度与登录的 passwordVerifyDialogWidth 保持同一规则。
    const presentation = () => ({
      closable: !applying,
      icon: null,
      okButtonProps: isBehaviorVerify(getCurrentType())
        ? { style: { display: 'none' } }
        : undefined,
      width: isBehaviorVerify(getCurrentType())
        ? Math.min((Number(behaviorChallenge?.payload?.width) || 427) + 48, 700)
        : 520,
      wrapClassName: 'dynamic-verify-dialog',
    });

    const updateModal = () => {
      modalRef?.update?.({
        ...presentation(),
        content: renderContent(),
        title: renderVerifyModalTitle(getCurrentType()),
      });
    };

    const triggerApply = async (force = false) => {
      if (applyResult && !force) {
        return applyResult;
      }

      if (applyPromise) {
        return applyPromise;
      }

      applying = true;
      updateModal();
      applyPromise = applyCode()
        .then((result) => {
          applyResult = result;
          behaviorChallenge = isBehaviorVerify(result.type)
            ? normalizeBehaviorCaptchaChallenge(
                parseBehaviorChallengeInput(result.interactionData),
              )
            : null;
          return result;
        })
        .finally(() => {
          applying = false;
          applyPromise = undefined;
          updateModal();
        });

      return applyPromise;
    };

    const renderActionControl = (type?: string) => {
      if (isCaptchaVerify(type) && applyResult?.interactionData) {
        const imageSrc = toImageSrc(applyResult.interactionData);

        if (imageSrc) {
          return h('img', {
            alt: '图片验证码',
            onClick: () => triggerApply(true),
            src: imageSrc,
            style:
              'width:112px;height:40px;object-fit:contain;cursor:pointer;border:1px solid hsl(var(--border));border-radius:6px;background:hsl(var(--muted));',
            title: '点击刷新验证码',
          });
        }
      }

      if (!shouldShowGetCodeButton(type)) {
        return undefined;
      }

      return h(
        Button,
        {
          disabled: applying,
          loading: applying,
          onClick: () => triggerApply(true),
          size: 'large',
          style: 'width:112px;',
          type: 'primary',
        },
        () => (isCaptchaVerify(type) ? '获取图片' : '获取验证码'),
      );
    };

    const resolveBehaviorVerify = (verifyCode: string) => {
      if (!applyResult) {
        return;
      }

      settled = true;
      resolve({
        paramName: applyResult.paramName,
        verifyCode,
        verifyId: applyResult.verifyId,
      });
      modalRef?.destroy?.();
    };

    const renderContent = () => {
      const type = getCurrentType();
      const interactionData =
        isCaptchaVerify(type) || isBehaviorVerify(type)
          ? undefined
          : applyResult?.interactionData;
      const serverPrompt =
        type === 'Sms' || type === 'Email'
          ? applyResult?.friendlyMessage
          : undefined;

      return h('div', { style: 'padding-top:4px;' }, [
        isBehaviorVerify(type)
          ? behaviorChallenge
            ? h(BehaviorCaptcha, {
                challenge: behaviorChallenge,
                loading: applying,
                onComplete: resolveBehaviorVerify,
                onRefresh: () => triggerApply(true),
              })
            : applyResult
              ? h(
                  'div',
                  {
                    style:
                      'margin-top:12px;padding:12px;border-radius:12px;border:1px solid hsl(var(--destructive));background:hsl(var(--destructive) / 0.08);color:hsl(var(--destructive));line-height:1.6;',
                  },
                  '当前服务端返回了未注册的行为验证码模式，前端无法完成本次验证。',
                )
              : undefined
          : undefined,
        renderInteractionData(interactionData),
        !isBehaviorVerify(type)
          ? h(
              'div',
              {
                style:
                  'display:flex;width:100%;gap:8px;align-items:center;margin-top:12px;',
              },
              [
                h(Input, {
                  allowClear: true,
                  autofocus: true,
                  placeholder: `请输入${getVerifyTypeLabel(type)}`,
                  size: 'large',
                  style: 'flex:1;min-width:0;',
                  'onUpdate:value': (value: string) => {
                    verifyCode = value;
                  },
                  onPressEnter: () => {
                    // Ant Design Vue 的 confirm 无法直接触发 OK，这里只负责保存输入值。
                  },
                }),
                renderActionControl(type),
              ],
            )
          : undefined,
        applyResult?.mockCode
          ? h(
              'div',
              {
                'data-test': 'dynamic-verify-mock-code',
                style: 'margin-top:12px;',
              },
              `测试验证码（非生产）：${applyResult.mockCode}`,
            )
          : undefined,
        serverPrompt
          ? h(
              'div',
              {
                style:
                  'margin-top:8px;font-size:12px;line-height:1.5;color:hsl(var(--destructive));',
              },
              [serverPrompt],
            )
          : undefined,
      ]);
    };

    modalRef = Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: renderContent(),
      keyboard: false,
      maskClosable: false,
      okText: '确定',
      onCancel: () => {
        if (!settled) {
          settled = true;
          reject(new CanceledError('已取消动态验证码验证'));
        }
      },
      onOk: async () => {
        const type = getCurrentType();
        if (isBehaviorVerify(type)) {
          await triggerApply();

          if (!behaviorChallenge) {
            const error = new Error('当前行为验证码模式暂不支持');
            settled = true;
            reject(error);
            message.warning('当前行为验证码模式暂不支持');
            return Promise.reject(error);
          }

          message.warning('请先完成行为验证码');
          return Promise.reject(new Error('请先完成行为验证码'));
        }

        if (!applyResult && shouldShowGetCodeButton(type)) {
          message.warning('请先获取验证码');
          return Promise.reject(new Error('请先获取验证码'));
        }

        const result = applyResult || (await triggerApply());
        const code = verifyCode.trim();
        if (!code) {
          message.warning('请输入验证码');
          return Promise.reject(new Error('请输入验证码'));
        }

        settled = true;
        resolve({
          paramName: result.paramName,
          verifyId: result.verifyId,
          verifyCode: code,
        });
        return undefined;
      },
      title: renderVerifyModalTitle(getCurrentType()),
      ...presentation(),
    });

    if (!shouldShowGetCodeButton(getCurrentType())) {
      void triggerApply();
    }
  });
}

async function processDynamicVerifyCode(
  client: RequestClient,
  response: RequestResponse,
) {
  const originalConfig = response.config as DynamicVerifyRequestConfig;
  const prompt = decodeHeaderValue(
    getHeader(response.headers, DYNAMIC_VERIFY_PROMPT_HEADER),
  );
  const requiredVerifyType = getHeader(
    response.headers,
    DYNAMIC_VERIFY_TYPE_HEADER,
  );

  if (originalConfig.__dynamicVerifyRetried) {
    throw new Error(prompt || '动态验证码验证失败，请重新发起请求');
  }

  const { paramName, verifyCode, verifyId } = await promptDynamicVerifyCode(
    {
      prompt,
      type: requiredVerifyType,
    },
    async () => {
      await prepareMultipartReplay(originalConfig);
      const codeResponse = await client.instance.request(
        buildReplayConfig(
          originalConfig,
          {
            [DYNAMIC_VERIFY_HEADER]: DYNAMIC_VERIFY_APPLY_VALUE,
          },
          {
            __dynamicVerifyKeepRaw: true,
            responseReturn: 'raw',
          },
        ),
      );

      const paramName = getHeader(
        codeResponse.headers,
        DYNAMIC_VERIFY_PARAM_NAME_HEADER,
      );
      const verifyId = getHeader(
        codeResponse.headers,
        DYNAMIC_VERIFY_ID_HEADER,
      );

      if (!paramName) {
        throw new Error(prompt || '动态验证码接口未返回验证码参数名');
      }
      if (!verifyId) {
        throw new Error(prompt || '动态验证码接口未返回验证ID');
      }

      const type =
        getHeader(codeResponse.headers, DYNAMIC_VERIFY_TYPE_HEADER) ||
        requiredVerifyType ||
        '';
      return {
        mockCode: getHeader(
          codeResponse.headers,
          '-DynamicVerifyCode-MockCode',
        ),
        friendlyMessage: decodeHeaderValue(
          getHeader(codeResponse.headers, DYNAMIC_VERIFY_PROMPT_HEADER),
        ),
        // 行为题面包含图片，使用响应体避免超过 HTTP 响应头上限。
        interactionData: isBehaviorVerify(type)
          ? JSON.stringify(codeResponse.data)
          : decodeHeaderValue(
              getHeader(
                codeResponse.headers,
                DYNAMIC_VERIFY_INTERACTION_DATA_HEADER,
              ),
            ),
        paramName,
        type,
        verifyId,
      };
    },
  );

  const finalResponse = await client.instance.request(
    buildReplayConfig(
      originalConfig,
      {
        [paramName]: verifyCode,
        [DYNAMIC_VERIFY_ID_HEADER]: verifyId,
      },
      {
        __dynamicVerifyKeepRaw: true,
        __dynamicVerifyRetried: true,
      },
    ),
  );

  delete (finalResponse.config as DynamicVerifyRequestConfig)
    .__dynamicVerifyKeepRaw;

  return finalResponse;
}

export function createDynamicVerifyCodeInterceptor(
  client: RequestClient,
): ResponseInterceptorConfig {
  return {
    fulfilled: async (response) => {
      const config = response.config as DynamicVerifyRequestConfig;

      if (config.__dynamicVerifyKeepRaw || !isDynamicVerifyRequired(response)) {
        return response;
      }

      return processDynamicVerifyCode(client, response);
    },
  };
}
