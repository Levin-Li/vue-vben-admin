import { oakBaseGet } from './_module';

/** 对应后端 com.levin.oak.base.web.controller.rbac.RbacController。 */
export interface AuthorizedPlatformDomainOption {
  id: string;
  name: string;
}

/** 读取当前登录用户可访问的平台领域候选，而非平台领域管理 CRUD 列表。 */
export async function loadAuthorizedPlatformDomainList(params?: {
  keyword?: string;
  typePrefix?: string;
}): Promise<AuthorizedPlatformDomainOption[]> {
  return oakBaseGet('/rbac/authorizedPlatformDomainList', { params });
}
