import { buildModuleSyncMenuPayload } from '@levin/admin-framework/framework-commons/app/utils/sync-menu-routes';
import { describe, expect, it } from 'vitest';

import {
  createOakBaseAdminCrudRoutes,
  oakBaseAdminCrudResources,
  oakBaseAdminModule,
} from '../src/modules/com_levin_oak_base';
import { oakBaseAdminBackendRouteMappings } from '../src/modules/com_levin_oak_base/backend-route-mappings';

function flattenCrudRoutes(children: any[] | undefined): any[] {
  return (children || []).flatMap((route) => {
    if (Array.isArray(route?.children) && route.children.length > 0) {
      return flattenCrudRoutes(route.children);
    }

    return route?.meta?.crudResource ? [route] : [];
  });
}

function findMenuByPath(items: any[] | undefined, path: string): any {
  for (const item of items || []) {
    if (item?.path === path) {
      return item;
    }

    const nested = findMenuByPath(item?.children, path);

    if (nested) {
      return nested;
    }
  }

  return undefined;
}

describe('oak base admin crud resources', () => {
  it('stores page metadata in CRUD route mappings while deriving route names from paths', () => {
    expect(
      oakBaseAdminBackendRouteMappings.every(
        (mapping) =>
          Boolean(mapping.name) &&
          Boolean(mapping.title) &&
          Boolean(mapping.description),
      ),
    ).toBe(true);

    const [rootRoute] = createOakBaseAdminCrudRoutes();
    expect(rootRoute?.name).toBe(String(rootRoute?.path).replaceAll('/', '_'));
    const crudRoutes = flattenCrudRoutes(rootRoute?.children);
    expect(
      crudRoutes.every(
        ({ name, path }) =>
          path === '' || String(name) === String(path).replaceAll('/', '_'),
      ),
    ).toBe(true);
  });

  it('uploads page name, title and description from page metadata', () => {
    const payload = buildModuleSyncMenuPayload([oakBaseAdminModule]);
    const roleMenu = findMenuByPath(payload.menuList, '/clob/V1/Role');

    expect(roleMenu).toEqual(
      expect.objectContaining({
        label: '角色管理',
        name: 'Role',
        remark: '维护角色、资源权限和组织数据权限。',
      }),
    );
  });

  it('uses the current rbac permission item page instead of the removed permission page', () => {
    expect(oakBaseAdminCrudResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resource: 'RbacPermissionItem',
          title: '权限项定义',
        }),
      ]),
    );
    expect(
      oakBaseAdminCrudResources.some((item) => item.resource === 'Permission'),
    ).toBe(false);
    expect(
      oakBaseAdminBackendRouteMappings.some(
        (item) => item.path === '/clob/V1/Permission',
      ),
    ).toBe(false);
  });

  it('uses the backend generated local page path for the crud root route', () => {
    const [rootRoute] = createOakBaseAdminCrudRoutes();
    const homeMapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.path === '/clob/V1/index',
    );
    const crudRoutes = flattenCrudRoutes(rootRoute?.children);

    expect(rootRoute).toEqual(
      expect.objectContaining({
        name: '_clob_V1_index',
        path: '/clob/V1/index',
      }),
    );
    expect(crudRoutes).toHaveLength(oakBaseAdminCrudResources.length);
    expect(homeMapping).toEqual(
      expect.objectContaining({
        resource: 'AdminHome',
        sourceFilePath: 'modules/com_levin_oak_base/views/home/index.vue',
        viewPath: '/system/com_levin_oak_base/home/index.vue',
      }),
    );
  });

  it('keeps resource-specific menu icons in generated routes and backend mappings', () => {
    const [rootRoute] = createOakBaseAdminCrudRoutes();
    const crudRoutes = flattenCrudRoutes(rootRoute?.children);
    const clientAppRoute = crudRoutes.find(
      (item) => item.path === '/clob/V1/ClientApp',
    );
    const articleRoute = crudRoutes.find(
      (item) => item.path === '/clob/V1/Article',
    );
    const clientAppMapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.path === '/clob/V1/ClientApp',
    );
    const articleMapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.path === '/clob/V1/Article',
    );
    const crudIcons = oakBaseAdminCrudResources.map((item) => item.icon);

    expect(clientAppRoute?.meta?.icon).toBe('lucide:app-window');
    expect(articleRoute?.meta?.icon).toBe('lucide:file-text');
    expect(clientAppMapping?.icon).toBe('lucide:app-window');
    expect(articleMapping?.icon).toBe('lucide:file-text');
    expect(new Set(crudIcons).size).toBeGreaterThan(10);
  });

  it('does not expose the data permission preview page for menu route upload', () => {
    const payload = buildModuleSyncMenuPayload([oakBaseAdminModule]);

    expect(
      oakBaseAdminBackendRouteMappings.some(
        (item) =>
          item.path === '/system/com_levin_oak_base/data-permission-preview',
      ),
    ).toBe(false);
    expect(
      oakBaseAdminBackendRouteMappings.some(
        (item) => item.resource === 'DataPermissionPreview',
      ),
    ).toBe(false);
    expect(JSON.stringify(payload.menuList)).not.toContain(
      '/system/com_levin_oak_base/data-permission-preview',
    );
  });

  it('registers the online code generation controller as a local CRUD page', () => {
    const [rootRoute] = createOakBaseAdminCrudRoutes();
    const onlineCodeGenRoute = flattenCrudRoutes(rootRoute?.children).find(
      (item) => item.path === '/clob/V1/OnlineCodeGen',
    );
    const onlineCodeGenMapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.path === '/clob/V1/OnlineCodeGen',
    );

    expect(onlineCodeGenRoute).toEqual(
      expect.objectContaining({
        name: '_clob_V1_OnlineCodeGen',
        path: '/clob/V1/OnlineCodeGen',
      }),
    );
    expect(onlineCodeGenRoute?.meta).toEqual(
      expect.objectContaining({
        crudResource: 'OnlineCodeGen',
        icon: 'lucide:code-xml',
        title: '在线代码生成',
      }),
    );
    expect(onlineCodeGenMapping).toEqual(
      expect.objectContaining({
        resource: 'OnlineCodeGen',
        sourceFilePath:
          'modules/com_levin_oak_base/views/online-code-gen/index.vue',
        viewPath: '/system/com_levin_oak_base/online-code-gen/index.vue',
      }),
    );
  });

  it('registers import export templates under the CRUD root menu', () => {
    const [rootRoute] = createOakBaseAdminCrudRoutes();
    const templateRoute = flattenCrudRoutes(rootRoute?.children).find(
      (item) => item.path === '/clob/V1/ImportExportTemplate',
    );
    const templateMapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.path === '/clob/V1/ImportExportTemplate',
    );
    const payload = buildModuleSyncMenuPayload([oakBaseAdminModule]);
    const rootMenu = payload.menuList.find(
      (item) => item.path === '/clob/V1/index',
    );
    const templateMenu = findMenuByPath(
      rootMenu?.children,
      '/clob/V1/ImportExportTemplate',
    );

    expect(templateRoute).toEqual(
      expect.objectContaining({
        name: '_clob_V1_ImportExportTemplate',
        path: '/clob/V1/ImportExportTemplate',
      }),
    );
    expect(templateRoute?.meta).toEqual(
      expect.objectContaining({
        crudResource: 'ImportExportTemplate',
        icon: 'lucide:file-spreadsheet',
        title: '导入导出模板',
      }),
    );
    expect(templateMapping).toEqual(
      expect.objectContaining({
        resource: 'ImportExportTemplate',
        sourceFilePath:
          'modules/com_levin_oak_base/views/import-export-template/index.vue',
        viewPath: '/system/com_levin_oak_base/import-export-template/index.vue',
      }),
    );
    expect(templateMenu).toEqual(
      expect.objectContaining({
        label: '导入导出模板',
        path: '/clob/V1/ImportExportTemplate',
      }),
    );
    expect(
      payload.menuList.some(
        (item) => item.path === '/clob/V1/ImportExportTemplate',
      ),
    ).toBe(false);
  });

  it('maps electronic contract resources to their full domain page directories', () => {
    const contractMapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.resource === 'EContract',
    );
    const templateMapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.resource === 'EContractTemplate',
    );

    expect(contractMapping).toEqual(
      expect.objectContaining({
        sourceFilePath:
          'modules/com_levin_oak_base/views/electronic-contract/index.vue',
        viewPath: '/system/com_levin_oak_base/electronic-contract/index.vue',
      }),
    );
    expect(templateMapping).toEqual(
      expect.objectContaining({
        sourceFilePath:
          'modules/com_levin_oak_base/views/electronic-contract-template/index.vue',
        viewPath:
          '/system/com_levin_oak_base/electronic-contract-template/index.vue',
      }),
    );
  });
});
