import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';

interface BackendUserInfo {
  avatar?: string;
  email?: string;
  id?: string;
  loginName?: string;
  name?: string;
  nickname?: string;
  roleList?: string[];
  telephone?: string;
  tenantId?: string;
  [key: string]: any;
}

function normalizeUserInfo(data: BackendUserInfo): UserInfo {
  const username =
    data.loginName || data.email || data.telephone || data.id || 'unknown';
  const realName = data.name || data.nickname || username;

  return {
    ...data,
    avatar: data.avatar || '',
    desc: data.tenantId ? `租户：${data.tenantId}` : '平台管理用户',
    homePath: '/clob/V1/Role',
    realName,
    roles: data.roleList || [],
    token: '',
    userId: data.id || '',
    username,
  };
}

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  const data = await requestClient.get<BackendUserInfo>('/rbac/userInfo');
  return normalizeUserInfo(data);
}
