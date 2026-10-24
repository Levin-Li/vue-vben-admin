import { message } from 'ant-design-vue';

const notifiedErrors = new WeakSet<object>();

/** 同一失败由请求层提示后，表单仅保留草稿，不再重复报错。 */
export function isApiErrorNotified(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && notifiedErrors.has(error)
  );
}

export function showApiErrorMessage(content: string, error?: unknown) {
  const text = String(content || '').trim() || '请求失败，请稍后重试';

  // 相同错误使用稳定键更新既有提示，避免并发请求把同一错误堆叠在页面上。
  message.error({
    content: text,
    key: `api-error:${text}`,
  });
  if (typeof error === 'object' && error !== null) notifiedErrors.add(error);
}
