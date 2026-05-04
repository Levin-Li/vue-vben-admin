import { baseRequestClient, requestClient } from '@levin/admin-framework/framework-commons/app/api/request';

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
    refreshToken?: string;
  }

  export type RefreshTokenResult =
    | string
    | { accessToken?: string; data?: string };

  export interface VerifyCodeParams {
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

  export interface UpdateLoginInfoParams {
    avatar?: string;
    birthday?: Date | string;
    newLoginName?: string;
    newName?: string;
    newEmail?: string;
    newEmailVerifyCode?: string;
    newPwd?: string;
    newTelephone?: string;
    newTelephoneVerifyCode?: string;
    oldPwd?: string;
    nickname?: string;
    signature?: string;
    verifyCode?: string;
    verifyCodeType?: 'Bio' | 'Captcha' | 'Email' | 'Hmi' | 'Mfa' | 'Sms';
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
  return baseRequestClient.get<AuthApi.VerifyCodeResult>(
    '/rbac/getVerifyCode',
    {
      params,
    },
  );
}

export async function updateLoginInfoApi(data: AuthApi.UpdateLoginInfoParams) {
  return requestClient.put<null>('/rbac/updateLoginInfo', data);
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
