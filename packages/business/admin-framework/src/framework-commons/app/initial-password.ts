/** 只解释服务端用户信息，浏览器标志不参与首次改密的授权判定。 */
export function mustChangeInitialPassword(userInfo: unknown): boolean {
  if (!userInfo || typeof userInfo !== 'object') {
    return false;
  }

  return (
    (userInfo as { mustChangeInitialPassword?: unknown })
      .mustChangeInitialPassword === true
  );
}

export const INITIAL_PASSWORD_CHANGE_PATH = '/profile';
