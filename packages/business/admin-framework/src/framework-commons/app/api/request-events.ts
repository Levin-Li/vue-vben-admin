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

export function isApiRequestEventUrl(
  payload: ApiRequestEventPayload,
  path: string,
) {
  const url = getApiRequestEventUrl(payload);

  return url === path || url.endsWith(path) || url.includes(path);
}
