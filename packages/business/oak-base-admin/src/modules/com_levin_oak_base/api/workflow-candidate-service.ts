import type { WorkflowCandidate } from '@levin/bpm-designer';

import { rbacService } from '@levin/admin-framework';

import { roleService } from './role-service';
import { userService } from './user-service';

/** 复用 User、Role 与 RbacController 的已有授权范围，不建立第二套身份目录。 */
export async function loadWorkflowCandidates(
  keyword = '',
): Promise<{ groups: WorkflowCandidate[]; users: WorkflowCandidate[] }> {
  const [users, roles, orgs] = await Promise.all([
    userService.list({
      containsName: keyword || undefined,
      enable: true,
      pageIndex: 1,
      pageSize: 200,
    }),
    roleService.listUserRoleCode({
      containsName: keyword || undefined,
      codeForKey: false,
      pageIndex: 1,
      pageSize: 200,
    }),
    rbacService.fetchAuthorizedOrgOptions({ assembleTree: false }),
  ]);

  // 每个目录的值字段按对应接口约定读取，前缀与工作流 RBAC 桥接保持一致。
  return {
    users: (
      (users as { items?: { id: string; name: string }[] }).items ?? []
    ).map((item) => ({ id: item.id, label: item.name, kind: 'user' })),
    groups: [
      ...(Array.isArray(roles)
        ? roles
        : ((roles as { items?: { label: string; value: string }[] }).items ??
          [])
      ).map((item: { label: string; value: string }) => ({
        id: String(item.value),
        label: item.label,
        value: `role:${item.value}`,
        kind: 'role' as const,
      })),
      ...orgs.map((item) => ({
        id: String(item.value),
        label: item.label,
        value: `org:${item.value}`,
        kind: 'org' as const,
      })),
    ],
  };
}
