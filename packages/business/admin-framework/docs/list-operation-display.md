# 列表操作显示脚本

“展示设置2 → 展示列表”在基础设置下方、字段搜索之前提供“列表操作”配置区。点击按钮名称编辑其附加显示表达式，默认 `true`。不增加页签，不改变行内“操作按钮”的设置。

## 运行规则

- 最终显示 = 原权限、业务、能力及批量选中条件成立，并且附加表达式为真。表达式不能授予权限，异常按隐藏处理。
- 超管的“页面展示设置”和“展示设置2”两个恢复入口忽略附加表达式；非超管仍受原访问限制。
- 表达式复用受限 JavaScript 求值器，可用上下文为 `user`、`org`、`tenant`；不提供首条 `row` 或 `form`。
- 设置仍通过现有界面设置上传接口保存，后端的超管写入限制不变。
- 配置保存在 `CrudPageDisplayConfig.listOperations[key].expression`，未配置或空白等效于 `true`。只更新当前草稿，点击“上传当前配置”后生效。

## 登记新的左右按钮

- 框架固定键：`builtin:create`、`tool:export`、`tool:import`、`tool:refresh`、`tool:fullscreen`、`tool:columns`、`settings:display`、`settings:display-v2`。
- 自定义 `rowActions` 中的列表级/批量动作通过稳定 `displayKey` 登记，配置键分别为 `toolbar:<displayKey>`、`batch:<displayKey>`。名称改变不影响关联。没有声明稳定键的动作保留原运行逻辑，但不会猜测名称、位置或 handler 作为持久化键。
- `toolbar-extra` 等插槽按钮在 `CrudPageConfig.listOperations` 中登记 `{key, label, placement}`，使用插槽提供的 `isListOperationVisible(key, 原条件)` 控制展示。`placement` 为 `left` 或 `right`，仅描述真实按钮位置；登记不自动生成业务按钮。
- 当前域名页“申请域名”已通过 `domain:apply` 接入。其他扩展按钮需采用同一契约，不能扫描任意插槽 DOM 自动赋身份。不要复用或覆盖框架保留键。

以下为非规范性示例，业务键和原条件应由调用页面明确提供：

```vue
<template #toolbar-extra="{ isListOperationVisible }">
  <Button v-if="isListOperationVisible('orders:review', canReview)">
    审核
  </Button>
</template>
```

页面另行声明 `listOperations: [{ key: 'orders:review', label: '审核', placement: 'left' }]`。点击处理器和服务端必须继续执行原有授权，不能仅依赖前端显示判断。
