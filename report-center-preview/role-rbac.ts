let token = '';
let header = '';

export function setRoleFixtureSession(name: string, value: string) {
  header = name;
  token = value;
}

export const rbacService = {
  async fetchAuthorizedPermissionTree() {
    const response = await fetch('/isolated-api/com.levin.oak.base/V1/api/fixture/tree', {
      headers: { [header]: token }, credentials: 'omit',
    });
    if (!response.ok) throw new Error('隔离权限树不可用');
    return (await response.json()).data;
  },
  async fetchAuthorizedResourceModules() { return []; },
  async getAuthorizedMenuList() { return []; },
};
