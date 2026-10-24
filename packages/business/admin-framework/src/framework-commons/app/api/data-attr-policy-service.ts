import type { DataAttrTarget } from '../../data-attr-policy';

import { ResAuthorize, Service } from '../../api-authorize';
import { readDataAttrLocalPolicies } from '../../data-attr-policy';
import { RequestService } from '../../request-service';

@Service({
  basePath: '/com.levin.oak.base/V1/api/rbac',
  controllerClass: 'com.levin.oak.base.web.dataattr.DataAttrPolicyController',
  description: '当前用户API字段策略',
  title: 'API字段策略',
  type: 'API字段策略',
})
/** @deprecated 使用 API 静态契约与登录许可；旧方法仅提供本地读取兼容。 */
export class DataAttrPolicyService extends RequestService {
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: 'API字段策略',
    action: '读取API字段策略',
    onlyRequireAuthenticated: true,
  })
  async resolve(query: DataAttrTarget | { operation: string }) {
    return readDataAttrLocalPolicies(query);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: 'API字段策略',
    action: '读取API字段策略',
    onlyRequireAuthenticated: true,
  })
  async snapshot() {
    return readDataAttrLocalPolicies();
  }
}
export const dataAttrPolicyService = new DataAttrPolicyService();
