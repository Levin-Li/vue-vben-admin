import { ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/PaymentSimulationWorkbench',
  controllerClass: 'com.levin.oak.base.controller.PaymentSimulationWorkbenchController',
  description: '支付模拟工作台',
  title: '支付模拟工作台',
  type: '测试工具-支付模拟工作台',
})
export class PaymentSimulationWorkbenchService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '测试工具-支付模拟工作台',
    action: '查看状态',
    onlyRequireAuthenticated: true,
  })
  async status(params?: any, options?: any) {
    return this.get('status', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '测试工具-支付模拟工作台',
    action: '创建测试订单',
    onlyRequireAuthenticated: true,
  })
  async createOrder(data?: any, options?: any) {
    return this.post('createOrder', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '测试工具-支付模拟工作台',
    action: '推进确认数',
    onlyRequireAuthenticated: true,
  })
  async advanceConfirmation(data?: any, options?: any) {
    return this.post('advanceConfirmation', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '测试工具-支付模拟工作台',
    action: '查询状态',
    onlyRequireAuthenticated: true,
  })
  async query(params?: any, options?: any) {
    return this.get('query', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '测试工具-支付模拟工作台',
    action: '模拟过期',
    onlyRequireAuthenticated: true,
  })
  async expire(data?: any, options?: any) {
    return this.post('expire', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '测试工具-支付模拟工作台',
    action: '发送模拟回调',
    onlyRequireAuthenticated: true,
  })
  async callback(data?: any, options?: any) {
    return this.post('callback', {
      ...options,
      data,
    });
  }
}

export const paymentSimulationWorkbenchService =
  new PaymentSimulationWorkbenchService();
