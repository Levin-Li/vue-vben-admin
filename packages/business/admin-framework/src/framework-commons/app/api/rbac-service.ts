import type { UserInfo } from '@vben/types';

import type { BackendMenuInfo } from './core/menu-route';

import { ResAuthorize, Service } from './common/api-authorize';
import { baseRequestClient, requestClient } from './request';

export namespace RbacApi {
  export interface LoginParams {
    account?: string;
    password?: string;
    verifyCode?: string;
    verifyCodeType?: string;
  }

  export interface RegisterParams extends Record<string, any> {
    account?: string;
    password?: string;
    verifyCode?: string;
    verifyCodeType?: string;
  }

  export interface LoginResult {
    accessToken: string;
    refreshToken?: string;
    userInfo?: BackendUserInfo;
  }

  export interface AppClientParams {
    appId?: string;
    tenantId?: string;
  }

  export interface CaptchaParams extends AppClientParams {
    account: string;
    [key: string]: any;
  }

  export interface VerifyCodeParams extends AppClientParams {
    account?: string;
    verifyCodeType?: string;
  }

  export interface VerifyCodeResult {
    account?: string;
    code?: null | string;
    interactionData?: null | string;
    interactionDataType?: null | string;
    isMock?: boolean;
    isSuccessful?: boolean;
    mock?: boolean;
    successful?: boolean;
    type?: string;
  }

  export interface BackendUserInfo {
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

  export interface TenantSiteInfo {
    appAuthDomain?: null | string;
    copyright?: null | string;
    domain?: null | string;
    id?: null | string;
    logo?: null | string;
    name?: null | string;
    shortcutIcon?: null | string;
    sysLogo?: null | string;
    sysName?: null | string;
    techSupport?: null | string;
    tenantId?: null | string;
    uiExInfo?: null | Record<string, any>;
    [key: string]: any;
  }

  export interface TenantInfo extends TenantSiteInfo {
    appId?: null | string;
    appSecret?: null | string;
    balance?: null | number;
    encryptKey?: null | string;
    remainingLicenseCnt?: null | number;
  }

  export interface UpdateLoginInfoParams {
    avatar?: string;
    birthday?: Date | string;
    newEmail?: string;
    newEmailVerifyCode?: string;
    newLoginName?: string;
    newName?: string;
    newPwd?: string;
    newTelephone?: string;
    newTelephoneVerifyCode?: string;
    nickname?: string;
    oldPwd?: string;
    signature?: string;
    verifyCode?: string;
    verifyCodeType?: 'Bio' | 'Captcha' | 'Email' | 'Hmi' | 'Mfa' | 'Sms';
  }

  export interface AuthorizedOrgListParams {
    assembleTree?: boolean;
    rootOrgIdList?: string[];
  }

  export interface AuthorizedResourceModulesParams {
    isShowSysDefaultRes?: boolean;
  }

  export interface AuthorizedMenuListParams {
    loadAll?: boolean;
  }
}

type BackendUserInfo = RbacApi.BackendUserInfo;

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

function normalizeAuthorizedOrgOptions(data: any[]): any[] {
  return data.filter(Boolean).map((item) => {
    const children =
      item.children || item.childList || item.subList || item.orgList || [];
    return {
      ...item,
      children: Array.isArray(children)
        ? normalizeAuthorizedOrgOptions(children)
        : undefined,
      label: item.name ?? item.label ?? item.id,
      value: item.id ?? item.value ?? item.code,
    };
  });
}

@Service({
  basePath: '/rbac',
  controllerClass: 'com.levin.oak.base.web.controller.rbac.RbacController',
  description: '授权管理',
  title: '授权管理',
  type: '公共数据-权限控制',
})
export class RbacService {
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-权限控制',
    action: '获取验证码',
    ignored: true,
  })
  async getVerifyCode(params: RbacApi.VerifyCodeParams) {
    return baseRequestClient.get<RbacApi.VerifyCodeResult>(
      '/rbac/getVerifyCode',
      {
        params,
      },
    );
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-权限控制',
    action: '验证码图片链接',
    ignored: true,
  })
  getCaptchaUrl(params: RbacApi.CaptchaParams) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        search.set(key, String(value));
      }
    }
    const query = search.toString();
    return query ? `/rbac/captcha?${query}` : '/rbac/captcha';
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-权限控制',
    action: '用户注册并登录',
    ignored: true,
  })
  async register(data: RbacApi.RegisterParams) {
    return baseRequestClient.post<RbacApi.LoginResult>('/rbac/register', data);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-权限控制',
    action: '用户登录',
    ignored: true,
  })
  async login(data: RbacApi.LoginParams) {
    return requestClient.post<RbacApi.LoginResult>('/rbac/login', data);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-权限控制',
    action: '用户登出',
    ignored: true,
  })
  async logout() {
    return requestClient.get('/rbac/logout', {
      withCredentials: true,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-权限控制',
    action: '用户信息',
    onlyRequireAuthenticated: true,
  })
  async getUserInfo() {
    const data = await requestClient.get<BackendUserInfo>('/rbac/userInfo');
    return normalizeUserInfo(data);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-权限控制',
    action: '获取租户站点信息',
    ignored: true,
  })
  async getTenantSiteInfo() {
    return baseRequestClient.get<RbacApi.TenantSiteInfo>(
      '/rbac/tenantSiteInfo',
      {
        __silentError: true,
      } as any,
    );
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-权限控制',
    action: '获取租户信息',
    ignored: true,
  })
  async getTenantInfo() {
    return baseRequestClient.get<RbacApi.TenantInfo>('/rbac/tenantInfo', {
      __silentError: true,
    } as any);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-权限控制',
    action: '修改登录信息',
    onlyRequireAuthenticated: true,
  })
  async updateLoginInfo(data: RbacApi.UpdateLoginInfoParams) {
    return requestClient.put<null>('/rbac/updateLoginInfo', data);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-权限控制',
    action: '获取授权的组织列表',
    onlyRequireAuthenticated: true,
  })
  async fetchAuthorizedOrgTree(params: RbacApi.AuthorizedOrgListParams = {}) {
    const { rootOrgIdList, ...restParams } = params;
    return requestClient.get<any[]>('/rbac/authorizedOrgList', {
      params: {
        assembleTree: true,
        ...restParams,
        ...(rootOrgIdList ? { rootOrgIdList } : {}),
      },
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-权限控制',
    action: '获取授权的组织选项',
    onlyRequireAuthenticated: true,
  })
  async fetchAuthorizedOrgOptions(
    params: RbacApi.AuthorizedOrgListParams = {},
  ) {
    const data = await this.fetchAuthorizedOrgTree(params);
    return normalizeAuthorizedOrgOptions(data);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-权限控制',
    action: '获取授权的树形资源权限',
    onlyRequireAuthenticated: true,
  })
  async fetchAuthorizedResourceModules(
    params: RbacApi.AuthorizedResourceModulesParams = {},
  ) {
    return requestClient.get<any[]>('/rbac/authorizedResList', {
      params: {
        isShowSysDefaultRes: false,
        ...params,
      },
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-权限控制',
    action: '获取授权的资源权限列表',
    onlyRequireAuthenticated: true,
  })
  async getAccessCodes() {
    return requestClient.get<string[]>('/rbac/authorizedPermissionList');
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-权限控制',
    action: '获取授权的菜单列表',
    onlyRequireAuthenticated: true,
  })
  async getAuthorizedMenuList(params: RbacApi.AuthorizedMenuListParams = {}) {
    return requestClient.get<BackendMenuInfo[]>('/rbac/authorizedMenuList', {
      params: {
        loadAll: true,
        ...params,
      },
    });
  }
}

export const rbacService = new RbacService();
