import { requestClient } from '../request';

export const OAK_BASE_API_MODULE = '/com.levin.oak.base/V1/api';

function buildModulePath(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${OAK_BASE_API_MODULE}${normalizedPath}`;
}

export function oakBaseGet<T>(path: string, config: Record<string, any> = {}) {
  return requestClient.get<T>(buildModulePath(path), {
    ...config,
    baseURL: '',
  });
}

export function oakBasePost<T>(
  path: string,
  payload?: any,
  config: Record<string, any> = {},
) {
  return requestClient.post<T>(buildModulePath(path), payload, {
    ...config,
    baseURL: '',
  });
}

export function oakBasePut<T>(
  path: string,
  payload?: any,
  config: Record<string, any> = {},
) {
  return requestClient.put<T>(buildModulePath(path), payload, {
    ...config,
    baseURL: '',
  });
}

export function oakBaseDelete<T>(
  path: string,
  config: Record<string, any> = {},
) {
  return requestClient.delete<T>(buildModulePath(path), {
    ...config,
    baseURL: '',
  });
}
