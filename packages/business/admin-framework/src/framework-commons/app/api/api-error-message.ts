import { message } from 'ant-design-vue';

export function showApiErrorMessage(content: string) {
  const text = String(content || '').trim() || '请求失败，请稍后重试';

  // 相同错误使用稳定键更新既有提示，避免并发请求把同一错误堆叠在页面上。
  message.error({
    content: text,
    key: `api-error:${text}`,
  });
}
