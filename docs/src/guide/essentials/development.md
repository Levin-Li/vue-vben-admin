# 本地开发 {#development}

::: tip 代码获取

如果你还没有获取代码，可以先从 [快速开始](../introduction/quick-start.md) 处开始阅读文档。

:::

## 前置准备

为了更好的开发体验，我们提供了一些工具配置、项目说明，以便于您更好的开发。

### 需要掌握的基础知识

本项目需要一定前端基础知识，请确保掌握 Vue 的基础知识，以便能处理一些常见的问题。建议在开发前先学一下以下内容，提前了解和学习这些知识，会对项目理解非常有帮助:

- [Vue3](https://vuejs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vue Router](https://router.vuejs.org/)
- [Vitejs](https://vitejs.dev/)
- [Pnpm](https://pnpm.io/)
- [Turbo](https://turbo.build/)

### 工具配置

如果您使用的 IDE 是[vscode](https://code.visualstudio.com/)(推荐)的话，可以安装以下工具来提高开发效率及代码格式化:

- [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) - Vue 官方插件（必备）。
- [Tailwind CSS](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) - Tailwindcss 提示插件。
- [CSS Variable Autocomplete](https://marketplace.visualstudio.com/items?itemName=bradlc.vunguyentuan.vscode-css-variables) - Css 变量提示插件。
- [Iconify IntelliSense](https://marketplace.visualstudio.com/items?itemName=antfu.iconify) - Iconify 图标插件
- [i18n Ally](https://marketplace.visualstudio.com/items?itemName=Lokalise.i18n-ally) - i18n 插件
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) - 脚本代码检查
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) - 代码格式化
- [Stylelint](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint) - css 格式化
- [Code Spell Checker](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) - 单词语法检查
- [DotENV](https://marketplace.visualstudio.com/items?itemName=mikestead.dotenv) - .env 文件 高亮

## Npm Scripts

npm 脚本是项目常见的配置，用于执行一些常见的任务，比如启动项目、打包项目等。以下的脚本都可以在项目根目录的 `package.json` 文件中找到。

执行方式为：`pnpm run [script]` 或 `npm run [script]`。

```json
{
  "scripts": {
    // 构建项目
    "build": "cross-env NODE_OPTIONS=--max-old-space-size=8192 turbo build",
    // 构建项目并分析
    "build:analyze": "turbo build:analyze",
    // 构建本地 docker 镜像
    "build:docker": "./build-local-docker-image.sh",
    // 单独构建 main-app 应用
    "build:main-app": "pnpm run build --filter=@vben/main-app",
    // 单独构建文档
    "build:docs": "pnpm run build --filter=@vben/docs",
    // 单独构建 playground 应用
    "build:play": "pnpm run build --filter=@vben/playground",
    // changeset 版本管理
    "changeset": "pnpm exec changeset",
    // 检查项目各种问题
    "check": "pnpm run check:circular && pnpm run check:dep && pnpm run check:type && pnpm check:cspell",
    // 检查循环引用
    "check:circular": "vsh check-circular",
    // 检查拼写
    "check:cspell": "cspell lint **/*.ts **/README.md .changeset/*.md --no-progress"
    // 检查依赖
    "check:dep": "vsh check-dep",
    // 检查类型
    "check:type": "turbo run typecheck",
    // 清理项目（删除node_modules、dist、.turbo）等目录
    "clean": "node ./scripts/clean.mjs",
    // 提交代码
    "commit": "czg",
    // 启动项目（默认会运行整个仓库所有包的dev脚本）
    "dev": "turbo-run dev",
    // 启动main-app应用
    "dev:main-app": "pnpm -F @vben/main-app run dev",
    // 启动 Oak 最终应用
    "dev:main-app": "pnpm --filter @levin/main-app dev",
    // 启动文档
    "dev:docs": "pnpm -F @vben/docs run dev",
    // 启动演示应用
    "dev:play": "pnpm -F @vben/playground run dev",
    // 格式化代码
    "format": "vsh lint --format",
    // lint 代码
    "lint": "vsh lint",
    // 依赖安装完成之后，执行所有包的stub脚本
    "postinstall": "pnpm -r run stub --if-present",
    // 只允许使用pnpm
    "preinstall": "npx only-allow pnpm",
    // lefthook的安装
    "prepare": "is-ci || lefthook install",
    // 预览应用
    "preview": "turbo-run preview",
    // 包规范检查
    "publint": "vsh publint",
    // 删除所有的node_modules、yarn.lock、package.lock.json，重新安装依赖
    "reinstall": "pnpm clean --del-lock && pnpm install",
    // 运行 vitest 单元测试
    "test:unit": "vitest run --dom",
    // 更新项目依赖
    "update:deps": " pnpm update --latest --recursive",
    // changeset生成提交集
    "version": "pnpm exec changeset version && pnpm install --no-frozen-lockfile"
  }
}
```

## 本地运行项目

如需本地运行文档，并进行调整，可以执行以下命令，执行该命令，你可以选择需要的应用进行开发：

```bash
pnpm dev
```

如果你想直接运行某个应用，可以执行以下命令：

运行 Oak 最终应用：

```bash
pnpm dev:main-app
```

运行 `docs` 应用：

```bash
pnpm dev:docs
```

## 后台模块化开发规则

本项目支持把后台前端能力拆成多个可独立版本管理、独立构建、独立发布的模块包。模块源码可以分散在不同 Git 仓库中维护，正式集成通过 NPM 私服发布的包完成，最终应用只负责选择和装配模块。

### 分层职责

后台前端分为三类包：

- `@levin/admin-framework`：公共后台框架包，提供模块协议、页面注册表、公共页面、公共组件、CRUD helpers 和模块收集工具等稳定公共能力。
- `@levin/*-admin` 或 `@biz/*-admin`：业务/基础后台模块包，贡献页面、路由、菜单元数据、权限点、API 常量和局部组件。
- `@levin/main-app` 或最终业务 App：最终应用包，只负责选择模块、注入项目配置、提供页面覆盖层和最终构建产物。

职责边界必须保持清晰：

```text
admin-framework
  提供 AdminFrontendModule 契约、页面注册表、公共页面和公共装配工具
  源码放在 src/framework-commons

oak-base-admin / order-admin / crm-admin
  提供 routes / menus / setup / views / api helpers

main-app / final-system
  选择 enabled modules，按需覆盖页面，统一构建最终可部署应用
```

本仓中 `@levin/main-app` 是对外启动和打包入口。为了保持稳定和低复杂度，它当前复用 `@vben/main-app` 作为宿主实现，开发命令、构建命令都应从 `main-app` 进入：

```bash
pnpm run dev:main-app
pnpm run build:main-app
pnpm run pack:main-app
```

模块包禁止自己创建完整应用运行时。模块包不得包含独立 `createApp`、独立 `router`、独立 `pinia`、独立登录体系、独立 `Layout` 根框架或完整 `index.html`。这些能力必须由最终应用或 `admin-framework` 宿主能力统一提供。

### 框架公共目录约定

`@levin/admin-framework` 的公共能力必须统一放在 `src/framework-commons/` 下，避免框架公共代码散落在 `src` 根目录：

```text
packages/business/admin-framework/
  src/
    index.ts
    framework-commons/
      index.ts
      api.ts
      runtime.ts
      request-service.ts
      page-map.ts
      page-registry.ts
      adapter/
      pages/
      shared/
```

包根 `@levin/admin-framework` 继续作为稳定公共入口，只从 `src/framework-commons/index.ts` 转发。新代码必须按目录语义使用 `@levin/admin-framework/framework-commons/...`，不保留旧目录兼容入口。

### 模块包目录约定

模块包放在 `packages/business/*` 下，推荐结构如下：

```text
packages/business/oak-base-admin/
  src/
    modules/
      com_levin_oak_base/
        index.ts
        module.ts
        routes.ts
        api-module.ts
        api/
        views/
        locales/
          zh-CN.json
          en-US.json
        components/
  build.config.ts
  package.json
  tsconfig.json
```

模块包入口必须通过 `package.json` 的根 `exports` 指向 `src/modules/<后端包名>/index.ts`，该入口至少导出一个符合 `AdminFrontendModule` 契约的模块对象：

```ts
export const oakBaseAdminModule = {
  name: 'com.levin.oak.base',
  title: '基础模块',
  version: '0.1.0',
  apiModuleBase: '/com.levin.oak.base/V1/api',
  routes: oakBaseAdminRoutes,
};
```

模块名必须稳定且全局唯一。推荐使用后端模块域名或业务域名，例如 `com.levin.oak.base`、`biz.order`。路由 `name` 和权限标识也必须带模块语义，避免多个模块合并后冲突。

### 依赖规则

模块包必须把公共运行时依赖作为 `peerDependencies`，避免最终应用出现多份 Vue、Router、Pinia 或 UI 运行时：

```json
{
  "peerDependencies": {
    "@levin/admin-framework": ">=0.9.4",
    "vue": ">=3.5.0",
    "vue-router": ">=4.0.0",
    "pinia": ">=3.0.0"
  }
}
```

模块内可以在 `devDependencies` 中依赖 `@levin/admin-framework` 的 workspace 版本用于本仓开发，运行期依赖通过 `peerDependencies` 交给最终应用统一装配：

```json
{
  "devDependencies": {
    "@levin/admin-framework": "workspace:*"
  }
}
```

正式发布到 NPM 私服时，`workspace:*` 会被 pnpm 转换为实际版本号。不得长期通过复制源码的方式集成其他模块。

### 构建与发布规则

模块包使用 `unbuild` 独立构建，发布入口必须指向 `dist`。可以随包携带 `src` 用于调试，但消费者默认运行入口必须是构建结果。

```json
{
  "files": ["dist", "src"],
  "main": "./dist/modules/com_levin_oak_base/index.mjs",
  "module": "./dist/modules/com_levin_oak_base/index.mjs",
  "exports": {
    ".": {
      "types": "./src/modules/com_levin_oak_base/index.ts",
      "development": "./src/modules/com_levin_oak_base/index.ts",
      "default": "./dist/modules/com_levin_oak_base/index.mjs"
    },
    "./modules/com_levin_oak_base/views/*.vue": {
      "types": "./src/modules/com_levin_oak_base/views/*.vue",
      "development": "./src/modules/com_levin_oak_base/views/*.vue",
      "default": "./dist/modules/com_levin_oak_base/views/*.vue"
    },
    "./modules/com_levin_oak_base/api/*": {
      "types": "./src/modules/com_levin_oak_base/api/*.ts",
      "development": "./src/modules/com_levin_oak_base/api/*.ts",
      "default": "./dist/modules/com_levin_oak_base/api/*.mjs"
    }
  },
  "publishConfig": {
    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.mjs"
      }
    }
  }
}
```

本地验证命令：

```bash
pnpm run build:admin-modules
pnpm run pack:admin-modules
pnpm run build:main-app
pnpm run pack:main-app
```

发布到 NPM 私服时必须显式使用可写 registry 和 token：

```bash
NPM_REGISTRY=https://npm.example.com \
NPM_TOKEN=xxxxx \
pnpm run publish:admin-modules
```

`NPM_TOKEN` 和 `NODE_AUTH_TOKEN` 均可使用。不要把私服 token 写入仓库文件。发布脚本会为本次发布生成临时 npmrc，并在命令结束后删除。

如果 NPM 私服和 Maven 使用同一个 Nexus，可以复用 `~/.m2/settings.xml` 里的 Maven server 认证：

```bash
NPM_REGISTRY=http://nexus.v-ma.com/repository/npm/ \
NPM_AUTH_FROM_MAVEN=true \
MAVEN_SERVER_ID=dist-repo \
pnpm run publish:admin-modules
```

发布使用 hosted 仓库，例如 `http://nexus.v-ma.com/repository/npm/`。其他项目安装依赖时使用 group 仓库，例如 `http://nexus.v-ma.com/repository/npm-public/`。

项目默认 `.npmrc` 可以指向安装依赖用的镜像源，但发布时必须通过 `NPM_REGISTRY` 指向具备写入权限的 NPM 私服，不能把只读镜像源当作发布目标。

### 最终应用装配规则

最终应用通过 `enabledFrontendModules` 显式启用模块，并在启动时注入宿主运行时能力。模块包持有真实页面/API 源码；最终应用只负责登录、布局、后端菜单、请求实例和最终构建：

```ts
import type { AdminFrontendModule } from '@levin/admin-framework';

import { setAdminFrameworkRuntime } from '@levin/admin-framework';
import { createOakBaseAdminModule } from '@levin/oak-base-admin';

import { getAuthorizedMenuListApi } from '#/api/core/menu';
import { requestClient } from '#/api/request';

setAdminFrameworkRuntime({
  getAuthorizedMenuListApi,
  requestClient,
});

export const enabledFrontendModules: AdminFrontendModule[] = [
  createOakBaseAdminModule(),
];
```

路由必须通过 `@levin/admin-framework` 的收集函数进入宿主路由：

```ts
const frontendModuleRoutes = collectAdminModuleRoutes(enabledFrontendModules);
const accessRoutes = [
  ...dynamicRoutes,
  ...frontendModuleRoutes,
  ...staticRoutes,
];
```

模块源码必须统一放在 `src/modules/<后端包名>/` 下，例如 `src/modules/com_levin_oak_base/views/role/index.vue` 与 `src/modules/com_levin_oak_base/api/role.ts` 对齐。每个模块自己的国际化资源也必须放在本模块目录内，例如 `src/modules/com_levin_oak_base/locales/zh-CN.json`、`src/modules/com_levin_oak_base/locales/en-US.json`，并通过模块对象的 `locales` 字段暴露给最终应用统一合并。最终应用不应复制业务页面源码，也不再保留业务模块页面 wrapper；宿主统一通过页面注册表解析页面。

菜单必须以后端菜单/权限为最终来源：模块提供隐藏路由和默认 `meta`，后端返回当前用户可见菜单，宿主根据菜单 `path` 匹配已注册路由生成真实菜单。不要在业务模块里绕过宿主权限体系私自渲染全局菜单。

### 页面替换规则

所有页面都必须通过统一页面注册表解析，不允许在最终应用里直接写死业务模块页面路径。页面解析优先级固定为：

```text
main-app/src/pages 覆盖层
  > main-app 内置页面
  > 已启用业务模块 pageMap
  > admin-framework 公共 pageMap
```

入口应用要替换页面时，只需要在 `src/pages` 下放同名规范路径文件。没有覆盖文件时，运行时自动使用业务模块或公共框架里的默认页面。

常用覆盖路径示例：

```text
apps/main-app/src/pages/_core/authentication/login.vue
apps/main-app/src/pages/_core/profile/index.vue
apps/main-app/src/pages/system/shared/controller-crud-page.vue
apps/main-app/src/pages/system/com_levin_oak_base/role/index.vue
```

业务模块页面的规范路径由模块包的 `pageMap` 提供。基础模块约定为：

```text
src/modules/com_levin_oak_base/views/role/index.vue
  -> /system/com_levin_oak_base/role/index.vue
```

所以最终应用覆盖角色页时，创建：

```text
apps/main-app/src/pages/system/com_levin_oak_base/role/index.vue
```

入口应用不得为了改一个页面去复制整个模块目录。覆盖文件只放真正需要项目差异化的页面；通用默认页面继续由 `admin-framework` 或业务模块包提供。

### 多 Git 仓库协作规则

模块源码允许在多个独立 Git 仓库中维护。协作方式按环境区分：

- 本地联调：可以使用上层 `pnpm-workspace.yaml`、`workspace:*` 或 `link:../module-repo` 连接多个仓库。
- 测试/生产/交付：必须使用 NPM 私服版本号，例如 `@levin/oak-base-admin@0.9.6`。
- 模块变更：在模块仓库开发、构建、发版；最终应用升级依赖版本，不直接修改已发布模块源码副本。

### packages 版本统一管理

`packages` 目录下所有可发布子包的版本统一由前端根目录 `package-versions.json` 管理。不要直接手改各子包的 `package.json.version`。

```bash
# 修改 package-versions.json 后同步所有子包版本
pnpm run sync:package-versions

# 校验子包版本是否一致
pnpm run check:package-versions
```

`pack:packages` 和 `publish:packages` 会在执行前自动同步版本。

这套规则对应后端 Maven 模块化的心智：

```text
后端：module source -> jar artifact -> final boot app
前端：module source -> npm artifact -> final web app
```

## 区分构建环境

在实际的业务开发中，通常会在构建时区分多种环境，如测试环境`test`、生产环境`build`等。

此时可以修改三个文件，在其中增加对应的脚本配置来达到区分生产环境的效果。

以`@vben/main-app`添加测试环境`test`为例：

- `apps\main-app\package.json`

```json
"scripts": {
  "build:prod": "pnpm vite build --mode production",
  "build:test": "pnpm vite build --mode test",
  "build:analyze": "pnpm vite build --mode analyze",
  "dev": "pnpm vite --mode development",
  "preview": "vite preview",
  "typecheck": "vue-tsc --noEmit --skipLibCheck"
},
```

增加命令`"build:test"`, 并将原`"build"`改为`"build:prod"`以避免同时构建两个环境的包。

- `package.json`

```json
"scripts": {
    "build": "cross-env NODE_OPTIONS=--max-old-space-size=8192 turbo build",
    "build:analyze": "turbo build:analyze",
    "build:main-app": "pnpm run build --filter=@vben/main-app",
    "build-test:antd": "pnpm run build --filter=@vben/main-app build:test",

    ······
}
```

在根目录`package.json`中加入构建测试环境的命令

- `turbo.json`

```json
"tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [
        "dist/**",
        "dist.zip",
        ".vitepress/dist.zip",
        ".vitepress/dist/**"
      ]
    },

    "build-test:antd": {
      "dependsOn": ["@vben/main-app#build:test"],
      "outputs": ["dist/**"]
    },

    "@vben/main-app#build:test": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },

    ······
```

在`turbo.json`中加入相关依赖的命令

## 公共静态资源

项目中需要使用到的公共静态资源，如：图片、静态HTML等，需要在开发中通过 `src="/xxx.png"` 直接引入的。

需要将资源放在对应项目的 `public/static` 目录下。引入的路径为：`src="/static/xxx.png"`。

## DevTools

项目内置了 [Vue DevTools](https://github.com/vuejs/devtools-next) 插件，可以在开发过程中使用。默认关闭，可在`.env.development` 内开启，并重新运行项目即可：

```bash
VITE_DEVTOOLS=true
```

开启后，项目运行会在页面底部显示一个 Vue DevTools 的图标，点击即可打开 DevTools。

![Vue DevTools](/guide/devtools.png)

## 本地运行文档

如需本地运行文档，并进行调整，可以执行以下命令：

```bash
pnpm dev:docs
```

## 问题解决

如果你在使用过程中遇到依赖相关的问题，可以尝试以下重新安装依赖：

```bash
# 请在项目根目录下执行
# 该命令会删除整个仓库所有的 node_modules、yarn.lock、package.lock.json后
# 再进行依赖重新安装（安装速度会明显变慢）。
pnpm reinstall
```
