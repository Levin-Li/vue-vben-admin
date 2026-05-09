import { ResAuthorize, Service } from '../../api-authorize';
import { RequestService } from '../../request-service';

@Service({
  basePath: '/cache',
  controllerClass: 'com.levin.oak.base.web.controller.commons.CacheController',
  description: '缓存管理',
  title: '缓存管理',
  type: '系统数据-缓存管理',
})
export class CacheService extends RequestService {
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-缓存管理',
    action: '清除指定key的缓存',
  })
  async evict(params?: any, options?: any) {
    return this.get('evict', {
      ...options,
      params,
    });
  }
}

export const cacheService = new CacheService();
