import { requestClient } from './request';

export async function fetchAuthorizedOrgTree() {
  return requestClient.get<any[]>('/rbac/authorizedOrgList', {
    params: {
      assembleTree: true,
    },
  });
}

export async function fetchAuthorizedResourceModules() {
  return requestClient.get<any[]>('/rbac/authorizedResList', {
    params: {
      isShowSysDefaultRes: false,
    },
  });
}
