import { ResAuthorize, Service } from './common/api-authorize';
import { RequestService } from './common/request-service';

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
}

export const oauthService = new OAuthService();
