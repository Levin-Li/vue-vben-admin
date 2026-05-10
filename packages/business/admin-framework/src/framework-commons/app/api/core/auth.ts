import { baseRequestClient } from '@levin/admin-framework/framework-commons/app/api/request';
import {
  rbacService,
  type RbacApi,
} from '@levin/admin-framework/framework-commons/app/api/rbac-service';

export namespace AuthApi {
  export type LoginParams = RbacApi.LoginParams;
  export type LoginResult = RbacApi.LoginResult;
  export type RefreshTokenResult =
    | string
    | { accessToken?: string; data?: string };
  export type UpdateLoginInfoParams = RbacApi.UpdateLoginInfoParams;
  export type VerifyCodeParams = RbacApi.VerifyCodeParams;
  export type VerifyCodeResult = RbacApi.VerifyCodeResult;
}

export async function loginApi(data: AuthApi.LoginParams) {
  return rbacService.login(data);
}

/**
 * 刷新accessToken。
 * 注意：当前后端 com.levin.oak.base.web.controller.rbac.RbacController 没有 refresh 映射。
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>(
    rbacService.buildRequestPath('refresh'),
    {
      withCredentials: true,
    },
  );
}

export async function getVerifyCodeApi(params: AuthApi.VerifyCodeParams) {
  return rbacService.getVerifyCode(params);
}

export async function updateLoginInfoApi(data: AuthApi.UpdateLoginInfoParams) {
  return rbacService.updateLoginInfo(data);
}

export async function logoutApi() {
  return rbacService.logout();
}

export async function getUserInfoApi() {
  return rbacService.getUserInfo();
}

export async function getAccessCodesApi() {
  return rbacService.getAccessCodes();
}
