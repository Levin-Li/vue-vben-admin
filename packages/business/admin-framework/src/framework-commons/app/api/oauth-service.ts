import { ResAuthorize, Service } from '../../api-authorize';
import { RequestService } from '../../request-service';

export type OAuthTransactionPurpose = 'BIND' | 'LOGIN';

export interface OAuthSupportedPlatform {
  authType?: null | string;
  capabilities?: null | string[];
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
  platform: string;
  purpose: OAuthTransactionPurpose;
  returnUrl?: null | string;
}

export interface OAuthTransaction {
  authUrl?: null | string;
  authorizeUrl?: null | string;
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
    action: '获取支持的第3方平台登录列表',
    ignored: true,
  })
  async getSupportedPlatforms(params?: any, options?: any) {
    return this.get('getSupportedPlatforms', {
      ...options,
      params,
    });
  }

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
    action: '查询OAuth授权事务状态',
    ignored: true,
  })
  async getTransaction(id: string, options?: any) {
    return this.get<OAuthTransaction>(`transactions/${id}`, {
      ...options,
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
    action: '取消OAuth授权事务',
    ignored: true,
  })
  async cancelTransaction(id: string, options?: any) {
    return this.post(`transactions/${id}/cancel`, {
      ...options,
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
