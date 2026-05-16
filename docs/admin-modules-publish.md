# 后台前端模块发布说明

本前端工程支持把可复用的后台模块发布到 NPM 私服。最终应用安装这些模块包，并显式注册需要启用的模块。

## 包说明

- `@levin/admin-framework`：公共后台框架包，提供模块契约、运行时注入、CRUD 辅助能力、页面注册表和可复用后台 UI。
- `@levin/oak-base-admin`：基础后台模块包，拥有自己的 API 辅助方法、页面源码、路由和国际化资源。
- `@levin/bootstrap-app`：最终后台应用入口，负责装配已启用的模块并产出最终可部署应用。

每个包都独立构建，并发布自己的 `dist` 构建结果。发布包可以同时携带 `src` 源码，便于第三方查看源码、调试和问题排查；但 `src` 只是随包辅助资料，不是第三方应用的公共编译入口。

Levin 后台框架包和业务模块包发布时必须满足：

- `main`、`module`、`types` 和默认 `exports` 必须指向 `dist`。
- `files` 可以包含 `src`，用于随包提供源码资料和文档。
- `exports` 不得公开 `./src/*` 或其他指向 `src` 的公共子路径。
- 第三方应用不得通过 `@levin/*/src/...` 或 `@levin/admin-framework/src/...` 引入源码参与编译；如需本地源码联调，应使用 workspace、`link:` 或 `pnpm overrides`。

`publish:admin-modules` 和 `publish:packages` 会在构建/发布前校验 Levin 后台框架包和业务模块包的公开导出，发现 `src` 导出时会中断发布。

## 构建模块包

```bash
pnpm run build:admin-modules
```

## 本地打包

```bash
pnpm run pack:admin-modules
```

生成的 tgz 包会输出到 `npm-packages/` 目录。

## 发布到 NPM 私服

发布时可以使用 `.npmrc`、`NPM_CONFIG_REGISTRY` 或 `NPM_REGISTRY` 指定 registry。默认镜像源只用于安装依赖，发布必须指向具备写入权限的 NPM 私服，并使用有发布权限的账号或 token。

```bash
NPM_REGISTRY=https://npm.example.com pnpm run publish:admin-modules
```

可选发布标签：

```bash
NPM_TAG=next NPM_REGISTRY=https://npm.example.com pnpm run publish:admin-modules
```

CI 或本地 token 发布：

```bash
NPM_TOKEN=xxxxx NPM_REGISTRY=https://npm.example.com pnpm run publish:admin-modules
```

`NPM_TOKEN` 和 `NODE_AUTH_TOKEN` 都可以使用。发布脚本只会为本次发布生成临时 npmrc，命令结束后会自动删除，不会把 token 写入仓库。

如果 NPM 私服和 Maven 使用同一个 Nexus，可以复用 `~/.m2/settings.xml` 里的 Maven server 认证：

```bash
NPM_REGISTRY=http://nexus.v-ma.com/repository/npm/ \
NPM_AUTH_FROM_MAVEN=true \
MAVEN_SERVER_ID=dist-repo \
pnpm run publish:admin-modules
```

发布使用 hosted 仓库，例如 `http://nexus.v-ma.com/repository/npm/`。入口应用安装依赖时使用 group 仓库，例如 `http://nexus.v-ma.com/repository/npm-public/`。

## 发布全部 packages 包

如果要发布 `packages` 目录下的全部前端基础组件、工具包和业务模块，使用统一入口：

```bash
# 查看将发布的包和顺序
pnpm run list:packages

# 只打包到 npm-packages 目录，不上传
pnpm run pack:packages

# 发布到 NPM 私服；认证信息复用 Maven settings.xml 中的 dist-repo
NPM_REGISTRY=http://nexus.v-ma.com/repository/npm/ \
NPM_AUTH_FROM_MAVEN=true \
MAVEN_SERVER_ID=dist-repo \
pnpm run publish:packages
```

`publish:packages` 会自动扫描 `packages/**/package.json`，跳过 `private: true` 的包，按 workspace 依赖顺序构建和发布。发布时默认检查私服中是否已经存在同名同版本包，已存在的版本会跳过，避免批量发布因为某个旧版本不可覆盖而中断。

## 版本统一管理

`packages` 目录下所有可发布子包的版本统一由根目录 `package-versions.json` 管理，不直接手改各子包的 `package.json.version`。

当前规则：

```json
{
  "default": "5.6.6",
  "packages": {}
}
```

版本调整流程：

```bash
# 修改 package-versions.json 后同步所有子包 package.json
pnpm run sync:package-versions

# 校验子包版本是否和统一配置一致
pnpm run check:package-versions
```

`pack:packages` 和 `publish:packages` 会在执行前自动同步版本和内部包引用，避免漏改某个子包。内部普通依赖统一使用 `workspace:*`，对外 `peerDependencies` 中的内部包版本统一同步为 `package-versions.json.default`。

## 入口应用集成

入口应用固定为 `apps/bootstrap-app`，它是薄应用，只负责启动、引导、装配和覆盖，通常不包含业务相关代码。入口应用在 `apps/bootstrap-app/src/modules/list.ts` 注册模块。应用启动入口在 `apps/bootstrap-app/src/main.ts` 中调用 `configureAdminApplication` 注入已启用模块、后端菜单服务、用户安全服务、通知服务和页面覆盖层。

## 入口应用使用已发布包

入口应用从私服安装已发布的包：

```bash
pnpm add @levin/admin-framework@5.6.6 @levin/oak-base-admin@5.6.6
```

入口应用需要提供兼容的运行时 peer 依赖：

```bash
pnpm add vue vue-router pinia ant-design-vue
```

在入口应用中启用模块。模块包拥有自己的页面、路由元数据、后端菜单路径映射和国际化资源：

```ts
// src/modules/list.ts
import type { AdminFrontendModule } from '@levin/admin-framework';

import { createOakBaseAdminModule } from '@levin/oak-base-admin';

export const enabledFrontendModules: AdminFrontendModule[] = [
  createOakBaseAdminModule(),
];
```

然后在入口中装配运行时：

```ts
// src/main.ts
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
```

本地多仓库联调可以使用 `workspace:*`、`link:../module-repo` 或 `pnpm overrides`。测试、生产和交付环境只使用 NPM 私服版本号，并通过包根入口或已声明的 `dist` 子路径导出引入模块。

## 框架公共代码目录

框架公共代码统一放在 `src/framework-commons`。包根入口只转发稳定公共 API，目录级能力使用 `@levin/admin-framework/framework-commons/...` 引入：

```text
packages/business/admin-framework/src/framework-commons/index.ts
packages/business/admin-framework/src/framework-commons/shared/crud-page.vue
packages/business/admin-framework/src/framework-commons/adapter/vxe-table.ts
```

## 模块源码目录

模块源码必须按后端包名分组，放在 `src/modules` 下。每个模块拥有自己的 API、页面和国际化资源：

```text
src/modules/com_levin_oak_base/api/role.ts
src/modules/com_levin_oak_base/views/role/index.vue
src/modules/com_levin_oak_base/locales/zh-CN.json
src/modules/com_levin_oak_base/locales/en-US.json
```

业务模块维护 `backendRouteMappings` 时，必须为每条页面映射同步维护页面注册路径和源码位置：

- `targetPath`：前端运行时页面注册路径，例如 `/system/com_levin_oak_base/role/index.vue`。
- `sourceFile`：相对于前端源码目录的页面文件路径，例如 `modules/com_levin_oak_base/views/role/index.vue`。

后续新增其他业务模块、补充 CRUD 页面映射或新增非 CRUD 页面映射时，不得只填后端菜单路径和页面注册路径，必须同步填充 `sourceFile`。入口应用执行“上传页面路由”会上传所有已启用模块，并把这些字段同步给后端菜单。

这里的“所有已启用模块”包括最终应用启用的全部前端业务模块，不限于基础模块或当前正在打开的模块。`moduleId` 不作为后端接口必填项；但前端模块存在自己的模块 ID 时，上传时每个菜单项都必须带上该菜单所属模块的模块 ID，通常取 `AdminFrontendModule.name`。

模块通过模块对象的 `locales` 字段暴露国际化内容，入口应用使用 `collectAdminModuleLocales(enabledFrontendModules)` 统一合并。

最终应用不得保留业务模块页面的本地 wrapper。后端菜单中的组件字符串通过已注册的模块 pageMap 解析，因此模块页面会直接从 `@levin/oak-base-admin` 这类包中加载。

## 页面覆盖

所有页面都通过统一页面注册表解析。入口应用可以在 `apps/bootstrap-app/src/pages` 下放置同规范路径的文件，覆盖框架或任意业务模块页面。

页面解析优先级：

```text
apps/bootstrap-app/src/pages 覆盖层
  > 入口应用内置参考页
  > 已启用模块 pageMap
  > admin-framework pageMap
```

覆盖示例：

```text
src/pages/_core/authentication/login.vue
src/pages/system/shared/controller-crud-page.vue
src/pages/system/com_levin_oak_base/role/index.vue
```

如果入口应用没有提供覆盖文件，就自动使用业务模块或 `@levin/admin-framework` 中的默认页面。

## 主应用打包

`@levin/bootstrap-app` 是最终后台应用入口。日常开发从 `bootstrap-app` 启动；它只负责启动、引导和装配，可复用页面和模块代码应放在 `@levin/admin-framework` 或 `@levin/*-admin` 包中。

```bash
pnpm run dev:bootstrap-app
```

```bash
pnpm run build:bootstrap-app
```

如需同时生成 `dist.zip`：

```bash
pnpm run pack:bootstrap-app
```

## 入口应用样式配置

入口应用通过 NPM 私服安装 `@levin/admin-framework`、`@levin/*-admin`、`@vben/*` 和 `@vben-core/*` 包时，必须让 Tailwind 扫描已安装包中的 Vue/TS 源码。pnpm 会把传递依赖放在 `node_modules/.pnpm/<包名>/node_modules/...` 下，如果只扫描 `node_modules/@vben-core/**` 这类顶层软链，会漏掉 `@vben-core/tabs-ui`、`@vben-core/menu-ui` 等传递包，导致 `fill-transparent`、`group-[.is-active]:...` 等工具类没有生成，页面会出现页签黑块、菜单或布局样式错乱。

入口应用的 `tailwind.config.mjs` 必须至少包含：

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

入口应用的 `postcss.config.mjs` 必须显式把本应用的 Tailwind 配置传给 `tailwindcss`，确保处理从模块包引入的 CSS 时使用同一套扫描规则：

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
