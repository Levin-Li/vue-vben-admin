# 后台前端模块发布说明

本前端工程支持把可复用的后台模块发布到 NPM 私服。最终应用安装这些模块包，并显式注册需要启用的模块。

## 按需正式版本发布流程

本节是正式发布的唯一操作入口，优先于本文后续的历史示例。九个包各自维护版本；只发布交付内容或精确内部依赖元数据发生变化的包。`publish:packages` 从待提交的包文件确定候选，并递归纳入依赖声明必须更新的消费者。发布前先看候选清单；没有候选包时不构建、不上传。

发布器先一次性准备候选版本，再按内部依赖图分层构建。无依赖关系的包可有界并行；依赖者必须等待上游成功。每个候选只生成一次 tarball，上传前核对其包名、版本、精确内部依赖、`dist` 导出目标、路由资源及具体文件清单，并逐文件核对随包文档。任一候选失败时不得上传任何包；上传的必须是同一份已校验 tarball。

全部候选通过本地预检后，按依赖图分层发布；无依赖的节点可并行。`npm publish` 返回成功就是该包的成功判据，不再下载、查询私服或重复构建消费者。某包失败或结果不明时停止调度它的下游，等待已启动的独立包结束，只查询该失败包的精确版本；确认不存在才用同一 tarball 至多重试一次。已存在或查询不明时不盲目重发、不自动删除私服包。若修改已发布构件的内容，必须使用该包的新版本。

成功后仅在 `npm-packages/` 内清理超过 24 小时的发布器生成临时文件，保留当前批次；失败批次保留用于排障。`packages/**/dist`、`node_modules`、BPM 源码和私服历史制品不在清理范围。仅在下一次成功发布时执行这项本地清理，不创建后台定时任务。

标准命令在 `frontend/admin` 根目录执行：

```bash
pnpm run plan:packages
```

预览命令只显示本次候选与准备后的版本，不构建、不上传。正常发布随后执行：

```bash
NPM_REGISTRY=http://nexus.v-ma.com/repository/npm/ \
NPM_AUTH_FROM_MAVEN=true \
MAVEN_SERVER_ID=dist-repo \
pnpm run publish:packages
```

`publish:admin-modules` 是兼容别名。已提交但尚未发布的特殊情况应显式提供基线或候选包，不得因当前工作树干净而默认为已发布。

```bash
# 已提交但未发布：显式指定比较基线
pnpm run plan:packages -- --since=<上次发布提交>

# 特殊恢复：显式指定目标包，发布器仍会补全必要消费者
pnpm run plan:packages -- --only=@levin/oak-base-admin
```

## 包说明

当前可发布包为九个：`@vben-core/foundation`、`@vben-core/ui`、`@vben/runtime`、`@vben/common-ui`、`@vben/layouts`、`@levin/admin-framework`、`@levin/oak-base-admin`、`@levin/bpm-designer`、`@levin/bpm-runtime-ui`。源码归属和旧入口映射见 [聚合包使用与迁移指南](frontend-package-consolidation.md)。`pnpm run list:packages` 显示可发布包全集；正式发布只处理本次候选，不要求额外执行全仓 `pnpm build` 或独立消费者构建。

- `@levin/admin-framework`：公共后台框架包，提供模块契约、运行时注入、CRUD 辅助能力、页面注册表和可复用后台 UI。
- `@levin/oak-base-admin`：基础后台模块包，拥有自己的 API 辅助方法、页面源码、路由和国际化资源。
- `@levin/bpm-designer`：工作流设计器包。
- `@levin/bpm-runtime-ui`：工作流执行与审批界面包。
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

### 本项目默认私服发现

发布前必须显式设置发布仓库；项目 `.npmrc` 的默认镜像只用于安装，发布器不会再把它作为兜底：

1. 优先使用命令行环境变量：`NPM_REGISTRY`、`NPM_CONFIG_REGISTRY` 或 `npm_config_registry`。
2. 未设置发布仓库、或使用 `npm-public` / `npmmirror` 时，发布器直接失败并输出标准命令。
3. 使用 token 发布时，优先读取 `NPM_TOKEN`，其次读取 `NODE_AUTH_TOKEN`。
4. 本项目 Nexus 同时承载 Maven 和 NPM 私服时，优先复用 Maven 本地认证：设置 `NPM_AUTH_FROM_MAVEN=true`，并通过 `MAVEN_SERVER_ID` 指定 `~/.m2/settings.xml` 中的 `<server><id>`，默认值是 `dist-repo`。

当前本地发布的推荐命令是：

```bash
NPM_REGISTRY=http://nexus.v-ma.com/repository/npm/ \
NPM_AUTH_FROM_MAVEN=true \
MAVEN_SERVER_ID=dist-repo \
pnpm run publish:admin-modules
```

按需发布 `packages` 中的候选包时使用同一套发现和认证规则：

```bash
NPM_REGISTRY=http://nexus.v-ma.com/repository/npm/ \
NPM_AUTH_FROM_MAVEN=true \
MAVEN_SERVER_ID=dist-repo \
pnpm run publish:packages
```

发布脚本只会生成本次命令可用的临时 `.npmrc.publish.tmp`，结束后自动清理；不要把 token、Maven 密码或临时 npmrc 提交到仓库。规则文件只保留“发布前查项目发布文档和本地配置”的原则，具体私服地址和认证复用方式以本文档和本地 `settings.xml` 为准。

## 查看候选与本地打包

正式上传只使用上文按需入口。调试时可以查看九包全集，或只生成本地 tarball；这些命令不代表已经发布：

```bash
# 查看可发布包全集；不是本次候选清单
pnpm run list:packages

# 只打包到 npm-packages 目录，不上传
pnpm run pack:packages
```

`publish:packages` 仍扫描 `packages/**/package.json` 并跳过 `private: true`，但只构建、校验和发布待提交交付变更及必要消费者。已存在的同名同版本不可覆盖；未变化包不得仅为凑统一版本而重发。

## 各包独立版本管理

可发布包版本仍以根目录 `package-versions.json` 为来源，但每个包单独记录。同步到 6.0 时，原有七包保留当前工作区的 `5.6.117`，新增两个 BPM 包保留 `6.0.0`；后续只递增候选及内部依赖声明受影响消费者的版本，不直接手改各包 `package.json.version`。具体版本以版本清单为准。

当前规则：

```json
{
  "packages": {
    "@vben-core/foundation": "5.6.117",
    "@vben-core/ui": "5.6.117",
    "@vben/runtime": "5.6.117",
    "@vben/common-ui": "5.6.117",
    "@vben/layouts": "5.6.117",
    "@levin/admin-framework": "5.6.117",
    "@levin/bpm-designer": "6.0.0",
    "@levin/bpm-runtime-ui": "6.0.0",
    "@levin/oak-base-admin": "5.6.117"
  }
}
```

版本检查命令：

```bash
pnpm run check:package-versions
```

发布入口先从待提交的可交付文件确定候选，计算精确内部依赖闭包并准备各包新版本，再同步内部引用。源码普通依赖可以使用 `workspace:*`，但 tarball 中必须转换为精确版本；内部 peer 也保持精确版本。上传前会检查 tarball 而不是仅信任源码 `package.json`。

### 内部模块升级的级联发布

当 A 包的版本更新，而 B 包在 `peerDependencies` 中依赖 A 时，必须在一次发布中完成以下动作：

1. 发布器递增 A 的独立版本，发现 B 的精确内部依赖声明需要变化；
2. 同步 B 的依赖声明、递增 B 自身版本并加入候选，直到消费者闭包稳定；
3. 在上传前检查 A、B 的实际 tarball 版本及依赖，先发布 A，成功后再发布 B。

例如，升级 `@levin/admin-framework` 时，`@levin/oak-base-admin` 的 peer 约束会同步到新版本，且 Oak 包必须使用新自身版本重发。不能只发布框架包，否则私服中已存在的 Oak 包仍会要求旧版本。标准发布器会同步并校验约束；如果约束没有更新，会在上传 tarball 前中断。

## 入口应用集成

入口应用固定为 `apps/bootstrap-app`，它是薄应用，只负责启动、引导、装配和覆盖，通常不包含业务相关代码。入口应用在 `apps/bootstrap-app/src/modules/list.ts` 注册模块。应用启动入口在 `apps/bootstrap-app/src/main.ts` 中调用 `configureAdminApplication` 注入已启用模块、后端菜单服务、用户安全服务、通知服务和页面覆盖层。

## 入口应用使用已发布包

入口应用从私服安装已发布的包：

```bash
pnpm add @levin/admin-framework@5.6.117 @levin/oak-base-admin@5.6.117
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

框架公共代码统一放在 `src/framework-commons`。包根入口显式导出稳定公共 API；下游扩展能力必须集中从 `@levin/admin-framework` 引入。`framework-commons` 是框架包内部实现目录，只有应用启动、公共 API service、内部运行时装配等已声明的 `dist` 子路径继续使用 `@levin/admin-framework/framework-commons/...`。

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

- `viewPath`：前端运行时页面注册路径，例如 `/system/com_levin_oak_base/role/index.vue`。
- `sourceFilePath`：相对于前端源码目录的页面文件路径，例如 `modules/com_levin_oak_base/views/role/index.vue`。

后续新增其他业务模块、补充 CRUD 页面映射或新增非 CRUD 页面映射时，不得只填后端菜单路径和页面注册路径，必须同步填充 `sourceFilePath`。入口应用执行“上传页面路由”会上传所有已启用模块，并把这些字段同步给后端菜单。

这里的“所有已启用模块”包括最终应用启用的全部前端业务模块，不限于基础模块或当前正在打开的模块。`moduleId` 不作为后端接口必填项；但前端模块存在自己的模块 ID 时，上传时每个菜单项都必须带上该菜单所属模块的模块 ID。

前端页面路由中的模块 ID 不能由前端自定义，必须使用后端 Java 根 POM 约定的模块包名，例如 `com.levin.oak.base`。如果上传代码取 `AdminFrontendModule.name` 作为 `moduleId`，则该模块对象的 `name` 必须等于这个后端模块包名；不要使用 npm 包名、前端页面目录名、短包名、显示名称或其它临时标识。

模块相关命名要按用途拆开：前端目录名由模块包名把 `.` 替换为 `_` 得到，例如 `com_levin_oak_base`，只用于源码目录、页面注册路径和源码定位；短包名由后端 `DefaultRbacInitServiceImpl#getShortName` 按模块包名每段首字母生成，例如 `clob`，只用于后端初始化菜单路径；展示名称用于用户可见的菜单、模块选择和上传页面路由弹窗，如果后端 Java 根 POM 配置了中文名称，应优先使用该中文名称展示，没有中文名称时才使用后端插件名称、模块标题或其它稳定兜底文案。

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

公共模块默认页和入口应用覆盖页共享同一页面注册路径。覆盖时只替换前端组件实现，不改变后端菜单 `path`、权限点、`backendRouteMappings.viewPath` 或“上传页面路由”同步语义。

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
