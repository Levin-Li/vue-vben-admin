/** 只有明确的限流响应才允许直接重试；网络错误的结果仍可能未知。 */
export function isReportRateLimited(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { status?: unknown; httpStatusCode?: unknown; response?: { status?: unknown } };
  return value.response?.status === 429 || value.status === 429 || value.httpStatusCode === 429;
}
