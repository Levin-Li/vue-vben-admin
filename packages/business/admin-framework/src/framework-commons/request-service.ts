import { getServiceMeta } from './api-authorize';
import { requestClient } from './runtime';
import { encodeUrlPathSegments } from './url-encoding';

export interface RequestOptions extends Record<string, any> {
  path: string;
}

export type RequestPayloadOptions = Omit<RequestOptions, 'method' | 'path'>;

function joinPath(...parts: string[]) {
  const normalized = parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .map((part) => part.replaceAll(/^\/+|\/+$/g, ''));

  return `/${normalized.join('/')}`.replaceAll(/\/+/g, '/');
}

function hasPagingParams(params: any) {
  return (
    params &&
    typeof params === 'object' &&
    ('pageIndex' in params || 'pageSize' in params || 'pageNo' in params)
  );
}

function withListQueryDefaults(options: Record<string, any>) {
  if (
    String(options.method || '').toUpperCase() !== 'GET' ||
    !hasPagingParams(options.params)
  ) {
    return options;
  }

  return {
    ...options,
    params: {
      requireResultList: true,
      requireTotals: true,
      ...(options.params || {}),
    },
  };
}

export class RequestService {
  constructor(private readonly moduleBase = '') {}

  protected async deleteRequest<T>(
    path: string,
    options: RequestPayloadOptions = {},
  ) {
    return this.request<T>({
      ...options,
      method: 'DELETE',
      path,
    });
  }

  protected async get<T>(path: string, options: RequestPayloadOptions = {}) {
    return this.request<T>({
      ...options,
      method: 'GET',
      path,
    });
  }

  protected async post<T>(path: string, options: RequestPayloadOptions = {}) {
    return this.request<T>({
      ...options,
      method: 'POST',
      path,
    });
  }

  protected async put<T>(path: string, options: RequestPayloadOptions = {}) {
    return this.request<T>({
      ...options,
      method: 'PUT',
      path,
    });
  }

  protected async request<T>(options: RequestOptions) {
    const serviceMeta = getServiceMeta(this);
    const path = encodeUrlPathSegments(
      joinPath(this.moduleBase, serviceMeta.basePath || '', options.path || ''),
    );
    const { path: _path, ...rawRequestOptions } = options;
    const requestOptions = withListQueryDefaults(rawRequestOptions);

    return requestClient.request<T>(path, {
      baseURL: '',
      responseReturn: 'data',
      ...requestOptions,
    });
  }
}
