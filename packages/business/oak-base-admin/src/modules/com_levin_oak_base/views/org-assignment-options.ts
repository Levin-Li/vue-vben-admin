import type { SelectOption } from '@levin/admin-framework';

import { matchesPinyinFuzzySearch } from '@levin/admin-framework';
import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';

import { buildModuleOptionsLoader } from './api-module';

// 新建主档只允许选择内部父级；外部组织节点由业务服务创建。
const internalOrgTypes = [
  'Company',
  'Branch',
  'Department',
  'Team',
  'Group',
  'TempOrg',
] as const;
const internalOrgTypeSet = new Set<string>(internalOrgTypes);

export function buildOrgAssignmentOptionsLoader(tenantId?: string) {
  if (tenantId) {
    return async (keyword?: string) => {
      // 授权组织投影保留可信租户归属，递归展开后仅展示正常启用的内部节点。
      const tree = await rbacService.fetchAuthorizedOrgTreeByTenant(tenantId);
      const options: SelectOption[] = [];
      const visit = (nodes: Record<string, any>[]) => {
        for (const node of nodes) {
          if (Array.isArray(node.children)) visit(node.children);
          const id = String(node.id || '');
          const name = String(node.name || '');
          if (
            id &&
            name &&
            node.tenantId === tenantId &&
            node.enable === true &&
            node.state === 'Normal' &&
            internalOrgTypeSet.has(String(node.type)) &&
            (!keyword || matchesPinyinFuzzySearch(keyword, name))
          ) {
            options.push({ ...node, label: `内部父组织 · ${name}`, value: id });
          }
        }
      };
      visit(Array.isArray(tree) ? tree : []);
      return options;
    };
  }
  const firstPage = buildModuleOptionsLoader(
    '/Org/list',
    'name',
    'id',
    {
      pageIndex: 1,
      pageSize: 500,
      inType: [...internalOrgTypes],
      ...(tenantId ? { tenantId } : {}),
    },
    'containsName',
  );
  return async (keyword?: string) => {
    // 选择器在本地搜索，逐页读取完整候选，避免只显示前 500 条。
    const options: Awaited<
      ReturnType<ReturnType<typeof buildModuleOptionsLoader>>
    > = [];
    const seen = new Set<string>();
    for (let pageIndex = 1; ; pageIndex++) {
      const loadPage =
        pageIndex === 1
          ? firstPage
          : buildModuleOptionsLoader(
              '/Org/list',
              'name',
              'id',
              {
                pageIndex,
                pageSize: 500,
                inType: [...internalOrgTypes],
                ...(tenantId ? { tenantId } : {}),
              },
              'containsName',
            );
      const page = await loadPage(keyword);
      if (page.length === 0) break;
      let added = 0;
      for (const option of page) {
        const id = String(option.value);
        if (!seen.has(id)) {
          seen.add(id);
          options.push(option);
          added++;
        }
      }
      // 后端若忽略页码，不得陷入无限循环或把不完整列表当作成功。
      if (added === 0) throw new Error('组织候选分页未前进');
    }
    return options
      .filter(
        (option) =>
          internalOrgTypeSet.has(String(option.type)) &&
          (!tenantId || String(option.tenantId || '') === tenantId),
      )
      .map((option) => ({
        ...option,
        label: `内部父组织 · ${option.label}`,
      }));
  };
}
