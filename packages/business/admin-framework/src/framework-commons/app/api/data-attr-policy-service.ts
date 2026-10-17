import type { DataAttrPolicies, DataAttrTarget } from '../../data-attr-policy';

import { ResAuthorize, Service } from '../../api-authorize';
import { DATA_ATTR_POLICY_PATH } from '../../data-attr-policy';
import { RequestService } from '../../request-service';
import { requestClient } from './request';

@Service({
  basePath: '/com.levin.oak.base/V1/api/rbac',
  controllerClass: 'com.levin.oak.base.web.dataattr.DataAttrPolicyController',
  description: '当前用户API字段策略',
  title: 'API字段策略',
  type: 'API字段策略',
})
export class DataAttrPolicyService extends RequestService {
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: 'API字段策略',
    action: '读取API字段策略',
    onlyRequireAuthenticated: true,
  })
  async resolve(query: DataAttrTarget | { operation: string }) {
    // 只由固定策略入口读取，不递归经过业务代理；底层安全链仍负责签名与加密。
    return requestClient.post<DataAttrPolicies>(DATA_ATTR_POLICY_PATH, query, {
      baseURL: '',
    });
  }
}
export const dataAttrPolicyService = new DataAttrPolicyService();
