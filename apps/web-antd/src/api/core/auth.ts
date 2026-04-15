import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    account?: string;
    verifyCode?: string;
    verifyCodeType?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }

  export interface VerifyCodeParams {
    account?: string;
    verifyCodeType?: string;
  }

  export interface VerifyCodeResult {
    account?: string;
    code?: string | null;
    interactionData?: string | null;
    interactionDataType?: string | null;
    mock?: boolean;
    successful?: boolean;
    type?: string;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/rbac/login', data);
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>('/rbac/refresh', {
    withCredentials: true,
  });
}

export async function getVerifyCodeApi(params: AuthApi.VerifyCodeParams) {
  return baseRequestClient.get<AuthApi.VerifyCodeResult>('/rbac/getVerifyCode', {
    params,
  });
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return requestClient.get('/rbac/logout', {
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/rbac/authorizedPermissionList');
}
