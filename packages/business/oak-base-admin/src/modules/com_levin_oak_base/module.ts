import type { AdminFrontendModule } from '@levin/admin-framework';

import type { RouteRecordRaw } from 'vue-router';

import type { CreateOakBaseAdminCrudRoutesOptions } from './admin-crud';

import {
  addLayoutHeaderExtensionAreaItem,
  addUserDropdownMenuItem,
  registerAdminAgentModelTransport,
  registerAdminAgentSkills,
} from '@levin/admin-framework';

import { packageVersion } from '../../../package-version.mjs';
import { createOakBaseAdminCrudRoutes } from './admin-crud';
import { adminAgentSkills } from './agent-admin-skills';
import { contentAgentSkills } from './agent-content-skills';
import { customerAgentSkills } from './agent-customer-skills';
import { financeAgentSkills } from './agent-finance-skills';
import { messageAgentSkills } from './agent-message-skills';
import { oakBaseAgentSkills } from './agent-skills';
import { workflowAgentSkills } from './agent-workflow-skills';
import { OAK_BASE_API_MODULE, OAK_BASE_MODULE_NAME } from './api-module';
import { oakBrowserAgentTransport } from './api/ai-browser-agent-service';
import { oakBaseAdminBackendRouteMappings } from './backend-route-mappings';
import GlobalPlatformDomainSelector from './global-platform-domain-selector.vue';
import { oakBaseAdminLocales } from './locales';
import { oakBaseAdminPageMap } from './page-map';
import { oakBaseQueryConfigLoaders } from './query-config-loaders';
import {
  aclTestRoute,
  helpCenterRoute,
  namedScopeVariableAcceptanceRoute,
  oakBaseAdminHomeRoute,
  oakBaseAdminRoutes,
} from './routes';

export interface CreateOakBaseAdminModuleOptions {
  crud?: CreateOakBaseAdminCrudRoutesOptions | false;
}

export function createOakBaseAdminModule(
  options: CreateOakBaseAdminModuleOptions = {},
): AdminFrontendModule {
  const routes =
    options.crud === false
      ? oakBaseAdminRoutes
      : withOakBaseAdminHomeRoute(
          createOakBaseAdminCrudRoutes(options.crud || {}),
        );

  return {
    apiModuleBase: OAK_BASE_API_MODULE,
    backendRouteMappings: oakBaseAdminBackendRouteMappings,
    locales: oakBaseAdminLocales,
    name: OAK_BASE_MODULE_NAME,
    order: 100,
    packageInfo: packageVersion,
    pageMap: oakBaseAdminPageMap,
    queryConfigLoaders: oakBaseQueryConfigLoaders,
    routes,
    setup: (context) => {
      // 仅将本模块审核过的业务接口登记为 Agent 技能。
      registerAdminAgentSkills(OAK_BASE_MODULE_NAME, [
        ...oakBaseAgentSkills,
        ...customerAgentSkills,
        ...financeAgentSkills,
        ...contentAgentSkills,
        ...workflowAgentSkills,
        ...messageAgentSkills,
        ...adminAgentSkills,
      ]);
      // 网页 Agent 读取独立网页配置后，由浏览器直接请求模型端点。
      registerAdminAgentModelTransport(oakBrowserAgentTransport);
      // 模块初始化不处于 Vue 组件生命周期，使用应用级注册避免错误绑定自动卸载钩子。
      addLayoutHeaderExtensionAreaItem('center', {
        component: GlobalPlatformDomainSelector,
        id: 'global-platform-domain-selector',
        order: 30,
      });
      // 文档中心与个人设置同处用户下拉菜单，点击后保留当前单页应用会话。
      addUserDropdownMenuItem({
        handler: async () => {
          await context.router.push('/clob/V1/HelpCenter');
        },
        icon: 'lucide:book-open',
        id: 'help-center',
        order: 110,
        text: '文档中心',
      });
    },
    title: '基础模块',
    version: packageVersion.version,
  };
}

function withOakBaseAdminHomeRoute(routes: RouteRecordRaw[]) {
  return routes.map((route, index) =>
    index === 0
      ? {
          ...route,
          children: [
            oakBaseAdminHomeRoute,
            ...(route.children || []).map((child) => {
              if (child.meta?.title === '开发&工具') {
                return {
                  ...child,
                  children: [
                    ...(child.children || []),
                    aclTestRoute,
                    namedScopeVariableAcceptanceRoute,
                  ],
                };
              }
              if (child.meta?.title === '个人&中心') {
                return {
                  ...child,
                  children: [...(child.children || []), helpCenterRoute],
                };
              }
              return child;
            }),
          ],
        }
      : route,
  );
}

export const oakBaseAdminModule: AdminFrontendModule =
  createOakBaseAdminModule();
