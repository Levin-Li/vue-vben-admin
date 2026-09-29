import { buildMenuRoutes } from '@levin/admin-framework/framework-commons/app/api/core/menu-route';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { describe, expect, it } from 'vitest';

import { workflowRequestService } from '../api/workflow-request-service';
import { workflowRuntimeService } from '../api/workflow-runtime-service';
import { oakBaseAdminBackendRouteMappings } from '../backend-route-mappings';

const mappings = oakBaseAdminBackendRouteMappings.filter((item) =>
  ['MyWorkflow', 'WorkflowRequest'].includes(item.resource),
);

describe('工作流页面严格消费后端授权菜单', () => {
  it('只有本地页面映射而没有授权菜单时仍返回403组件', () => {
    const routes = buildMenuRoutes([], mappings);
    expect(routes).toHaveLength(2);
    for (const route of routes) {
      expect(route.component).toBe('/_core/fallback/forbidden.vue');
      expect(route.meta?.menuRouteForbidden).toBe(true);
    }
    expect(
      mappings.every((mapping) => mapping.onlyRequireAuthenticated !== true),
    ).toBe(true);
  });

  it('注册菜单存在时绑定真实业务页面并保留实际查询权限', () => {
    const permissions = {
      WorkflowRequest: buildApiMethodPermissions(
        workflowRequestService,
        'list',
      ),
      MyWorkflow: buildApiMethodPermissions(workflowRuntimeService, 'todo'),
    };
    const menus = mappings.map((mapping) => ({
      id: `menu-${mapping.resource}`,
      name: mapping.name,
      label: mapping.title,
      path: mapping.path,
      enable: true,
      pageType: 'LocalPage',
      requireAuthorizations:
        permissions[mapping.resource as keyof typeof permissions],
    }));
    const routes = buildMenuRoutes(menus, mappings);
    expect(routes).toHaveLength(2);
    for (const mapping of mappings) {
      const route = routes.find((item) => item.path === mapping.path);
      expect(route?.component).toBe(mapping.viewPath);
      expect(route?.meta?.authority).toEqual(
        permissions[mapping.resource as keyof typeof permissions],
      );
      expect(route?.meta?.menuRouteForbidden).not.toBe(true);
      expect(route?.name).toBe(mapping.path.replaceAll('/', '_'));
    }
  });
});
