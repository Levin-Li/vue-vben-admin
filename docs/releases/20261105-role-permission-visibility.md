# 2026-11-05 角色权限分配可见性发布

## 交付内容

- 角色资源权限树显示各分类已选权限数，并支持只看已选项；筛选与搜索、分类切换兼容。
- 信息权限提示列出已选信息组的字段成员；资源权限弹窗按视口宽度和最小宽度自适应。
- 组织数据权限树的节点操作区稳定占满节点剩余宽度，访问设置控件在首次显示时靠右对齐。
- 公共 CRUD 字段权限回归覆盖有权/无权导入导出：无权列不提供映射且不会阻断其它字段导入；导出文件内容按列表接口许可过滤。

## 验证

- `resource-permission-tree-editor.test.ts`、`resource-attr-group-permissions.test.ts`、`data-permission-dialog.test.ts`、`crud-data-attr-page.test.ts` 和 `data-attr-policy.test.ts` 共 172 项通过。
- 改动组件与测试的 ESLint 检查通过；`user-org-selector.vue` 的 ESLint 基线存在 9 个既有错误，提交前版本同样报错，与本次 CSS 改动无关。
- 使用本地 Chrome 和静态预览数据验证权限筛选、数据权限弹窗及嵌套组织树；1600px/1200px 视口下权限弹窗分别为 1360px/1080px，3 个组织层级的访问设置操作区右边缘对齐，无页面错误。该验收未调用真实后端。
- `git diff --check` 通过。

## 发布

发布候选由 `pnpm run plan:packages` 确认：

| 包 | 版本 |
| --- | --- |
| `@levin/admin-framework` | `6.0.25` |
| `@levin/bpm-designer` | `6.0.25` |
| `@levin/bpm-runtime-ui` | `6.0.25` |
| `@levin/oak-base-admin` | `6.0.32` |

发布目标：`http://nexus.v-ma.com/repository/npm/`。发布器最终批次的 tarball 为：

- `@levin/admin-framework@6.0.25`：清单确认包含 `package/AGENTS.md`、两份接口级授权指南、权限树/分配组件和三份相关回归测试。
- `@levin/bpm-designer@6.0.25`、`@levin/bpm-runtime-ui@6.0.25`：清单确认包含新版本的 `package/package.json`，并已更新对 admin-framework 的精确 peer 版本。
- `@levin/oak-base-admin@6.0.32`：清单确认包含新版本 `package/package.json`、更新后的静态字段契约和 `dist`，并已更新对 admin-framework 的精确 peer 版本。

发布器报告本批 4 个包全部发布成功；上传内容与预检 tarball 相同。版本清单已同步到 `package-versions.json`。
