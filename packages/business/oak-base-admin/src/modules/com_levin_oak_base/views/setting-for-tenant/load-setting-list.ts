/** 只对可识别的暂时性读取失败重试，不重复提交业务拒绝或已取消的请求。 */
function isTransientListError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const failure = error as {
    __CANCEL__?: boolean;
    code?: string;
    httpStatusCode?: number;
    isAxiosError?: boolean;
    response?: { status?: number };
  };

  if (failure.__CANCEL__ || failure.code === 'ERR_CANCELED') return false;

  // 服务端公开错误保留 HTTP 状态时，仅重试服务不可用一类的 5xx。
  const status = failure.response?.status ?? failure.httpStatusCode;
  if (typeof status === 'number' && status > 0) return status >= 500;

  // 无响应的 Axios 网络失败与超时属于可恢复的传输错误。
  return (
    failure.isAxiosError === true &&
    (failure.code === 'ERR_NETWORK' ||
      failure.code === 'ECONNABORTED' ||
      failure.code === 'ETIMEDOUT')
  );
}

/** 设置列表为只读请求；首次暂时性失败时只补发一次。 */
export async function loadSettingListWithRetry<T>(
  read: () => Promise<T>,
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (!isTransientListError(error)) throw error;
  }

  return read();
}
