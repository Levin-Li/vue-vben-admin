import { ResAuthorize, Service } from './common/api-authorize';
import { RequestService } from './common/request-service';

@Service({
  basePath: '/doc',
  controllerClass: 'com.levin.oak.base.web.controller.commons.ApiDocController',
  description: 'API文档',
  title: 'ApiDoc',
  type: '系统接口-API文档',
})
export class ApiDocService extends RequestService {
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统接口-API文档',
    action: 'SpringDoc API路径转发',
    ignored: true,
  })
  async springDocPath(path: string = '', options?: any) {
    return this.get(`v3/api-docs/${path}`.replace(/\/+$/, ''), options);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统接口-API文档',
    action: '文档根路径转发',
    ignored: true,
  })
  async index(options?: any) {
    return this.get('', options);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统接口-API文档',
    action: '文档首页转发',
    ignored: true,
  })
  async indexHtml(options?: any) {
    return this.get('index.html', options);
  }
}

export const apiDocService = new ApiDocService();
