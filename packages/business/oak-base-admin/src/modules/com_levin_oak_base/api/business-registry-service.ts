import { RequestService, ResAuthorize, Service } from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

export interface BusinessRegistryCandidate {
  creditCode?: string;
  name: string;
  providerCode: string;
  status?: string;
}

export interface BusinessRegistrySearchPage {
  items: BusinessRegistryCandidate[];
}

export interface BusinessRegistryLookupResult {
  info?: {
    creditCode?: string;
    name?: string;
    providerCode?: string;
  };
  matchResult?: string;
}

// 工商查询仅用于辅助录入；名称输入防抖搜索，详情由用户选定候选后调用。
@Service({
  basePath: '/BusinessRegistry/use',
  controllerClass:
    'com.levin.oak.base.controller.BizBusinessRegistryController',
  title: '工商信息查询',
  type: '业务数据-工商信息查询',
})
export class BusinessRegistryService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-工商信息查询',
    action: '查询工商资料',
  })
  lookup(name: string, creditCode?: string) {
    return this.post<BusinessRegistryLookupResult>('lookup', {
      data: { name, creditCode, providerCode: 'qichacha' },
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-工商信息查询',
    action: '搜索工商主体候选',
  })
  search(keyword: string) {
    return this.post<BusinessRegistrySearchPage>('search', {
      data: { keyword, pageIndex: 1, providerCode: 'qichacha' },
    });
  }
}

export const businessRegistryService = new BusinessRegistryService();
