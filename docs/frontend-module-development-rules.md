# 前端模块化开发规则

本文档定义后台前端模块化开发、集成、构建和发布规则。最终系统应按本文档建立 `frontend/admin` 工作区，并使用 `apps/bootstrap-app` 作为入口应用。

## 目标

前端模块化的目标是让每个模块可以独立开发、独立版本管理、独立构建、独立发布，并能在多个最终系统中组合使用。

最终形态如下：

```text
公共后台框架包
  + 一个或多个业务模块包
  + 最终主应用入口
  = 一个完整后台系统
```

后端可以通过 Maven 模块组合，前端对应通过 NPM 包组合。不要把多个前端模块源码长期复制到同一个最终项目中。

## 分层规则

后台前端固定分为三层。

### 公共框架包

包名示例：

```text
@levin/admin-framework
```

职责：

- 提供应用启动和挂载能力。
- 提供登录、布局、路由守卫、权限、菜单同步等公共运行时。
- 提供通用 CRUD 页面、通用表单、通用弹窗、通用权限组件。
- 提供模块注册、页面注册、页面覆盖和国际化合并能力。
- 提供请求适配、RBAC 判断、文件存储等公共工具。

公共框架代码统一放在：

```text
packages/business/admin-framework/src/framework-commons
```

框架包禁止放具体业务模块页面。具体业务页面必须进入业务模块包。

### 业务模块包

包名示例：

```text
@levin/oak-base-admin
@biz/order-admin
@biz/crm-admin
```

职责：

- 提供当前后端模块对应的 API。
- 提供当前模块页面。
- 提供当前模块路由。
- 提供当前模块国际化。
- 提供后端菜单路径到前端页面的映射。
- 导出模块对象，供最终主应用启用。
- 使用事件总线、顶部栏扩展区、可拖拽浮动面板等公共基础设施时，必须通过 `@levin/admin-framework/framework-commons` 的公共入口接入，不得直接引用框架内部实现文件。具体用法见 `docs/frontend-common-infrastructure.md`。

业务模块目录必须按后端包名划分，例如：

```text
packages/business/oak-base-admin/src/modules/com_levin_oak_base
```

### 最终主应用

包名示例：

```text
@levin/bootstrap-app
@project/admin
```

职责：

- 安装框架包和业务模块包。
- 声明启用哪些前端模块。
- 配置当前项目名称、主题、偏好、后端地址。
- 提供当前项目的页面覆盖层。
- 构建最终可部署产物。

最终主应用就是入口应用，是一个薄应用，只负责启动、引导、装配和覆盖，通常不包含业务相关代码。主应用不应该长期保存大量框架页面、业务页面、公共布局、公共 API、公共 store。

## 目录规则

### 公共框架目录

推荐结构：

```text
packages/business/admin-framework/
  src/
    index.ts
    framework-commons/
      index.ts
      runtime.ts
      page-map.ts
      page-registry.ts
      app/
        bootstrap.ts
        app.vue
        layouts/
        router/
        store/
        locales/
        api/
        styles/
      shared/
        crud-page.vue
        controller-crud-page.vue
        amis-page.vue
      adapter/
      utils/
  package.json
  build.config.ts
  tsconfig.json
```

根入口 `src/index.ts` 只导出稳定公共 API。框架内部能力通过明确子路径导出，例如：

```ts
export * from './framework-commons';
```

外部使用时优先使用稳定入口：

```ts
import { configureAdminApplication } from '@levin/admin-framework';
```

框架运行时能力可以使用明确子路径：

```ts
import { bootstrap } from '@levin/admin-framework/framework-commons/app/bootstrap';
```

### 业务模块目录

推荐结构：

```text
packages/business/oak-base-admin/
  src/
    modules/
      com_levin_oak_base/
        index.ts
        module.ts
        routes.ts
        page-map.ts
        locales.ts
        backend-route-mappings.ts
        api-module.ts
        api/
          index.ts
          role.ts
          menu.ts
        views/
          crud-page.vue
        locales/
          zh-CN.json
          en-US.json
  package.json
  build.config.ts
  tsconfig.json
```

一级模块目录必须使用后端包名转换后的稳定名称。推荐规则：

```text
后端包名：com.levin.oak.base
前端目录：com_levin_oak_base
```

这样未来需要源码级合并时，可以直接按模块目录合并，不会出现所有页面混在 `src/views` 下的问题。

## 模块对象规则

每个业务模块必须导出模块工厂函数。

示例：

```ts
import type { AdminFrontendModule } from '@levin/admin-framework';

export function createOakBaseAdminModule(): AdminFrontendModule {
  return {
    apiModuleBase: OAK_BASE_API_MODULE,
    backendRouteMappings: oakBaseAdminBackendRouteMappings,
    locales: oakBaseAdminLocales,
    name: OAK_BASE_MODULE_NAME,
    order: 100,
    pageMap: oakBaseAdminPageMap,
    routes: oakBaseAdminRoutes,
    title: '基础模块',
    version: '5.6.6',
  };
}
```

模块对象字段规则：

| 字段                   | 规则                         |
| ---------------------- | ---------------------------- |
| `name`                 | 全局唯一，推荐使用后端模块名 |
| `title`                | 模块中文名称                 |
| `version`              | 当前前端模块版本             |
| `order`                | 多模块排序                   |
| `routes`               | 当前模块提供的本地路由能力   |
| `pageMap`              | 当前模块页面映射             |
| `locales`              | 当前模块国际化资源           |
| `backendRouteMappings` | 后端菜单路径到前端页面映射   |
| `apiModuleBase`        | 当前模块后端 API 基础路径    |

模块名、路由名、权限标识必须带模块语义，避免多个模块合并后冲突。

## 主应用规则

最终主应用固定为 `apps/bootstrap-app`，是一个薄的启动和引导应用。它只做装配和覆盖，不做公共框架和业务模块实现，通常不包含业务相关代码。

推荐目录：

```text
apps/bootstrap-app/
  src/
    main.ts
    modules/
      list.ts
    pages/
    preferences.ts
    shims/
  .env
  package.json
  vite.config.mts
  tailwind.config.mjs
  postcss.config.mjs
```

主应用入口示例：

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

启用模块示例：

```ts
import type { AdminFrontendModule } from '@levin/admin-framework';

import { createOakBaseAdminModule } from '@levin/oak-base-admin';

export const enabledFrontendModules: AdminFrontendModule[] = [
  createOakBaseAdminModule(),
];
```

## 页面覆盖规则

所有页面都必须支持最终主应用覆盖。

页面解析优先级固定为：

```text
主应用 src/pages 覆盖页
  > 已启用业务模块页面
  > admin-framework 默认页面
```

例如框架提供默认登录页，主应用需要替换登录页时，只需要新增：

```text
src/pages/_core/authentication/login.vue
```

例如业务模块提供默认角色页面，主应用需要替换时，只需要新增同规范路径的覆盖页面。

主应用没有覆盖文件时，自动使用业务模块或框架默认页面。

这条规则用于保证最终系统只维护差异化页面，不复制公共框架和业务模块源码。

## 菜单规则

菜单必须以后端返回为准。

前端模块里的 `routes`、`pageMap`、`backendRouteMappings` 只负责告诉框架：

- 后端菜单路径对应哪个前端页面。
- 当前模块有哪些可加载页面。
- 本地开发或兜底时有哪些路由能力。

左侧菜单、权限菜单、可见菜单必须来自后端菜单接口。前端不能用硬编码菜单替代后端菜单。

## 国际化规则

每个模块必须独立维护自己的国际化资源。

推荐目录：

```text
src/modules/com_levin_oak_base/locales/
  zh-CN.json
  en-US.json
```

模块通过 `locales` 字段暴露国际化内容：

```ts
export const oakBaseAdminLocales = {
  'zh-CN': zhCN,
  'en-US': enUS,
};
```

最终主应用统一收集并合并已启用模块的国际化资源。

规则：

- 框架公共文案放在 `admin-framework`。
- 业务模块文案放在业务模块包。
- 最终项目差异化文案放在主应用。
- 模块内页面不得依赖其他业务模块的国际化 key。

## 依赖规则

模块包必须把公共运行时依赖放到 `peerDependencies`，避免最终应用出现多份 Vue、Router、Pinia 或 UI 运行时。

业务模块包示例：

```json
{
  "peerDependencies": {
    "@levin/admin-framework": "5.6.6",
    "@vben/common-ui": "5.6.6",
    "@vben/icons": "5.6.6",
    "@vben/plugins": "5.6.6",
    "@vben/stores": "5.6.6",
    "ant-design-vue": ">=4.0.0",
    "pinia": ">=3.0.0",
    "vue": ">=3.5.0",
    "vue-router": ">=4.0.0"
  }
}
```

开发时可以在 `devDependencies` 使用 `workspace:*`。

最终项目必须在自己的 `package.json` 中安装 peer 依赖。

## NPM 包发布规则

前端模块统一通过 NPM 私服交付。

流程：

```text
模块仓库独立开发
  -> 单独构建
  -> 发布到 NPM 私服
  -> 入口应用通过 package.json 依赖
  -> bootstrap-app 装配成最终系统
```

NPM 包中建议同时包含：

```text
dist/  正式运行入口和公共导出入口
src/   随包源码资料,仅用于查看、调试和问题定位
```

发布包可以携带 `src`，但 `src` 不属于第三方应用的公共编译入口。可发布的 Levin 后台框架包和业务模块包不得在 `exports` 中公开 `./src/*`，也不得把 `main`、`module`、`types` 或默认导出指向 `src`。第三方应用必须通过包根入口或明确的 `dist` 子路径导出使用构建结果。

`package.json` 示例：

```json
{
  "name": "@levin/oak-base-admin",
  "version": "5.6.6",
  "type": "module",
  "files": ["dist", "src"],
  "main": "./dist/modules/com_levin_oak_base/index.mjs",
  "module": "./dist/modules/com_levin_oak_base/index.mjs",
  "types": "./dist/modules/com_levin_oak_base/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/modules/com_levin_oak_base/index.d.ts",
      "default": "./dist/modules/com_levin_oak_base/index.mjs"
    },
    "./modules/com_levin_oak_base/*": {
      "types": "./dist/modules/com_levin_oak_base/*.d.ts",
      "default": "./dist/modules/com_levin_oak_base/*.mjs"
    }
  }
}
```

正式运行和第三方集成必须走 `dist`。`src` 只用于源码查看和问题定位，入口应用不得直接依赖 `@levin/*/src/...` 或 `@levin/admin-framework/src/...` 这类源码深路径。发布脚本会校验 Levin 后台框架包和业务模块包是否公开了 `src` 导出，发现后应先移除再发布。

## 版本管理规则

所有可发布包版本统一由根目录文件管理：

```text
package-versions.json
```

示例：

```json
{
  "default": "5.6.6",
  "packages": {}
}
```

规则：

- 不直接手工改各子包的 `package.json.version`。
- 修改版本时先改 `package-versions.json`。
- 内部普通依赖使用 `workspace:*`，内部 `peerDependencies` 由同步脚本统一写入当前发布版本。
- 发布前必须同步并校验版本。

命令：

```bash
pnpm run sync:package-versions
pnpm run check:package-versions
```

## 构建和打包规则

构建后台模块：

```bash
pnpm run build:admin-modules
```

构建公共框架：

```bash
pnpm run build:admin-framework
```

构建基础模块：

```bash
pnpm run build:oak-base-admin
```

构建最终主应用：

```bash
pnpm run build:bootstrap-app
```

本地打包后台模块，不上传：

```bash
pnpm run pack:admin-modules
```

本地打包 `packages` 下所有公共包，不上传：

```bash
pnpm run pack:packages
```

生成的包输出到：

```text
npm-packages/
```

## 发布到 NPM 私服

发布后台模块包：

```bash
NPM_REGISTRY=http://你的npm私服地址/ \
NPM_TOKEN=你的token \
pnpm run publish:admin-modules
```

只发布指定后台模块包：

```bash
NPM_REGISTRY=http://你的npm私服地址/ \
NPM_TOKEN=你的token \
node ./scripts/publish-admin-modules.mjs --publish --only=@levin/admin-framework
```

```bash
NPM_REGISTRY=http://你的npm私服地址/ \
NPM_TOKEN=你的token \
node ./scripts/publish-admin-modules.mjs --publish --only=@levin/oak-base-admin
```

发布 `packages` 下所有公共包：

```bash
NPM_REGISTRY=http://你的npm私服地址/ \
NPM_TOKEN=你的token \
pnpm run publish:packages
```

只发布指定公共包：

```bash
NPM_REGISTRY=http://你的npm私服地址/ \
NPM_TOKEN=你的token \
node ./scripts/publish-packages.mjs --publish --only=@vben/common-ui,@vben/styles
```

发布标签：

```bash
NPM_TAG=next \
NPM_REGISTRY=http://你的npm私服地址/ \
NPM_TOKEN=你的token \
pnpm run publish:admin-modules
```

## 复用 Maven 私服凭证

如果 NPM 私服和 Maven 私服共用同一个 Nexus 账号，可以复用 `~/.m2/settings.xml` 中的 server 凭证。

命令：

```bash
NPM_REGISTRY=http://你的npm私服地址/ \
NPM_AUTH_FROM_MAVEN=true \
MAVEN_SERVER_ID=dist-repo \
pnpm run publish:admin-modules
```

发布所有公共包：

```bash
NPM_REGISTRY=http://你的npm私服地址/ \
NPM_AUTH_FROM_MAVEN=true \
MAVEN_SERVER_ID=dist-repo \
pnpm run publish:packages
```

规则：

- `MAVEN_SERVER_ID` 默认是 `dist-repo`。
- 发布脚本会读取 `~/.m2/settings.xml`。
- 发布脚本会临时生成 `.npmrc.publish.tmp`。
- 发布完成后会删除临时 npmrc。
- 不允许把 token、账号或密码提交到 Git。

## 私服地址规则

通常 Nexus 会区分 hosted 仓库和 group 仓库。

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

项目 `.npmrc` 示例：

```ini
registry=http://nexus.example.com/repository/npm-public/
always-auth=true
strict-peer-dependencies=false
auto-install-peers=true
dedupe-peer-dependents=true
```

认证信息不要提交到 `.npmrc`，使用环境变量或用户级 npm 配置。

## 发布前检查清单

后台模块发布前必须执行：

```bash
pnpm install
pnpm run sync:package-versions
pnpm run check:package-versions
pnpm run build:admin-modules
pnpm run pack:admin-modules
pnpm run publish:admin-modules
```

发布全部公共包前必须执行：

```bash
pnpm install
pnpm run sync:package-versions
pnpm run check:package-versions
pnpm run pack:packages
pnpm run publish:packages
```

最终主应用发布部署前必须执行：

```bash
pnpm run build:bootstrap-app
```

## 入口应用装配规则

入口应用固定为 `apps/bootstrap-app`。入口应用是薄应用，只负责启动、引导、安装框架包和业务模块包，并声明启用哪些模块，通常不包含业务相关代码。

安装依赖：

```bash
pnpm add @levin/admin-framework@5.6.6 @levin/oak-base-admin@5.6.6
```

安装运行时 peer 依赖：

```bash
pnpm add vue vue-router pinia ant-design-vue
```

主应用声明启用模块：

```ts
import { createOakBaseAdminModule } from '@levin/oak-base-admin';

export const enabledFrontendModules = [createOakBaseAdminModule()];
```

需要覆盖页面时，只在 `apps/bootstrap-app/src/pages` 下新增覆盖页面，不复制模块源码。

## 入口应用 Tailwind 规则

入口应用通过 NPM 私服安装 `@levin/*`、`@vben/*` 和 `@vben-core/*` 包时，必须让 Tailwind 扫描已安装包中的源码。

原因：

pnpm 会把传递依赖放到 `node_modules/.pnpm/<包名>/node_modules/...`。如果只扫描 `node_modules/@vben-core/**` 这类顶层软链，会漏掉传递包中的 Tailwind 工具类，导致页面样式错乱。

主应用 `tailwind.config.mjs` 必须至少包含：

```js
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx,html}',
    './node_modules/@levin/**/*.{vue,js,ts,jsx,tsx,html}',
    './node_modules/@vben/**/*.{vue,js,ts,jsx,tsx,html}',
    './node_modules/@vben-core/**/*.{vue,js,ts,jsx,tsx,html}',
    './node_modules/.pnpm/@levin+*/node_modules/@levin/**/*.{vue,js,ts,jsx,tsx,html}',
    './node_modules/.pnpm/@vben+*/node_modules/@vben/**/*.{vue,js,ts,jsx,tsx,html}',
    './node_modules/.pnpm/@vben-core+*/node_modules/@vben-core/**/*.{vue,js,ts,jsx,tsx,html}',
  ],
};
```

主应用 `postcss.config.mjs` 必须显式使用本应用 Tailwind 配置：

```js
import tailwindConfig from './tailwind.config.mjs';

export default {
  plugins: {
    autoprefixer: {},
    'postcss-antd-fixes': { prefixes: ['ant', 'el'] },
    'postcss-import': {},
    'postcss-preset-env': {},
    tailwindcss: { config: tailwindConfig },
    'tailwindcss/nesting': {},
  },
};
```

## 入口应用 Vite 规则

入口应用需要排除源码型模块入口，避免 Vite 依赖预构建破坏 Vue 页面、装饰器或动态页面映射。

推荐配置：

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
  ],
}
```

`vanilla-jsoneditor` 建议使用绝对路径 alias，避免 Vite 重复模块警告：

```ts
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function resolveVanillaJsonEditorStandalone() {
  return require.resolve('vanilla-jsoneditor/standalone.js');
}
```

## 多 Git 仓库协作规则

允许各模块源码在不同 Git 仓库中维护。

开发协作方式：

```text
模块仓库 A：admin-framework
模块仓库 B：oak-base-admin
模块仓库 C：业务模块
入口应用仓库：bootstrap-app
```

本地联调可以使用：

```text
workspace:*
link:../module-repo
pnpm overrides
```

正式测试、生产和交付必须使用 NPM 私服版本号，不使用本地 link。

规则：

- 模块修改后先构建发布新版本。
- 最终项目升级 `package.json` 中的模块版本。
- 最终项目重新安装并构建。
- 不把其他模块源码复制进最终项目长期维护。

## 禁止事项

禁止在业务模块包中创建：

- 独立 `createApp`。
- 独立完整路由系统。
- 独立完整登录体系。
- 独立完整 Layout 根框架。
- 独立 `index.html`。
- 独立全局 Pinia 实例。
- 和框架重复的公共 CRUD 组件。

禁止在主应用中长期保存：

- 框架默认页面副本。
- 业务模块默认页面副本。
- 公共布局副本。
- 公共 API 和公共 store 副本。
- 只为兼容旧结构存在的 wrapper 页面。

禁止发布：

- 没有执行构建的包。
- 版本未同步的包。
- 缺失 `exports` 的包。
- 缺失 `peerDependencies` 的模块包。
- 包含账号、密码、token 的 `.npmrc`。

## 排错规则

页面样式错乱时，优先检查：

- Tailwind 是否扫描了 `node_modules/.pnpm` 下的 `@levin`、`@vben`、`@vben-core` 包。
- `postcss.config.mjs` 是否显式传入 `tailwind.config.mjs`。
- 入口应用是否安装了所有 peer 依赖。

页面白屏时，优先检查：

- 浏览器控制台是否有动态 import 失败。
- Vite 是否把 `@levin/*` 源码型模块预构建进 `.vite/deps`。
- `optimizeDeps.exclude` 是否包含业务模块入口和页面映射入口。
- NPM 包是否已构建，`dist` 是否存在。

菜单为空时，优先检查：

- 后端菜单接口是否有返回。
- 当前用户是否有菜单权限。
- `menuSyncService` 是否正确注入。
- 后端菜单路径是否能通过 `backendRouteMappings` 映射到前端页面。

页面覆盖不生效时，优先检查：

- 覆盖文件是否放在主应用 `src/pages` 下。
- 覆盖路径是否和页面注册路径一致。
- `pageOverrides` 是否通过 `normalizeAdminGlobPageMap` 注入。

## 推荐落地流程

新建业务模块：

```text
1. 新建 packages/business/xxx-admin
2. 按后端包名建立 src/modules/<后端包名目录>
3. 编写 api、views、routes、page-map、locales
4. 导出 createXxxAdminModule
5. 配置 package.json exports、files、peerDependencies
6. 构建模块包
7. 发布到 NPM 私服
8. 最终主应用安装并启用模块
```

新建最终项目：

```text
1. 建立 frontend/admin 工作区
2. 建立 apps/bootstrap-app 入口应用
3. 安装 @levin/admin-framework 和需要的业务模块包
4. 配置 apps/bootstrap-app/src/main.ts
5. 配置 apps/bootstrap-app/src/modules/list.ts
6. 配置 Tailwind/PostCSS/Vite
7. 按需在 apps/bootstrap-app/src/pages 下覆盖页面
8. 构建验证
```

## 核心结论

前端模块统一按 NPM 包交付。`admin-framework` 提供公共框架，业务模块包提供业务页面、API、路由、页面映射和国际化，最终 `bootstrap-app` 只负责装配和覆盖。

发布包同时包含 `dist` 和 `src`，正式运行走构建产物，排查问题看源码。版本统一由 `package-versions.json` 管理，发布统一走 NPM 私服。最终入口应用固定为 `apps/bootstrap-app`，只做装配和覆盖。
