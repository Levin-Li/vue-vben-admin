import { ResAuthorize, Service } from './common/api-authorize';
import { RequestService } from './common/request-service';

@Service({
  basePath: '/dummy',
  controllerClass: 'com.levin.oak.base.web.controller.commons.DummyController',
  description: '特殊权限处理用途控制器',
  title: '特殊类型',
  type: 'Dummy-特殊类型',
})
export class DummyService extends RequestService {
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: 'Dummy-特殊类型',
    action: '操作1',
  })
  async op1(params?: any, options?: any) {
    return this.get('op1', { ...options, params });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: 'Dummy-特殊类型',
    action: '操作2',
  })
  async op2(params?: any, options?: any) {
    return this.get('op2', { ...options, params });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: 'Dummy-特殊类型',
    action: '操作3',
  })
  async op3(params?: any, options?: any) {
    return this.get('op3', { ...options, params });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: 'Dummy-特殊类型',
    action: '操作4',
  })
  async op4(params?: any, options?: any) {
    return this.get('op4', { ...options, params });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: 'Dummy-特殊类型',
    action: '操作5',
  })
  async op5(params?: any, options?: any) {
    return this.get('op5', { ...options, params });
  }
}

export const dummyService = new DummyService();
