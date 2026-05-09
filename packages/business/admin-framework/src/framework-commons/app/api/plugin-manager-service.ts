import { ResAuthorize, Service } from '../../api-authorize';
import { RequestService } from '../../request-service';

@Service({
  basePath: '/PluginManager',
  controllerClass:
    'com.levin.oak.base.web.controller.plugin.PluginManagerController',
  description: '插件管理',
  title: '插件管理',
  type: '平台数据-插件管理',
})
export class PluginManagerService extends RequestService {
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-插件管理',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-插件管理',
    action: '查看详情',
  })
  async retrieve(pluginId: string, options?: any) {
    return this.get(pluginId, options);
  }
}

export const pluginManagerService = new PluginManagerService();
