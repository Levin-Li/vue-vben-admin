import { ResAuthorize, Service } from '../../api-authorize';
import { RequestService } from '../../request-service';

@Service({
  basePath: '/enums',
  controllerClass: 'com.levin.oak.base.web.controller.commons.EnumController',
  description: '业务枚举类服务',
  title: '业务枚举类',
  type: '公共数据-业务枚举类',
})
export class EnumService extends RequestService {
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-业务枚举类',
    action: '查询列表',
    onlyRequireAuthenticated: true,
  })
  async list(params?: any, options?: any) {
    return this.get('', { ...options, params });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-业务枚举类',
    action: '查看详情',
    onlyRequireAuthenticated: true,
  })
  async detail(params?: any, options?: any) {
    return this.get('', { ...options, params });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-业务枚举类',
    action: '查看详情',
    onlyRequireAuthenticated: true,
  })
  async retrieve(enumName: string, options?: any) {
    return this.get(enumName, options);
  }
}

export const enumService = new EnumService();
