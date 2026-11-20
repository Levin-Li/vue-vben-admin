import type {
  DataPermissionLoadedTarget,
  DataPermissionScopeField,
  DataPermissionSubjectType,
} from '@levin/admin-framework/framework-commons/shared/data-permission-types';

import { roleService } from './api/role-service';
import { userService } from './api/user-service';

const scopeFields: DataPermissionScopeField[] = [
  'domainScopeList',
  'deniedDomainScopeList',
  'tenantScopeList',
  'deniedTenantScopeList',
  'orgScopeList',
  'deniedOrgScopeList',
];

// 角色、用户的目标属性在此归一化，公共弹窗不接收列表行或目标接口路径。
export function createDataPermissionCallbacks(
  record: Record<string, any>,
  type: DataPermissionSubjectType,
  getRoleRecords: () => Array<Record<string, any>> = () => [],
) {
  const id = String(record.id);
  return {
    loadTarget: async (): Promise<DataPermissionLoadedTarget> => {
      const detail = (
        type === 'user'
          ? await userService.retrieve({ id })
          : await roleService.retrieve({ id })
      ) as Record<string, any>;
      const normalizedDetail: Record<string, any> = {
        code: detail.code,
        id: String(detail.id ?? id),
        loginName: detail.loginName,
        name: detail.name,
        optimisticLock: detail.optimisticLock,
        org: detail.org,
        orgName: detail.orgName,
      };
      for (const field of scopeFields) normalizedDetail[field] = detail[field];
      const inheritedScopes: DataPermissionLoadedTarget['inheritedScopes'] = {};
      if (type === 'user') {
        const source = { ...record, ...detail };
        const codes = new Set(
          (Array.isArray(source.roleList) ? source.roleList : []).map(String),
        );
        const tenantId = source.tenantId && String(source.tenantId);
        const roles = getRoleRecords().filter(
          (role) =>
            codes.has(String(role.code)) &&
            (!role.tenantId || String(role.tenantId) === tenantId),
        );
        for (const field of scopeFields)
          inheritedScopes[field] = [
            ...new Set(
              roles.flatMap((role) =>
                Array.isArray(role[field]) ? role[field].map(String) : [],
              ),
            ),
          ];
      }
      return {
        canInherit: type === 'user',
        detail: normalizedDetail,
        inheritedScopes,
        label: type === 'user' ? '用户' : '角色',
      };
    },
    saveTarget: async (changes: Record<string, any>) =>
      (type === 'user'
        ? userService.update(changes)
        : roleService.update(changes)) as Promise<Record<string, any>>,
  };
}
