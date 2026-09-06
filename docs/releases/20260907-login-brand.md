# 2026-09-07 登录站点品牌修正发布

## 发布依赖闭包与归属

| 顺序 | 包 | 原版本 | 目标版本 | 依赖与发布原因 |
| --- | --- | --- | --- | --- |
| 1 | @levin/admin-framework | 5.6.83 | 5.6.84 | 登录品牌修正源码与回归测试归属框架包 |
| 2 | @levin/oak-base-admin | 5.6.85 | 5.6.86 | peerDependencies.admin-framework 同步为精确 5.6.84，元数据变化须重新发布 |

私有 bootstrap-app 是两包消费者，工作区引用保持 workspace:*，不发布；其他可发布包没有本次变更。统一版本源 package-versions.json 已同步并校验。

## 改动

- 登录页技术支持信息仅保留在页脚，移除中央重复文案。
- 登录相关页面的浏览器标题使用站点名称，后台页面继续使用应用标题配置。
- 回归测试覆盖页面文案和标题规则。

## 逐文件归属与打包核验

@levin/admin-framework：

- package.json
- src/framework-commons/app/bootstrap.ts
- src/framework-commons/app/layouts/auth.vue
- src/framework-commons/app/layouts/__tests__/auth-layout-hero-image.test.ts
- 对应发布入口 dist/framework-commons/app/bootstrap.mjs、dist/framework-commons/app/layouts/auth.vue。

@levin/oak-base-admin：package.json（自身版本和框架精确 peer 版本）。

根 package-versions.json 与本发布记录属于前端工程级文件，不属于 npm 模块包。admin-bootstrap/、npm-packages/ 为本地临时产物，不纳入提交。

## 验证与私服

发布前确认私服目标版本未占用。framework 5.6.84、oak 5.6.86 已按顺序发布并反查确认；oak 的框架 peer 精确为 5.6.84。

- 相关登录品牌、登录布局、租户站点设置 3 个测试文件共 24 项通过；本次 3 个源码/测试文件 ESLint 通过。主线已完成类型检查和 localhost 登录页面验证。
- 两包构建成功。npm pack --dry-run --json 核验 framework 914 个文件、上述 6 个关键路径齐全；oak 1055 个文件、package.json 齐全。
- 标准发布器的页面元数据、dist 路由资源、本地及私服 tarball、依赖协议、开发规范和独立安装门禁全部通过。
- 私服下载的 framework 5 个源码/dist 文件与本次工作区逐字节一致；oak 版本及精确 peer 再次核验通过。
- framework 私服完整性：sha512-c76kz03C6jGUTgXwDkdFTcfeiy6e5D4Gsc8Dx2WLCCmDRtmHUlHMq4NGo0f6P2kKDreIwqinPFFq5RQx8bbmsQ==。
- oak 私服完整性：sha512-7z9dOH59xdBGfpuO8hVD0TXx5xRNO7r6PEJsZJH6nMbaggzWfPinE17HwcLB7qQYpJciM/Zv2kcOMmpWyeh9ew==。

发布使用 http://nexus.v-ma.com/repository/npm/，认证复用 Maven server dist-repo，执行 pnpm run publish:admin-modules。发布顺序为 framework 后 oak；每包发布后均下载私服 tarball 验证，再进入下一个包。此批前端变更不涉及数据库修改。
