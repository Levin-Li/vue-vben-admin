import { requestClient } from './runtime';

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
