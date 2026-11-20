/** 只识别服务端明确的会话失效，避免将上下文故障当成登录过期。 */
export function isExplicitSessionExpired(error: any): boolean {
  const response = error?.response;
  const message =
    typeof response?.data === 'string'
      ? response.data
      : String(response?.data?.msg ?? response?.data?.message ?? '');
  return (
    response?.status === 401 &&
    !/SaTokenContext|上下文|context.*(?:invalid|initializ)/i.test(message)
  );
}

/** 对同一会话的并发 401 合并复核；复核无法确认时始终保留会话。 */
export function createSessionRecheck(options: {
  currentToken: () => null | string;
  probe: (token: string) => Promise<unknown>;
  reauthenticate: (token: string) => Promise<string | undefined>;
}) {
  const pending = new Map<string, Promise<string | undefined>>();
  return async (token: string) => {
    if (!token || options.currentToken() !== token) return;
    let flight = pending.get(token);
    if (!flight) {
      flight = (async () => {
        try {
          await options.probe(token);
        } catch (error: any) {
          if (
            isExplicitSessionExpired(error) &&
            options.currentToken() === token
          )
            return await options.reauthenticate(token);
        }
      })().finally(() => pending.delete(token));
      pending.set(token, flight);
    }
    return await flight;
  };
}

/** 保留可选刷新能力；只更新仍属于失败请求的同一会话。 */
export function createSessionRecovery(options: {
  currentToken: () => null | string;
  reauthenticate: () => Promise<void>;
  refresh: () => Promise<string>;
  refreshEnabled: () => boolean;
  setToken: (token: string) => void;
}) {
  const pending = new Map<string, Promise<string | undefined>>();
  return async (token: string) => {
    if (!token || options.currentToken() !== token) return;
    let flight = pending.get(token);
    if (!flight) {
      flight = (async () => {
        if (options.refreshEnabled()) {
          try {
            const refreshed = await options.refresh();
            if (!refreshed) throw new Error('刷新令牌结果为空');
            if (options.currentToken() !== token) return;
            options.setToken(refreshed);
            return refreshed;
          } catch {
            // 刷新失败时仍需确认会话没有被其他登录替换。
          }
        }
        if (options.currentToken() === token) await options.reauthenticate();
      })().finally(() => pending.delete(token));
      pending.set(token, flight);
    }
    return await flight;
  };
}
