import { ResAuthorize, Service } from '../../api-authorize';
import { RequestService } from '../../request-service';
import { baseRequestClient } from './request';

export type OAuthTransactionPurpose = 'BIND' | 'INVITE' | 'LOGIN';

export interface OAuthSupportedPlatform {
  authType?: null | string;
  capabilities?: null | string[] | { inAppLogin?: boolean; oauth?: boolean };
  capability?: null | string[];
  code?: null | string;
  description?: null | string;
  enabled?: boolean;
  icon?: null | string;
  iconUrl?: null | string;
  id?: null | string;
  loginUrl?: null | string;
  name?: null | string;
  platform?: null | string;
  supports?: null | string[];
  title?: null | string;
}

export interface CreateOAuthTransactionParams {
  callbackUrl?: null | string;
  fallbackUrl?: null | string;
  invitationToken?: string;
  platform: string;
  purpose: OAuthTransactionPurpose;
  returnUrl?: null | string;
}

export interface OAuthInvitationRedeemParams {
  account?: string;
  legalSubjectName?: string;
  organizationName?: string;
  password?: string;
  token: string;
  transactionId: string;
  unifiedCreditNo?: string;
  verificationCode?: string;
  verifyCodeType?: 'Email' | 'Sms';
}

export interface OAuthTransaction {
  authorizeUrl?: null | string;
  authUrl?: null | string;
  errorCode?: null | string;
  errorMessage?: null | string;
  id: string;
  loginTicket?: null | string;
  message?: null | string;
  platform?: null | string;
  providerData?: null | Record<string, any>;
  purpose?: null | OAuthTransactionPurpose;
  qrCodeUrl?: null | string;
  status?:
    | 'AUTHORIZED'
    | 'CANCELLED'
    | 'COMPLETED'
    | 'EXCHANGED'
    | 'EXPIRED'
    | 'FAILED'
    | 'PENDING'
    | (string & {});
  ticket?: null | string;
  transactionId?: null | string;
}

// 仅接受 OAuth 协议的公开回调字段，不接收本地访问令牌或用户资料。
export interface OAuthCallbackParams {
  auth_code?: string;
  authorization_code?: string;
  code?: string;
  oauth_token?: string;
  oauth_verifier?: string;
  state: string;
}

// App 内上下文只包含公开应用标识，授权码仅在本次请求中使用。
export interface InAppOAuthTransaction extends OAuthTransaction {
  clientId?: string;
  corpId?: string;
  state: string;
}

export interface OAuthBinding {
  avatar?: null | string;
  boundAt?: null | string;
  canUnbind?: boolean;
  externalUserId?: null | string;
  externalUsername?: null | string;
  id: string;
  lastLoginAt?: null | string;
  name?: null | string;
  nickname?: null | string;
  platform?: null | string;
  platformName?: null | string;
  // 当前SocialUserInfo返回的实际平台来源字段。
  sourcePlatform?: null | string;
  title?: null | string;
}

export type OAuthBindingListResult =
  | OAuthBinding[]
  | {
      data?: null | OAuthBinding[];
      items?: null | OAuthBinding[];
      records?: null | OAuthBinding[];
    };

export interface OAuthExchangeResult {
  accessToken?: null | string;
  binding?: null | OAuthBinding;
  data?: any;
  loginTicket?: null | string;
  token?: null | string;
  userInfo?: null | Record<string, any>;
}

@Service({
  basePath: '/oauth',
  controllerClass: 'com.levin.oak.base.web.controller.commons.OAuthController',
  description: 'OAuth认证服务',
  title: 'OAuth认证服务',
  type: '公共接口-OAuth认证服务',
})
export class OAuthService extends RequestService {
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共接口-OAuth认证服务',
    action: '第3方平台授权',
    ignored: true,
  })
  async authorize(platform: string, params?: any, options?: any) {
    return this.get(`authorize/${platform}`, {
      ...options,
      params,
    });
  }
  @ResAuthorize({ ignored: true })
  async authorizeInAppTransaction(
    id: string,
    data: { code: string; state: string },
    options?: any,
  ) {
    return this.post<OAuthTransaction>(
      `inApp/transactions/${encodeURIComponent(id)}/authorize`,
      { ...options, data },
    );
  }

  // 绑定回调由已恢复本地会话的网页携带 Authorization 提交。
  @ResAuthorize({ ignored: true })
  async authorizeTransaction(
    id: string,
    data: OAuthCallbackParams,
    options?: any,
  ) {
    return this.post<OAuthTransaction>(
      `transactions/${encodeURIComponent(id)}/authorize`,
      { ...options, data },
    );
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共接口-OAuth认证服务',
    action: '第3方平台授权回调',
    ignored: true,
  })
  async callback(platform: string, params?: any, options?: any) {
    return this.get(`callback/${platform}`, {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共接口-OAuth认证服务',
    action: '取消OAuth授权事务',
    ignored: true,
  })
  async cancelTransaction(id: string, options?: any) {
    return this.post(`transactions/${id}/cancel`, {
      ...options,
    });
  }

  // 控制器创建受浏览器、用途与 state 约束的企业 App 内授权事务。
  @ResAuthorize({ ignored: true })
  async createInAppTransaction(
    data: CreateOAuthTransactionParams,
    options?: any,
  ) {
    return this.post<InAppOAuthTransaction>('inApp/transactions', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共接口-OAuth认证服务',
    action: '创建OAuth授权事务',
    ignored: true,
  })
  async createTransaction(data: CreateOAuthTransactionParams, options?: any) {
    return this.post<OAuthTransaction>('transactions', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共接口-OAuth认证服务',
    action: '兑换OAuth授权事务结果',
    ignored: true,
  })
  async exchangeTransaction(id: string, data?: any, options?: any) {
    return this.post<OAuthExchangeResult>(`transactions/${id}/exchange`, {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共接口-OAuth认证服务',
    action: '查询当前用户第三方绑定列表',
    ignored: true,
  })
  async getMyBindings(options?: any) {
    return this.get<OAuthBindingListResult>('bindings/me', {
      ...options,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共接口-OAuth认证服务',
    action: '获取支持的第3方平台登录列表',
    ignored: true,
  })
  async getSupportedPlatforms(params?: any, options?: any) {
    // 公开登录目录不依赖上一会话的业务策略。
    return baseRequestClient.get(
      this.buildRequestPath('getSupportedPlatforms'),
      {
        ...options,
        baseURL: '',
        params,
      },
    );
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共接口-OAuth认证服务',
    action: '查询OAuth授权事务状态',
    ignored: true,
  })
  async getTransaction(id: string, options?: any) {
    return this.get<OAuthTransaction>(`transactions/${id}`, {
      ...options,
    });
  }

  @ResAuthorize({ ignored: true })
  async redeemInvitation(data: OAuthInvitationRedeemParams, options?: any) {
    return this.post<{
      accountId: string;
      businessId?: string;
    }>('invitationRedeemOAuth', { ...options, data });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共接口-OAuth认证服务',
    action: '解绑当前用户第三方账号',
    ignored: true,
  })
  async unbindBinding(id: string, data?: any, options?: any) {
    return this.post(`bindings/${id}/unbind`, {
      ...options,
      data,
    });
  }
}

export const oauthService = new OAuthService();
