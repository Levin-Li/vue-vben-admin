# 后台前端模块发布说明

本前端工程支持把可复用的后台模块发布到 NPM 私服。最终应用安装这些模块包，并显式注册需要启用的模块。

## 强制：统一正式版本发布流程

本节是所有前端发布的唯一执行流程，优先于本文其它历史示例。所有内部 npm 构件必须始终使用同一个正式版本号；任一包的源码、构建配置、随包文档、公开 API 或依赖约束变化，均触发整套非私有内部包统一升版本、全量构建和全量发布。npm 制品不可覆盖，因此未变化包也必须发布新的统一版本。

唯一版本来源是根目录 `package-versions.json` 的 `releaseVersion`。每次发布只修改这一项为新的补丁版本；不得手工改各包 `package.json.version` 或内部 `peerDependencies`，同步脚本会将全部内部包和内部依赖约束写为这个统一版本。

执行顺序固定为两个阶段，阶段一未完全通过时不得上传任何包：

1. 只将 `releaseVersion` 升级为新的正式版本，并同步全部内部包版本和精确内部依赖约束。
2. 扫描全部非私有内部包，按依赖图拓扑排序；被依赖的上游包必须排在消费者之前。
3. **阶段一：本地全量预检。** 全量构建每个包，并验证 `dist`、本地 tarball、导出、依赖协议、模块开发规范、每个包的独立安装、framework 的稳定公开入口 Vite 构建，以及 `bootstrap-app` 的生产构建。应用构建在本地工作区中使用刚完成构建的全部内部包与本地 Vite 工具链，覆盖 Oak、完整页面、Vue SFC 与运行时依赖图。`bootstrap-app` 仅是构建验证目标，不属于 npm 发布清单、发布顺序、版本同步或 tarball 结果。临时消费者必须显式以 `file:` 引用本批每一个本地 tarball；`pnpm.overrides` 仅可在这些临时目录中将间接内部依赖固定到同一批 `file:` 制品，且不得进入发布构件。不得从 Nexus 下载本批内部构件，也不得依赖 workspace 链接、pnpm peer 提升或历史缓存。构件相关文档必须同步进入包内 `docs/` 与 `docs/project-reference/` 并通过逐文件清单校验。
4. 阶段一任一包失败时，立即结束本批次且 **不得执行任何 `npm publish`**；修复后从阶段一重新完成所有本地验证。
5. **阶段二：一次性上传。** 仅当阶段一全部通过后，按依赖顺序串行上传每个包。每个上游包上传后必须通过 Nexus hosted npm registry 查询精确版本、下载 tarball 并完成相同的依赖和文档校验，才能继续消费者。
6. 网络类失败（连接超时、DNS、连接重置、临时 5xx 或 registry 临时不可达）对当前步骤最多自动重试 10 次；构建、版本、导出、tarball、独立安装或消费者构建失败属于确定性错误，必须立即停止。
7. 全部包完成后，必须在新的非 workspace 目录中仅从 Nexus 安装本批构件集，并执行 `bootstrap-app` 生产构建；通过后才允许部署。

### 失败恢复与重试

一个 `releaseVersion` 对应一个固定发布批次。失败恢复必须继续该批次，禁止仅因一个模块失败就再次修改 `releaseVersion`、重新发布已验证上游包或重新生成整个版本集合。

1. 网络类错误只重试失败的当前步骤，最多 10 次；已成功上传和回取验证的包不重发。
2. 构建、导出、tarball 或应用认证等确定性错误，修复后只从失败模块重新构建和验证；依赖它的后续消费者按顺序继续。此前已在 Nexus 完成精确版本验证的上游构件必须先重新查询确认存在，但不重新上传。
3. 只有显式放弃当前批次、或需要改变一个已发布构件的内容时，才创建新的 `releaseVersion`。这时必须重新走完整构件集发布；不能覆盖同名同版本制品。
4. 发布状态必须持久化记录每个包的 `pending`、`published-and-verified` 或 `failed` 状态，使恢复命令能从失败包继续，不能把“已经发布”误作“尚未发布”或反之。

### 已部分上传批次的强制处理

当阶段二已向 Nexus 上传任一包时，必须先逐个查询本批所有包的精确版本，并将结果记录为 `published-and-verified`、`pending` 或 `failed`。不得依据本地 tarball、缓存或命令输出猜测私服状态。

1. 阶段一失败且尚未上传任何包：修复后保持当前 `releaseVersion`，从阶段一重新完成全量本地预检。
2. 阶段二仅遇到网络类错误：先反查当前包；确认不存在才最多重试当前上传步骤，确认已存在则执行回查后继续下游包。
3. 阶段二发现构件、导出、依赖、文档、安装或应用构建等确定性问题：立即停止后续上传。若修复会改变任何已上传构件、版本元数据或统一发布流程，当前版本不可覆盖，必须递增 `releaseVersion` 并让全部非私有内部包重新走阶段一和阶段二；不得把先前已上传的上游包与新版本下游包混成同一批。
4. 新批次发布完成后，必须在发布报告中同时列出废弃的部分版本、触发新批次的原因和最终完整版本；不删除私服中已存在的历史制品。

标准命令：

```bash
NPM_REGISTRY=http://nexus.v-ma.com/repository/npm/ \
NPM_AUTH_FROM_MAVEN=true \
MAVEN_SERVER_ID=dist-repo \
pnpm run publish:packages
```

`publish:admin-modules` 是完整统一版本发布的兼容别名；正式发布不得传递 `--only`。

## 包说明

合并后公开构件固定为七个：`@vben-core/foundation`、`@vben-core/ui`、`@vben/runtime`、`@vben/common-ui`、`@vben/layouts`、`@levin/admin-framework`、`@levin/oak-base-admin`。源码归属和旧入口映射见 [聚合包使用与迁移指南](frontend-package-consolidation.md)。`pnpm run list:packages` 应仅列出这七个包；发布前先执行完整 `pnpm build`，再执行 `node scripts/verify-consolidated-consumer.mjs` 验证本批候选 tarball。Nexus 上传与回取验证仍按上文逐包执行。

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

批量发布 `packages` 目录下全部可发布包时使用同一套发现和认证规则：

```bash
NPM_REGISTRY=http://nexus.v-ma.com/repository/npm/ \
NPM_AUTH_FROM_MAVEN=true \
MAVEN_SERVER_ID=dist-repo \
pnpm run publish:packages
```

发布脚本只会生成本次命令可用的临时 `.npmrc.publish.tmp`，结束后自动清理；不要把 token、Maven 密码或临时 npmrc 提交到仓库。规则文件只保留“发布前查项目发布文档和本地配置”的原则，具体私服地址和认证复用方式以本文档和本地 `settings.xml` 为准。

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

`publish:packages` 会自动扫描 `packages/**/package.json`，跳过 `private: true` 的包，按 workspace 依赖顺序构建和发布。已存在的同名同版本是发布错误，必须失败；任何包均不得跳过、覆盖或复用旧制品。

## 版本统一管理

`packages` 目录下所有可发布子包的版本统一由根目录 `package-versions.json` 管理，不直接手改各子包的 `package.json.version`。

当前规则：

```json
{
  "releaseVersion": "5.6.105",
  "default": "5.6.6",
  "packages": {}
}
```

版本调整流程（只修改 `releaseVersion`）：

```bash
# 只修改 releaseVersion 后同步所有子包 package.json 和内部 peer 依赖
pnpm run sync:package-versions

# 校验子包版本是否和统一配置一致
pnpm run check:package-versions
```

所有标准发布入口（`pack:packages`、`publish:packages`、`pack:admin-modules`、`publish:admin-modules`）都会在执行前自动同步版本和内部包引用，避免漏改某个子包。内部普通依赖统一使用 `workspace:*`；对外 `peerDependencies` 中的内部包版本统一同步为 `package-versions.json` 中的精确当前版本，例如 `@vben/request: 5.6.7`。这些包是同一套内部发布物，入口应用应按 peer 声明安装配套版本，不使用宽松范围混装不同补丁版本。发布脚本会在上传前校验内部 peer 是否等于本次发布版本来源中的精确版本，不一致时会中断发布。

### 内部模块升级的级联发布

当 A 包的版本更新，而 B 包在 `peerDependencies` 中依赖 A 时，必须在一次发布中完成以下动作：

1. 先更新 `package-versions.json` 中 A 的新版本；
2. 执行 `pnpm run sync:package-versions`，把 B 的 `peerDependencies.A` 更新为 A 的精确新版本；
3. 因为 B 的已发布元数据变化，递增 B 的自身版本，并把 B 纳入本次发布清单；
4. 先发布 A，再发布 B。

例如，升级 `@levin/admin-framework` 时，`@levin/oak-base-admin` 的 peer 约束会同步到新版本，且 Oak 包必须使用新自身版本重发。不能只发布框架包，否则私服中已存在的 Oak 包仍会要求旧版本。标准发布器会同步并校验约束；如果约束没有更新，会在上传 tarball 前中断。

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
