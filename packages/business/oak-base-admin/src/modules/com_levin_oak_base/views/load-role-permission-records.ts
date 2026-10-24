import { roleService } from '../api/role-service';

/** 仅用于列表角标回显；接口不可访问时不推断用户的继承规则。 */
export async function loadRolePermissionRecords() {
  const records: Array<Record<string, any>> = [];
  const pageSize = 500;
  for (let pageIndex = 1; pageIndex <= 20; pageIndex++) {
    const response: any = await roleService.list({ pageIndex, pageSize });
    const items = response?.items || response?.records || response;
    if (!Array.isArray(items)) break;
    records.push(...items);
    if (items.length < pageSize) break;
  }
  return records;
}
