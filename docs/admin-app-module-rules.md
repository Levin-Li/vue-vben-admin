# 前端模块化接入规则

本文档是可复制版本。新项目可以把本文件复制到自己的前端项目中，作为后台前端模块化开发、接入、发布和排错规范。

适用场景：

```text
一个最终后台系统
  = 公共后台框架 @levin/admin-framework
  + 基础模块 @levin/oak-base-admin
  + 当前项目自己的一个或多个业务模块
```

核心原则：

```text
最终项目只做装配和覆盖，不复制公共框架源码，不复制基础模块源码。
公共能力通过 NPM 私服包引入。
业务模块独立开发、独立构建、独立发布。
菜单、权限和可见性以后端返回为准。
```

## 一、项目分层

前端固定分三层。

### 1. 公共框架包

包名：

```text
@levin/admin-framework
```

职责：

- 应用启动和挂载。
- 登录、布局、路由守卫。
- 后端菜单同步。
- RBAC 权限判断。
- 通用 CRUD 页面。
- 通用表格、表单、弹窗、权限组件。
- 页面注册、页面覆盖、模块注册、国际化合并。

最终项目不能复制这些代码。如果框架公共能力不够，应回到 `@levin/admin-framework` 中扩展后重新发布。

### 2. 基础模块包

包名：

```text
@levin/oak-base-admin
```

职责：

- 基础模块 API。
- 基础模块页面。
- 基础模块菜单路径映射。
- 基础模块路由。
- 基础模块国际化。

最终系统通常必须接入这个模块。

### 3. 项目业务模块包

包名示例：

```text
@project/contract-admin
@project/finance-admin
@project/customer-admin
```

职责：

- 当前项目自己的业务 API。
- 当前项目自己的业务页面。
- 当前业务模块自己的国际化。
- 当前业务模块自己的后端菜单路径映射。

业务模块可以和最终项目在同一个仓库，也可以在独立 Git 仓库。正式集成必须通过 NPM 私服版本号。

### 4. 最终主应用

包名示例：

```text
@project/admin
```

职责：

- 安装 `@levin/admin-framework`。
- 安装 `@levin/oak-base-admin`。
- 安装当前项目自己的业务模块包。
- 声明启用哪些模块。
- 配置后端地址、项目名称、主题、偏好。
- 按需覆盖框架或模块页面。
- 构建最终可部署产物。

最终主应用就是入口应用，是一个薄应用，只负责启动、引导、装配和覆盖，通常不包含业务相关代码。

## 二、目录规划

目录规划必须先区分“可复用包”和“最终应用”。不要把框架代码、基础模块代码、业务模块代码和最终应用入口混在同一个 `src` 目录下。

### 目录命名约定

统一命名如下：

```text
admin           前端后台工作区目录
bootstrap-app   启动装配应用
```

含义：

- `admin` 表示“后台前端工作区”，里面可以包含 `packages`、`apps`、`docs`、发布脚本等。
- `bootstrap-app` 表示“启动装配应用”，只负责启动框架、启用模块、注入配置、覆盖页面、构建最终产物。

### 模块工作区目录

如果当前仓库既维护基础模块，又维护项目业务模块，推荐使用完整工作区模式：

```text
frontend/
  admin/                                  # 后台前端工作区
    packages/                             # 可发布、可复用的 NPM 包
      business/                           # 后台业务类可复用包
        admin-framework/                  # 公共后台框架包
        oak-base-admin/                   # 基础模块包
        contract-admin/                   # 项目业务模块包示例
        finance-admin/                    # 项目业务模块包示例
      @core/                              # Vben 基础能力包
      effects/                            # Vben 运行时能力包
    apps/                                 # 最终应用或示例应用
      bootstrap-app/                      # 启动装配应用
    npm-packages/                         # 本地 pack 产物目录
```

规则：

- `packages` 只放可复用、可构建、可发布到 NPM 私服的包。
- `packages/business` 只放后台框架包和后台业务模块包。
- `apps/bootstrap-app` 只做启动装配应用入口。
- `npm-packages` 只放本地打包产物，不写源码。
- `dist`、`node_modules` 都是生成目录，不作为源码规划的一部分。

### 标准工作区总览

完整工作区推荐保持如下结构：

```text
<project-root>/
  frontend/
    admin/                                # 后台前端工作区
      packages/
        business/
          admin-framework/                # 公共后台框架包
          oak-base-admin/                 # 基础模块包
      apps/
        bootstrap-app/                    # 启动装配应用
      docs/
        admin-app-module-rules.md
        frontend-module-development-rules.md
        admin-modules-publish.md
```

规则：

- 完整工作区从 `frontend/admin` 进入。
- 本地开发调试启动 `apps/bootstrap-app`。
- 公共框架代码维护在 `packages/business/admin-framework`。
- 基础模块代码维护在 `packages/business/oak-base-admin`。
- 所有最终系统都使用 `apps/bootstrap-app` 作为入口应用。

### 1. 公共框架包目录

公共框架包固定放在：

```text
packages/business/admin-framework/
```

推荐结构：

```text
packages/business/admin-framework/
  src/
    index.ts                              # 框架包根导出
    framework-commons/                    # 框架公共代码唯一主目录
      index.ts
      runtime.ts
      request-service.ts
      page-map.ts
      page-registry.ts
      api.ts
      rbac.ts
      app/
        bootstrap.ts                      # 应用启动
        app.vue
        layouts/                          # 公共布局
        router/                           # 公共路由、守卫
        store/                            # 公共 store
        api/                              # 框架级 API 适配
        locales/                          # 框架级国际化
        styles/                           # 框架级样式
        shims/                            # 浏览器兼容 shim
      shared/                             # 通用业务组件
        crud-page.vue
        controller-crud-page.vue
        resource-permission-dialog.vue
      adapter/                            # 第三方 UI/表格适配
      utils/                              # 框架级工具
  build.config.ts
  package.json
  tsconfig.json
```

规则：

- 框架公共代码必须收敛到 `src/framework-commons`。
- `src/index.ts` 只做稳定公共导出。
- 不允许把具体业务模块页面放进 `admin-framework`。
- 不允许在框架包里写某个最终项目专用逻辑。

### 2. 基础模块包目录

基础模块包固定放在：

```text
packages/business/oak-base-admin/
```

推荐结构：

```text
packages/business/oak-base-admin/
  src/
    modules/
      com_levin_oak_base/                 # 后端包名 com.levin.oak.base 的前端目录
        index.ts                          # 模块入口导出
        module.ts                         # createOakBaseAdminModule
        routes.ts                         # 模块前端路由
        page-map.ts                       # 模块页面映射
        locales.ts                        # 模块国际化聚合
        backend-route-mappings.ts         # 后端菜单路径映射
        api-module.ts                     # API 模块常量
        admin-crud.ts                     # 当前模块 CRUD 路由生成
        api/                              # 当前模块 API
          index.ts
          role.ts
          menu.ts
          user.ts
        locales/                          # 当前模块国际化资源
          zh-CN.json
          en-US.json
        views/                            # 当前模块页面
          crud-page.vue
          tenant-site-capability.ts
  build.config.ts
  package.json
  tsconfig.json
```

规则：

- 基础模块源码必须放在 `src/modules/com_levin_oak_base` 下。
- 不允许把基础模块页面散放到包根 `src/views`。
- 不允许把基础模块 API 散放到包根 `src/api`。
- `api`、`locales`、`views` 必须属于具体模块目录。

### 3. 项目业务模块包目录

每个项目业务模块都按后端包名建立独立模块目录。

示例后端包名：

```text
com.project.contract
```

对应前端目录：

```text
packages/business/contract-admin/
  src/
    modules/
      com_project_contract/
        index.ts
        module.ts
        routes.ts
        page-map.ts
        locales.ts
        backend-route-mappings.ts
        api-module.ts
        api/
          index.ts
          contract.ts
          contract-template.ts
        locales/
          zh-CN.json
          en-US.json
        views/
          contract/
            index.vue
          contract-template/
            index.vue
  build.config.ts
  package.json
  tsconfig.json
```

命名规则：

```text
后端包名：com.project.contract
模块目录：com_project_contract
NPM 包名：@project/contract-admin
模块工厂：createContractAdminModule
```

多个业务模块示例：

```text
packages/business/
  admin-framework/
  oak-base-admin/
  contract-admin/
    src/modules/com_project_contract/
  finance-admin/
    src/modules/com_project_finance/
  customer-admin/
    src/modules/com_project_customer/
```

规则：

- 一个后端模块对应一个前端模块目录。
- 一个可独立发布的业务域对应一个 NPM 包。
- 模块内部必须自带 `api`、`views`、`locales`、`page-map`、`routes`。
- 禁止多个模块共用一个混杂的 `src/views`。

### 4. 最终主应用目录

最终主应用固定放在：

```text
apps/bootstrap-app/
```

`apps/bootstrap-app` 是入口应用，也是薄应用。它只负责启动框架、启用模块、注入配置、覆盖页面和构建最终产物；业务 API、业务页面、业务国际化和业务路由都必须放进对应业务模块包。

最终主应用推荐结构：

```text
apps/bootstrap-app/
  src/
    main.ts
    modules/
      list.ts
    pages/
      _core/
        authentication/
          login.vue
    preferences.ts
    shims/
  .env
  .env.development
  .env.production
  package.json
  vite.config.mts
  tailwind.config.mjs
  postcss.config.mjs
  tsconfig.json
```

说明：

- `src/main.ts`：应用启动入口。
- `src/modules/list.ts`：声明启用哪些模块。
- `src/pages`：只放当前项目覆盖页面。
- `src/preferences.ts`：当前项目偏好配置。
- `vite.config.mts`：最终主应用 Vite 配置。
- `tailwind.config.mjs`：必须扫描 NPM 包中的源码。
- `postcss.config.mjs`：必须显式使用当前项目 Tailwind 配置。
- 最终主应用不放基础模块源码，不放业务模块默认源码。
- 最终主应用通常不包含业务相关代码。

### 5. 最终项目组合目录示例

最终项目推荐按同一套工作区结构组织：

```text
compliance-accounting/
  backend/
  frontend/
    admin/                                # 后台前端工作区
      packages/
        business/
          admin-framework/                # 公共后台框架包
          oak-base-admin/                 # 基础模块包
          accounting-admin/               # 项目业务模块包
      apps/
        bootstrap-app/                    # 最终入口应用
          src/
            main.ts
            modules/
              list.ts                     # 启用 oak-base-admin + 项目业务模块
            pages/                        # 只放覆盖页面
            preferences.ts
          package.json
          vite.config.mts
          tailwind.config.mjs
          postcss.config.mjs
```

但正式集成时仍然要通过 NPM 私服版本号安装，不要让最终主应用长期依赖本地源码路径。

## 三、最终主应用 package.json 模板

```json
{
  "name": "@project/admin",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --mode development",
    "build": "vite build --mode production",
    "preview": "vite preview",
    "typecheck": "vue-tsc --noEmit --skipLibCheck"
  },
  "imports": {
    "#/*": "./src/*"
  },
  "dependencies": {
    "@levin/admin-framework": "5.6.6",
    "@levin/oak-base-admin": "5.6.6",
    "@project/contract-admin": "0.1.0",
    "@vben/access": "5.6.6",
    "@vben/common-ui": "5.6.6",
    "@vben/constants": "5.6.6",
    "@vben/hooks": "5.6.6",
    "@vben/icons": "5.6.6",
    "@vben/layouts": "5.6.6",
    "@vben/locales": "5.6.6",
    "@vben/plugins": "5.6.6",
    "@vben/preferences": "5.6.6",
    "@vben/request": "5.6.6",
    "@vben/stores": "5.6.6",
    "@vben/styles": "5.6.6",
    "@vben/types": "5.6.6",
    "@vben/utils": "5.6.6",
    "@vueuse/core": "^14.1.0",
    "ant-design-vue": "^4.2.6",
    "dayjs": "^1.11.19",
    "json-editor-vue": "0.18.1",
    "pinia": "^3.0.4",
    "vue": "^3.5.27",
    "vue-router": "^4.6.4"
  },
  "devDependencies": {
    "@iconify/tailwind": "^1.2.0",
    "@tailwindcss/typography": "^0.5.19",
    "@types/node": "^24.10.12",
    "@vitejs/plugin-vue": "^6.0.4",
    "@vitejs/plugin-vue-jsx": "^5.1.4",
    "autoprefixer": "^10.4.24",
    "cssnano": "^7.1.2",
    "less": "^4.5.1",
    "postcss": "^8.5.6",
    "postcss-antd-fixes": "^0.2.0",
    "postcss-import": "^16.1.1",
    "postcss-preset-env": "^10.6.1",
    "sass": "^1.97.3",
    "tailwindcss": "^3.4.19",
    "tailwindcss-animate": "^1.0.7",
    "typescript": "^5.9.3",
    "vite": "^7.3.1",
    "vue-tsc": "^3.2.4"
  },
  "engines": {
    "node": ">=20.19.0",
    "pnpm": ">=10.0.0"
  }
}
```

替换规则：

- 把 `@project/admin` 换成当前项目主应用包名。
- 把 `@project/contract-admin` 换成当前项目自己的业务模块包。
- 如果项目有多个业务模块，继续增加依赖。
- 版本号以 NPM 私服实际发布版本为准。

## 四、.npmrc 模板

安装依赖建议使用 NPM group 仓库。

```ini
registry=http://nexus.example.com/repository/npm-public/
always-auth=true
strict-peer-dependencies=false
auto-install-peers=true
dedupe-peer-dependents=true
```

禁止把 token、账号、密码提交到项目 `.npmrc`。

发布时使用环境变量：

```bash
export NPM_TOKEN=你的token
```

或者复用 Maven 凭证，见本文发布章节。

## 五、环境变量模板

`.env.development`：

```ini
VITE_APP_NAMESPACE=project-admin
VITE_APP_TITLE=项目后台
VITE_BACKEND_TARGET=http://127.0.0.1:8080
VITE_BASE=/
VITE_PORT=5667
```

`.env.production`：

```ini
VITE_APP_NAMESPACE=project-admin
VITE_APP_TITLE=项目后台
VITE_BACKEND_TARGET=
VITE_BASE=/
```

规则：

- `VITE_APP_NAMESPACE` 必须每个最终系统唯一。
- `VITE_BACKEND_TARGET` 只用于本地代理。
- 生产环境后端地址由部署网关或运行时配置处理。

## 六、src/modules/list.ts 模板

最终主应用通过这个文件声明启用哪些模块。

基础模块通常必须启用：

```ts
import type { AdminFrontendModule } from '@levin/admin-framework';

import { createOakBaseAdminModule } from '@levin/oak-base-admin';
import { createContractAdminModule } from '@project/contract-admin';
import { createFinanceAdminModule } from '@project/finance-admin';

export const enabledFrontendModules: AdminFrontendModule[] = [
  createOakBaseAdminModule(),
  createContractAdminModule(),
  createFinanceAdminModule(),
];
```

规则：

- 基础模块放在前面。
- 当前项目业务模块按业务顺序排列。
- 不要在主应用中手写业务路由列表。
- 不要在主应用中硬编码菜单。

## 七、src/main.ts 模板

```ts
import { initPreferences } from '@vben/preferences';
import { unmountGlobalLoading } from '@vben/utils';

import {
  configureAdminApplication,
  normalizeAdminGlobPageMap,
  type AdminPageMap,
} from '@levin/admin-framework';

import {
  menuService,
  noticeService,
  userService,
} from '@levin/oak-base-admin/modules/com_levin_oak_base/api/index';

import { enabledFrontendModules } from './modules/list';
import { overridesPreferences } from './preferences';

const pageOverrides = normalizeAdminGlobPageMap(
  import.meta.glob('./pages/**/*.vue') as AdminPageMap,
  './pages',
);

configureAdminApplication({
  menuSyncService: menuService,
  modules: enabledFrontendModules,
  noticeService,
  pageOverrides,
  userSecurityService: userService,
});

async function initApplication() {
  const env = import.meta.env.PROD ? 'prod' : 'dev';
  const appVersion = import.meta.env.VITE_APP_VERSION;
  const namespace = `${import.meta.env.VITE_APP_NAMESPACE}-${appVersion}-${env}`;

  await initPreferences({
    namespace,
    overrides: overridesPreferences,
  });

  const { bootstrap } =
    await import('@levin/admin-framework/framework-commons/app/bootstrap');

  await bootstrap(namespace);
  unmountGlobalLoading();
}

initApplication();
```

规则：

- `configureAdminApplication` 必须先执行。
- `pageOverrides` 用于主应用页面覆盖。
- `menuSyncService`、`userSecurityService`、`noticeService` 默认使用基础模块提供的后端服务。
- 如果当前项目有自己的用户、菜单或通知接口，可以在主应用中替换这些 service。

## 八、页面覆盖规则

所有页面都必须支持主应用覆盖。

页面解析优先级：

```text
主应用 src/pages 覆盖页
  > 业务模块包页面
  > admin-framework 默认页面
```

替换登录页：

```text
src/pages/_core/authentication/login.vue
```

替换某个业务页面：

```text
src/pages/system/com_project_contract/contract/index.vue
```

规则：

- 只覆盖需要差异化的页面。
- 不要把整个业务模块页面复制到主应用。
- 主应用没有覆盖页面时，自动使用模块包默认页面。

## 九、菜单规则

菜单必须以后端返回为准。

前端模块只提供：

```text
routes
pageMap
backendRouteMappings
```

这些信息用于把后端菜单路径解析成前端页面。

每个业务模块维护 `backendRouteMappings` 时，必须同时填充页面位置元数据：

- `sourcePath`：后端菜单或控制器路由路径。
- `targetPath`：前端运行时页面注册路径，例如 `/system/com_project_contract/contract/index.vue`。
- `sourceFile`：相对于前端源码目录的页面文件路径，例如 `modules/com_project_contract/views/contract/index.vue`。

新增其他业务模块、补充 CRUD 页面映射或新增非 CRUD 页面映射时，不得只填后端路径和页面注册路径，必须同步填充 `sourceFile`。超级管理员执行“上传页面路由”时会上传所有已启用模块的路由映射，并把 `targetPath` 作为页面注册路径、`sourceFile` 作为源码相对位置同步给后端菜单。

这里的“所有已启用模块”是硬性要求：不得只上传当前模块、默认模块或基础模块。`moduleId` 不作为后端接口必填项；但前端模块存在自己的模块 ID 时，上传时每个菜单项都必须带上该菜单所属模块的模块 ID，通常取 `AdminFrontendModule.name`。

禁止：

- 主应用硬编码左侧菜单。
- 前端用本地路由替代后端菜单。
- 每个业务模块自己维护一套独立菜单树。

排查菜单问题时按顺序检查：

```text
1. 后端菜单接口是否返回数据
2. 当前用户是否有菜单权限
3. menuSyncService 是否注入正确
4. backendRouteMappings 是否能匹配后端菜单路径
5. 上传列表是否包含所有已启用前端模块
6. 对存在模块 ID 的前端模块，每条菜单的 moduleId 是否等于所属前端模块自己的模块 ID
7. backendRouteMappings 是否填充 targetPath 和 sourceFile
8. pageMap 是否存在对应页面
```

## 十、Tailwind 配置模板

入口应用必须扫描 NPM 包中的源码和 pnpm 传递依赖目录，否则页面样式会缺失。

`tailwind.config.mjs` 至少包含：

```js
import { iconsPlugin } from '@iconify/tailwind';
import animate from 'tailwindcss-animate';

export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx,html}',
    './node_modules/@levin/**/*.{vue,js,ts,jsx,tsx,html}',
    './node_modules/@project/**/*.{vue,js,ts,jsx,tsx,html}',
    './node_modules/@vben/**/*.{vue,js,ts,jsx,tsx,html}',
    './node_modules/@vben-core/**/*.{vue,js,ts,jsx,tsx,html}',
    './node_modules/.pnpm/@levin+*/node_modules/@levin/**/*.{vue,js,ts,jsx,tsx,html}',
    './node_modules/.pnpm/@project+*/node_modules/@project/**/*.{vue,js,ts,jsx,tsx,html}',
    './node_modules/.pnpm/@vben+*/node_modules/@vben/**/*.{vue,js,ts,jsx,tsx,html}',
    './node_modules/.pnpm/@vben-core+*/node_modules/@vben-core/**/*.{vue,js,ts,jsx,tsx,html}',
  ],
  darkMode: 'selector',
  plugins: [
    animate,
    iconsPlugin({
      collections: ['ant-design', 'lucide', 'mdi'],
      prefix: 'i',
    }),
  ],
  theme: {
    extend: {
      animationDuration: {
        2000: '2000ms',
        3000: '3000ms',
      },
      boxShadow: {
        float: `0 6px 16px 0 rgb(0 0 0 / 8%),
          0 3px 6px -4px rgb(0 0 0 / 12%),
          0 9px 28px 8px rgb(0 0 0 / 5%)`,
      },
    },
  },
};
```

说明：

- `@levin` 是公共框架和基础模块范围。
- `@project` 是当前项目业务模块范围，按实际 scope 替换。
- `.pnpm` 扫描规则必须保留。
- 缺少 `.pnpm` 扫描时，常见表现是页签黑块、菜单样式错乱、图标颜色异常。

## 十一、PostCSS 配置模板

`postcss.config.mjs`：

```js
import tailwindConfig from './tailwind.config.mjs';

export default {
  plugins: {
    ...(process.env.NODE_ENV === 'production' ? { cssnano: {} } : {}),
    autoprefixer: {},
    'postcss-antd-fixes': { prefixes: ['ant', 'el'] },
    'postcss-import': {},
    'postcss-preset-env': {},
    tailwindcss: { config: tailwindConfig },
    'tailwindcss/nesting': {},
  },
};
```

规则：

- 必须显式传入 `tailwindConfig`。
- 不要只写 `tailwindcss: {}`。

## 十二、Vite 配置关键规则

入口应用需要避免 Vite 把源码型模块错误预构建。

关键配置：

```ts
optimizeDeps: {
  include: [
    'dayjs',
    'dayjs/plugin/timezone',
    'dayjs/plugin/utc',
    'vanilla-jsoneditor',
  ],
  exclude: [
    '@levin/admin-framework',
    '@levin/admin-framework/framework-commons',
    '@levin/admin-framework/framework-commons/app/bootstrap',
    '@levin/admin-framework/framework-commons/app/pages',
    '@levin/admin-framework/framework-commons/app/router/routes',
    '@levin/oak-base-admin',
    '@levin/oak-base-admin/modules/com_levin_oak_base',
    '@levin/oak-base-admin/modules/com_levin_oak_base/api/index',
    '@levin/oak-base-admin/modules/com_levin_oak_base/page-map',
    '@project/contract-admin',
    '@project/contract-admin/modules/com_project_contract',
    '@project/contract-admin/modules/com_project_contract/api/index',
    '@project/contract-admin/modules/com_project_contract/page-map',
  ],
}
```

规则：

- `@levin/admin-framework` 必须排除。
- `@levin/oak-base-admin` 必须排除。
- 当前项目自己的业务模块包必须排除。
- 每个业务模块的 `api/index` 和 `page-map` 建议排除。
- `@project` 替换成当前项目 NPM scope。

`vanilla-jsoneditor` 建议用绝对路径 alias：

```ts
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function resolveVanillaJsonEditorStandalone() {
  return require.resolve('vanilla-jsoneditor/standalone.js');
}
```

## 十三、业务模块包目录模板

每个业务模块按后端包名建立目录。

示例后端包名：

```text
com.project.contract
```

前端目录：

```text
packages/business/contract-admin/
  src/
    modules/
      com_project_contract/
        index.ts
        module.ts
        routes.ts
        page-map.ts
        locales.ts
        backend-route-mappings.ts
        api-module.ts
        api/
          index.ts
          contract.ts
        views/
          contract/
            index.vue
        locales/
          zh-CN.json
          en-US.json
  package.json
  build.config.ts
  tsconfig.json
```

目录命名规则：

```text
后端包名：com.project.contract
前端目录：com_project_contract
模块名：com.project.contract
```

这样未来多个源码仓库需要合并时，可以直接按模块目录合并。

## 十四、业务模块 module.ts 模板

```ts
import type { AdminFrontendModule } from '@levin/admin-framework';

import { CONTRACT_API_MODULE, CONTRACT_MODULE_NAME } from './api-module';
import { contractBackendRouteMappings } from './backend-route-mappings';
import { contractLocales } from './locales';
import { contractPageMap } from './page-map';
import { contractRoutes } from './routes';

export function createContractAdminModule(): AdminFrontendModule {
  return {
    apiModuleBase: CONTRACT_API_MODULE,
    backendRouteMappings: contractBackendRouteMappings,
    locales: contractLocales,
    name: CONTRACT_MODULE_NAME,
    order: 200,
    pageMap: contractPageMap,
    routes: contractRoutes,
    title: '合同模块',
    version: '0.1.0',
  };
}
```

## 十五、业务模块 package.json 模板

```json
{
  "name": "@project/contract-admin",
  "version": "0.1.0",
  "description": "项目合同后台前端模块",
  "license": "MIT",
  "type": "module",
  "scripts": {
    "build": "pnpm unbuild",
    "prepublishOnly": "pnpm run build"
  },
  "files": ["dist", "src"],
  "sideEffects": ["**/*.css", "**/*.vue"],
  "main": "./dist/modules/com_project_contract/index.mjs",
  "module": "./dist/modules/com_project_contract/index.mjs",
  "types": "./dist/modules/com_project_contract/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/modules/com_project_contract/index.d.ts",
      "default": "./dist/modules/com_project_contract/index.mjs"
    },
    "./modules/com_project_contract": {
      "types": "./dist/modules/com_project_contract/index.d.ts",
      "default": "./dist/modules/com_project_contract/index.mjs"
    },
    "./modules/com_project_contract/*": {
      "types": "./dist/modules/com_project_contract/*.d.ts",
      "default": "./dist/modules/com_project_contract/*.mjs"
    },
    "./modules/com_project_contract/api/*": {
      "types": "./dist/modules/com_project_contract/api/*.d.ts",
      "default": "./dist/modules/com_project_contract/api/*.mjs"
    },
    "./modules/com_project_contract/views/*.vue": {
      "types": "./dist/modules/com_project_contract/views/*.vue.d.ts",
      "default": "./dist/modules/com_project_contract/views/*.vue"
    },
    "./src/*": {
      "default": "./src/*"
    }
  },
  "peerDependencies": {
    "@levin/admin-framework": "5.6.6",
    "@levin/oak-base-admin": "5.6.6",
    "@vben/common-ui": "5.6.6",
    "@vben/icons": "5.6.6",
    "@vben/plugins": "5.6.6",
    "@vben/stores": "5.6.6",
    "ant-design-vue": ">=4.0.0",
    "pinia": ">=3.0.0",
    "vue": ">=3.5.0",
    "vue-router": ">=4.0.0"
  },
  "devDependencies": {
    "@levin/admin-framework": "workspace:*",
    "@levin/oak-base-admin": "workspace:*",
    "@vben/common-ui": "workspace:*",
    "@vben/icons": "workspace:*",
    "@vben/plugins": "workspace:*",
    "@vben/stores": "workspace:*",
    "@vben/tsconfig": "workspace:*",
    "ant-design-vue": "catalog:",
    "pinia": "catalog:",
    "vue": "catalog:",
    "vue-router": "catalog:"
  }
}
```

规则：

- 发布包必须包含 `dist` 和 `src`。
- 正式运行默认走 `dist`。
- `src` 用于源码查看和问题定位。
- 公共运行时依赖必须放到 `peerDependencies`。
- 开发期可以用 `workspace:*`。

## 十六、NPM 发布规则

前端模块通过 NPM 私服交付。

流程：

```text
模块开发
  -> 修改版本
  -> 构建
  -> 本地 pack 检查
  -> 发布到 NPM 私服
  -> 最终项目升级 package.json 版本
  -> pnpm install
  -> 构建最终主应用
```

发布包里包含：

```text
dist/  正式运行入口
src/   源码调试入口
```

## 十七、版本管理规则

如果是多包仓库，建议统一使用：

```text
package-versions.json
```

示例：

```json
{
  "default": "0.1.0",
  "packages": {
    "@levin/admin-framework": "5.6.6",
    "@levin/oak-base-admin": "5.6.6",
    "@project/contract-admin": "0.1.0",
    "@project/finance-admin": "0.1.0"
  }
}
```

规则：

- 不手工逐个修改子包版本。
- 先改统一版本文件。
- 再同步到各子包 `package.json`。
- 发布前必须校验版本一致。

## 十八、发布命令

发布公共框架和基础模块：

```bash
NPM_REGISTRY=http://nexus.example.com/repository/npm/ \
NPM_TOKEN=你的token \
pnpm run publish:admin-modules
```

发布所有公共包：

```bash
NPM_REGISTRY=http://nexus.example.com/repository/npm/ \
NPM_TOKEN=你的token \
pnpm run publish:packages
```

发布当前项目业务模块：

```bash
NPM_REGISTRY=http://nexus.example.com/repository/npm/ \
NPM_TOKEN=你的token \
pnpm --filter @project/contract-admin publish --no-git-checks --registry http://nexus.example.com/repository/npm/
```

只打包不发布：

```bash
pnpm --filter @project/contract-admin pack --pack-destination npm-packages
```

## 十九、复用 Maven 私服凭证

如果 NPM 私服和 Maven 私服共用 Nexus 账号，可以复用 `~/.m2/settings.xml`。

```bash
NPM_REGISTRY=http://nexus.example.com/repository/npm/ \
NPM_AUTH_FROM_MAVEN=true \
MAVEN_SERVER_ID=dist-repo \
pnpm run publish:packages
```

规则：

- `MAVEN_SERVER_ID` 默认可以使用 `dist-repo`。
- 发布脚本读取 `~/.m2/settings.xml`。
- 临时生成 `.npmrc.publish.tmp`。
- 发布完成删除临时 npmrc。
- 不把账号密码写入项目。

## 二十、私服地址规则

推荐：

```text
发布使用 hosted 仓库
安装使用 group 仓库
```

示例：

```text
发布地址：http://nexus.example.com/repository/npm/
安装地址：http://nexus.example.com/repository/npm-public/
```

## 二十一、发布前检查清单

基础模块和公共包发布前：

```bash
pnpm install
pnpm run sync:package-versions
pnpm run check:package-versions
pnpm run pack:packages
pnpm run publish:packages
```

业务模块发布前：

```bash
pnpm install
pnpm --filter @project/contract-admin build
pnpm --filter @project/contract-admin pack --pack-destination npm-packages
NPM_REGISTRY=http://nexus.example.com/repository/npm/ \
NPM_TOKEN=你的token \
pnpm --filter @project/contract-admin publish --no-git-checks --registry http://nexus.example.com/repository/npm/
```

最终主应用验证：

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm run dev
```

## 二十二、多 Git 仓库协作规则

允许结构：

```text
admin-framework 仓库
oak-base-admin 仓库
contract-admin 仓库
finance-admin 仓库
最终项目 admin 仓库
```

本地联调可以使用：

```text
workspace:*
link:../contract-admin
pnpm overrides
```

正式测试、生产、交付必须使用 NPM 私服版本号。

禁止：

- 正式环境使用本地 link。
- 把其他模块源码复制到最终项目长期维护。
- 模块之间互相引用未发布的本地路径。

## 二十三、禁止事项

业务模块禁止：

- 创建独立 `createApp`。
- 创建独立完整路由系统。
- 创建独立登录体系。
- 创建独立 Layout 根框架。
- 创建独立全局 Pinia 实例。
- 创建独立 `index.html`。
- 复制 `admin-framework` 中已有的公共 CRUD 组件。

最终主应用禁止：

- 长期保存框架默认页面副本。
- 长期保存基础模块页面副本。
- 硬编码左侧菜单。
- 绕过后端菜单权限。
- 把所有业务页面混放在 `src/views`。
- 为兼容旧结构保留大量 wrapper 页面。

发布禁止：

- 发布未构建包。
- 发布版本未同步包。
- 发布缺失 `exports` 的包。
- 发布缺失 `peerDependencies` 的模块包。
- 提交包含 token 的 `.npmrc`。

## 二十四、常见问题排查

### 样式错乱

优先检查：

```text
1. Tailwind 是否扫描 node_modules/.pnpm 下的 @levin、@project、@vben、@vben-core
2. postcss.config.mjs 是否显式传入 tailwind.config.mjs
3. peerDependencies 是否安装完整
4. 是否存在多个版本的 @vben-core UI 包
```

### 页面白屏

优先检查：

```text
1. 浏览器控制台是否有动态 import 失败
2. Vite 是否把 @levin 或 @project 模块预构建进 .vite/deps
3. optimizeDeps.exclude 是否包含模块入口、api/index、page-map
4. NPM 包是否已经 build，dist 是否存在
5. package.json exports 是否正确
```

### 菜单为空

优先检查：

```text
1. 后端菜单接口是否返回数据
2. 当前用户是否有菜单权限
3. menuSyncService 是否正确注入
4. backendRouteMappings 是否匹配后端菜单路径
5. pageMap 是否包含对应页面
```

### 页面覆盖不生效

优先检查：

```text
1. 覆盖文件是否在主应用 src/pages 下
2. 覆盖路径是否和页面注册路径一致
3. main.ts 是否注入 pageOverrides
4. normalizeAdminGlobPageMap 的 root 是否正确
```

## 二十五、新项目落地流程

新建最终项目：

```text
1. 建立 frontend/admin 工作区
2. 建立 apps/bootstrap-app 入口应用
3. 配置 apps/bootstrap-app/package.json
4. 配置 .npmrc
5. 配置 .env.development 和 .env.production
6. 配置 apps/bootstrap-app/src/main.ts
7. 配置 apps/bootstrap-app/src/modules/list.ts
8. 安装 @levin/admin-framework
9. 安装 @levin/oak-base-admin
10. 安装当前项目业务模块包
11. 配置 Tailwind/PostCSS/Vite
12. 按需在 apps/bootstrap-app/src/pages 覆盖页面
13. pnpm run typecheck
14. pnpm run build
15. pnpm run dev 验证页面
```

新建业务模块：

```text
1. 新建 @project/xxx-admin 包
2. 按后端包名建立 src/modules/<后端包名目录>
3. 编写 api、views、routes、page-map、locales
4. 编写 createXxxAdminModule
5. 配置 package.json exports、files、peerDependencies
6. pnpm --filter @project/xxx-admin build
7. pnpm --filter @project/xxx-admin pack
8. 发布到 NPM 私服
9. 最终主应用安装并启用模块
```

## 二十六、最终结论

最终系统的标准装配方式是：

```text
最终主应用
  安装 @levin/admin-framework
  安装 @levin/oak-base-admin
  安装当前项目业务模块包
  在 apps/bootstrap-app/src/modules/list.ts 启用模块
  在 apps/bootstrap-app/src/pages 按需覆盖页面
  构建最终应用
```

基础模块和业务模块都通过 NPM 私服交付。发布包同时包含 `dist` 和 `src`，正式运行走 `dist`，排查问题看 `src`。菜单以后端为准，页面按模块注册，最终主应用只做装配和覆盖。
