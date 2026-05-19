import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

export interface ControllerInfo {
  desc?: string;
  id: string;
  label?: string;
  name?: string;
  pathPrefix?: string;
  pluginDesc?: string;
  pluginName?: string;
  pluginPackageName?: string;
  pluginPathPrefix?: string;
  pluginVersion?: string;
  type?: string;
}

export interface AmisPage {
  label: string;
  pageContent: string;
}

@Service({
  basePath: '/OnlineCodeGen',
  controllerClass: 'com.levin.oak.base.controller.admin.OnlineCodeGenController',
  description: '在线代码生成',
  title: '在线代码生成',
  type: '专家数据-Spring控制器',
})
export class OnlineCodeGenService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '专家数据-Spring控制器',
    res: '',
    action: '查询列表',
  })
  @CRUD.ListTable()
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '专家数据-Spring控制器',
    res: '',
    action: '生成百度 Amis 页面代码',
  })
  @CRUD.Op({
    label: '生成百度 Amis 页面',
    opRefTargetType: 'SingleRow',
    successAction: 'ShowForm',
  })
  async genAmisPageCode(params?: any, options?: any) {
    return this.get<AmisPage>('genAmisPageCode', {
      ...options,
      params,
    });
  }
}

export const onlineCodeGenService = new OnlineCodeGenService();
