import { message } from 'ant-design-vue';

const notifiedErrors = new WeakSet<object>();
const SERVER_ERROR_FALLBACK = '发生服务器异常';
let nextNotificationId = 0;

/** 只使用服务端面向用户的提示；detailMsg 可能包含内部异常堆栈。 */
export function getApiErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return SERVER_ERROR_FALLBACK;
  const value = error as {
    config?: { errorMessageOverride?: unknown };
    response?: {
      config?: { errorMessageOverride?: unknown };
      data?: unknown;
    };
  };
  const override =
    value.config?.errorMessageOverride ??
    value.response?.config?.errorMessageOverride;
  if (typeof override === 'string' && override.trim()) return override.trim();
  if (error instanceof Error && !value.response) return SERVER_ERROR_FALLBACK;
  let data = value.response ? value.response.data : error;
  // 部分响应适配器会保留 JSON 文本，仍只读取公开的业务提示字段。
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return SERVER_ERROR_FALLBACK;
    }
  }
  if (!data || typeof data !== 'object') return SERVER_ERROR_FALLBACK;
  const record = data as Record<string, unknown>;
  for (const candidate of [record.msg, record.message, record.error]) {
    if (typeof candidate === 'string' && candidate.trim())
      return candidate.trim();
  }
  return SERVER_ERROR_FALLBACK;
}

export function notifyApiErrorOnce(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    (error as { __CANCEL__?: boolean }).__CANCEL__ === true
  ) {
    return;
  }
  if (!isApiErrorNotified(error)) {
    showApiErrorMessage(getApiErrorMessage(error), error);
  }
}

/** 同一失败由请求层提示后，表单仅保留草稿，不再重复报错。 */
export function isApiErrorNotified(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if (notifiedErrors.has(error)) return true;
  const data = (error as { response?: { data?: unknown } }).response?.data;
  return typeof data === 'object' && data !== null && notifiedErrors.has(data);
}

export function showApiErrorMessage(content: string, error?: unknown) {
  if (isApiErrorNotified(error)) return;
  const text = String(content || '').trim() || SERVER_ERROR_FALLBACK;

  // 不同请求即使文案相同，也不能合并成同一次错误。
  message.error({
    content: text,
    key:
      typeof error === 'object' && error !== null
        ? `api-error:${++nextNotificationId}`
        : `api-error:${text}`,
  });
  if (typeof error === 'object' && error !== null) {
    notifiedErrors.add(error);
    // RequestClient.request 向页面抛出响应数据，而非 Axios 原始错误。
    const responseData = (error as { response?: { data?: unknown } }).response
      ?.data;
    if (typeof responseData === 'object' && responseData !== null) {
      notifiedErrors.add(responseData);
    }
  }
}
