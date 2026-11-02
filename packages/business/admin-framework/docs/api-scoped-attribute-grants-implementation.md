# 接口级数据授权前端实现说明

`framework-commons/shared/api-scoped-grant.ts` 解析及序列化 `@domain:type:res:action:clauses`；普通四段权限原样保留。`resource-permission-tree-editor.vue` 复用操作行展示服务端候选，`resource-permission-dialog.vue` 将最终 `permissionList` 提交到现有角色更新接口。通配入口只能使用服务端 `wildcardOperation` 字段，不能在浏览器推断。

字段候选中的 `sourceKind` 必须为 `enum` 或 `dict`，`sourceKey` 分别为枚举类全名或真实字典 key；字段条款按 `enum#sourceKey#field@value` 或 `dict#sourceKey#field@value` 写入。无来源键、重复或格式无效的候选不可生成新授权。旧角色中不在新目录的表达式保留原样，页面不自动迁移或放宽权限。

前端字段策略仍消费后端按操作返回的允许组键，不从持久化授权字符串自行计算敏感字段可见性。最小验证：角色弹窗按两个接口配置不同组和值，保存后重新打开核对；再用真实账号访问两个接口，检查服务端拒绝和可见字段与页面一致。
