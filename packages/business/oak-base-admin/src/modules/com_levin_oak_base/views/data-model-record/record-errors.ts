// 只识别受控错误语义，不把服务端任意对象、堆栈或原始响应展示给使用者。
export function recordFailure(error: unknown, fallback: string): string {
  const object =
    error && typeof error === 'object'
      ? (error as Record<string, unknown>)
      : {};
  const response =
    object.response && typeof object.response === 'object'
      ? (object.response as Record<string, unknown>)
      : {};
  const data =
    response.data && typeof response.data === 'object'
      ? (response.data as Record<string, unknown>)
      : {};
  const messages = [
    error instanceof Error ? error.message : undefined,
    object.message,
    data.message,
  ].filter((value): value is string => typeof value === 'string');
  if (
    messages.some((value) =>
      /版本|冲突|concurr|conflict|optimistic/i.test(value),
    )
  )
    return '记录版本已变化或缺失，请重新加载记录后再操作；当前内容未覆盖服务端';
  return fallback;
}
