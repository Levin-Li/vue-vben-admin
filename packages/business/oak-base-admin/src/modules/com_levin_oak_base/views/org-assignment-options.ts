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

export function buildOrgAssignmentOptionsLoader() {
  const loadOrgs = buildModuleOptionsLoader(
    '/Org/list',
    'name',
    'id',
    { pageIndex: 1, pageSize: 500, inType: [...internalOrgTypes] },
    'containsName',
  );
  return async (keyword?: string) => {
    const options = await loadOrgs(keyword);
    return options
      .filter((option) => internalOrgTypeSet.has(String(option.type)))
      .map((option) => ({
        ...option,
        label: `内部父组织 · ${option.label}`,
      }));
  };
}
