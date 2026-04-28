import { CRUD, ResAuthorize, Service } from '../common/api-authorize';
import { RequestService } from '../common/request-service';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/PayOrder',
  description: '支付订单管理',
  title: '支付订单',
  type: '业务数据-支付订单',
})
export class PayOrderService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支付订单',
    action: '申请退款',
    onlyRequireAuthenticated: true,
  })
  async applyRefund(data?: any, options?: any) {
    return this.post('applyRefund', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支付订单',
    action: '自动配置支付回调地址',
    anyRoles: ['R_SA'],
  })
  async autoConfigPayCallbackUrl(params?: any, options?: any) {
    return this.get('autoConfigPayCallbackUrl', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支付订单',
    action: '清除缓存',
  })
  async clearCache(params?: any, options?: any) {
    return this.get('clearCache', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支付订单',
    action: '新增',
  })
  @CRUD.Op({
    opRefTargetType: 'None',
  })
  async create(data?: any, options?: any) {
    return this.post('create', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支付订单',
    action: '汇率询价',
    onlyRequireAuthenticated: true,
  })
  async inquiryExchangeRate(params?: any, options?: any) {
    return this.get('inquiryExchangeRate', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支付订单',
    action: '查询列表',
  })
  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.PayOrder',
  })
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支付订单',
    action: 'App支付',
    onlyRequireAuthenticated: true,
  })
  async pay(data?: any, options?: any) {
    return this.post('pay', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    ignored: true,
  })
  async payCallback(payChannelId: string, params?: any, options?: any) {
    return this.post(`payCallback/${payChannelId}`, {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支付订单',
    action: '支付查询',
    onlyRequireAuthenticated: true,
  })
  async payQuery(params?: any, options?: any) {
    return this.get('payQuery', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支付订单',
    action: '退款',
  })
  async refund(data?: any, options?: any) {
    return this.post('refund', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支付订单',
    action: '退款查询',
    onlyRequireAuthenticated: true,
  })
  async refundQuery(params?: any, options?: any) {
    return this.get('refundQuery', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支付订单',
    action: '查看详情',
  })
  @CRUD.Op({
    confirmText: 'None',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', {
      ...options,
      params,
    });
  }
}

export const payOrderService = new PayOrderService();
