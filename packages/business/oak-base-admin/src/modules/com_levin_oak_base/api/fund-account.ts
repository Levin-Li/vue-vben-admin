import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/FundAccount',
  description: '资金账户管理',
  title: '资金账户',
  type: '业务数据-资金账户',
})
export class FundAccountService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-资金账户',
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
    type: '业务数据-资金账户',
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
    type: '业务数据-资金账户',
    action: '查询列表',
    onlyRequireAuthenticated: true,
  })
  async exList(params?: any, options?: any) {
    return this.get('exList', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-资金账户',
    action: '获取资金账户匹配的兑换规则列表',
    onlyRequireAuthenticated: true,
  })
  async getMatchedFundExchangeRuleList(params?: any, options?: any) {
    return this.get('getMatchedFundExchangeRuleList', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-资金账户',
    action: '获取资金账户匹配的支付通道列表',
    onlyRequireAuthenticated: true,
  })
  async getMatchedPayChannelList(params?: any, options?: any) {
    return this.get('getMatchedPayChannelList', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-资金账户',
    action: '赠送金额',
  })
  async gift(params?: any, options?: any) {
    return this.post('gift', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-资金账户',
    action: '查询列表',
  })
  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.FundAccount',
  })
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-资金账户',
    action: '二维码充值',
    onlyRequireAuthenticated: true,
  })
  async qrCodeRecharge(params?: any, options?: any) {
    return this.post('qrCodeRecharge', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-资金账户',
    action: '二维码充值+兑换',
    onlyRequireAuthenticated: true,
  })
  async qrCodeRechargeExchange(params?: any, options?: any) {
    return this.post('qrCodeRechargeExchange', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-资金账户',
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

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-资金账户',
    action: '统计',
  })
  async stat(params?: any, options?: any) {
    return this.get('stat', {
      ...options,
      params,
    });
  }
}

export const fundAccountService = new FundAccountService();
