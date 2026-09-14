import type {
  AxiosRequestConfig,
  RequestInterceptorConfig,
} from '@vben/request';

import { AxiosHeaders } from '@vben/request';

/** 只保存条目快照，普通上传不提前读取文件或编码整个请求体。 */
export function createMultipartRequestInterceptor(): RequestInterceptorConfig {
  return {
    fulfilled: (config) => {
      if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
        const snapshot = new FormData();
        for (const [name, value] of config.data.entries()) {
          snapshot.append(name, value);
        }
        config.data = snapshot;
      }
      return config;
    },
  };
}

/** 仅申请动态挑战前编码一次，Apply 与验证提交复用真实字节及 boundary。 */
export async function prepareMultipartReplay(config: AxiosRequestConfig) {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    // 原生编码仅在本地进行，不发送额外请求。
    const encoded = new Response(config.data);
    config.data = await encoded.arrayBuffer();
    config.headers = AxiosHeaders.from(config.headers);
    config.headers.set('Content-Type', encoded.headers.get('Content-Type'));
  }
}
