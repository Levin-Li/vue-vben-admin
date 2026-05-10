import {
  emitFrameworkEvent,
  onFrameworkEvent,
  type FrameworkEvent,
} from '../../event-bus';

export const API_REQUEST_EVENT_TYPE = 'api.request';

export interface ApiRequestEventPayload<Data = any> {
  config?: Record<string, any>;
  data?: Data;
  error?: any;
  rawData?: any;
  response?: any;
}

type ApiRequestEventListener<Data = any> = (
  payload: ApiRequestEventPayload<Data>,
) => void;

export function getApiRequestEventUrl(payload: ApiRequestEventPayload) {
  return String(payload.config?.url ?? payload.response?.config?.url ?? '');
}

export function getApiRequestEventTopic(payload: ApiRequestEventPayload) {
  return getApiRequestEventUrl(payload);
}

export function emitApiRequestEvent<Data = any>(
  payload: ApiRequestEventPayload<Data>,
) {
  return emitFrameworkEvent(
    API_REQUEST_EVENT_TYPE,
    getApiRequestEventTopic(payload),
    payload,
  );
}

export function onApiRequestTopic<Data = any>(
  pattern: string,
  listener: (event: FrameworkEvent<ApiRequestEventPayload<Data>>) => void,
  remark?: string,
) {
  return onFrameworkEvent<ApiRequestEventPayload<Data>>(
    API_REQUEST_EVENT_TYPE,
    pattern,
    listener,
    remark,
  );
}

export function onApiRequestSuccess<Data = any>(
  listener: ApiRequestEventListener<Data>,
) {
  return onApiRequestTopic<Data>(
    '*',
    (event) => {
      if (!event.data.error) {
        listener(event.data);
      }
    },
    '兼容旧 API 请求成功监听器',
  );
}

export function onApiRequestFailure(listener: ApiRequestEventListener) {
  return onApiRequestTopic(
    '*',
    (event) => {
      if (event.data.error) {
        listener(event.data);
      }
    },
    '兼容旧 API 请求失败监听器',
  );
}

export function emitApiRequestSuccess<Data = any>(
  payload: ApiRequestEventPayload<Data>,
) {
  return emitApiRequestEvent(payload);
}

export function emitApiRequestFailure(payload: ApiRequestEventPayload) {
  return emitApiRequestEvent(payload);
}

export function isApiRequestEventUrl(
  payload: ApiRequestEventPayload,
  path: string,
) {
  const url = getApiRequestEventUrl(payload);

  return url === path || url.endsWith(path) || url.includes(path);
}
