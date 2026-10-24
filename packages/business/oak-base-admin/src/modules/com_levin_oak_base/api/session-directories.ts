import type { WorkflowBusinessType } from '@levin/bpm-designer';

import { registerAdminSessionInitializer } from '@levin/admin-framework/framework-commons/app/session-resources';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { workflowRuntimeService } from './workflow-runtime-service';

// 工作流能力目录只在登录初始化时读取，所有业务页消费同一会话快照。
let catalog: WorkflowBusinessType[] = [];
let pending: Promise<void> | undefined;
let generation = 0;

export function registerOakSessionDirectories() {
  return registerAdminSessionInitializer('oak-workflow-catalog', {
    clear: () => {
      ++generation;
      catalog = [];
      pending = undefined;
    },
    load: async () => {
      const { hasPermission } = useRbacAccess();
      if (
        !hasPermission(
          buildApiMethodPermissions(workflowRuntimeService, 'catalog'),
        )
      )
        return;
      const request = generation;
      pending = workflowRuntimeService.catalog().then(
        (result) => {
          if (request === generation) catalog = result;
        },
        () => {
          // 缺少工作流或目录不可用时保留空目录，不让每个业务页重试。
          if (request === generation) catalog = [];
        },
      );
      await pending;
    },
  });
}

export async function getSessionWorkflowCatalog() {
  const request = generation;
  await pending;
  return request === generation ? catalog : [];
}
