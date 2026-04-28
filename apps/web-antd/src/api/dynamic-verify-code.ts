import type {
  RequestClient,
  RequestClientConfig,
  RequestResponse,
  ResponseInterceptorConfig,
} from '@vben/request';

import { h } from 'vue';

import { CanceledError } from '@vben/request';

import { Input, message, Modal } from 'ant-design-vue';

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

const DYNAMIC_VERIFY_HEADER = '-DynamicVerifyCode-';
const DYNAMIC_VERIFY_APPLY_VALUE = 'Apply';
const DYNAMIC_VERIFY_PARAM_NAME_HEADER = '-DynamicVerifyCode-ParamName';
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

  if (
    data.startsWith('/9j/') ||
    data.startsWith('iVBOR') ||
    data.startsWith('R0lGOD') ||
    data.startsWith('PHN2Zy')
  ) {
    return `data:image/png;base64,${data}`;
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

function promptDynamicVerifyCode(info: DynamicVerifyPromptInfo) {
  return new Promise<string>((resolve, reject) => {
    let verifyCode = '';
    let settled = false;
    const title = getVerifyTypeLabel(info.type);
    const description =
      info.friendlyMessage ||
      info.prompt ||
      '当前接口需要完成验证码验证后才能继续。';

    Modal.confirm({
      centered: true,
      content: h('div', { style: 'padding-top:4px;' }, [
        h('div', { style: 'margin-bottom:8px;color:hsl(var(--foreground));' }, [
          description,
        ]),
        renderInteractionData(info.interactionData),
        h(Input, {
          allowClear: true,
          autofocus: true,
          placeholder: `请输入${title}`,
          'onUpdate:value': (value: string) => {
            verifyCode = value;
          },
          onPressEnter: () => {
            // Ant Design Vue 的 confirm 无法直接触发 OK，这里只负责保存输入值。
          },
        }),
      ]),
      okText: '验证并继续',
      onCancel: () => {
        if (!settled) {
          settled = true;
          reject(new CanceledError('已取消动态验证码验证'));
        }
      },
      onOk: () => {
        const code = verifyCode.trim();
        if (!code) {
          message.warning('请输入验证码');
          return Promise.reject(new Error('请输入验证码'));
        }

        settled = true;
        resolve(code);
        return undefined;
      },
      title,
    });
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

  if (originalConfig.__dynamicVerifyRetried) {
    throw new Error(prompt || '动态验证码验证失败，请重新发起请求');
  }

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

  if (!paramName) {
    throw new Error(prompt || '动态验证码接口未返回验证码参数名');
  }

  const verifyCode = await promptDynamicVerifyCode({
    friendlyMessage: decodeHeaderValue(
      getHeader(codeResponse.headers, DYNAMIC_VERIFY_PROMPT_HEADER),
    ),
    interactionData: decodeHeaderValue(
      getHeader(codeResponse.headers, DYNAMIC_VERIFY_INTERACTION_DATA_HEADER),
    ),
    prompt,
    type: getHeader(codeResponse.headers, DYNAMIC_VERIFY_TYPE_HEADER),
  });

  const finalResponse = await client.instance.request(
    buildReplayConfig(
      originalConfig,
      {
        [paramName]: verifyCode,
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
