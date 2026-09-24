# @levin/bpm-designer

独立流程设计器包。它提供流程定义编辑组件和受控的定义契约；BPMN 转换、模拟和发布始终由后端工作流 API 执行。

`WorkflowDesigner` 只编辑受支持的开始、审批和结束节点，并通过 `options.users`、`options.groups` 与 `options.fields` 接收宿主按当前用户、角色、组织及表单权限过滤后的候选数据。`WorkflowDefinitionWorkbench` 在其之上提供保存草稿、自动模拟和发布入口；它只把当前版本状态用于界面提示，所有 JSON、模拟覆盖和生命周期校验仍由 `WorkflowDesignerService` 对接的服务端完成。

```vue
<WorkflowDefinitionWorkbench
  v-model:definition="definition"
  :options="{ users, groups, fields }"
  :version="version"
  @refreshed="reloadVersion"
/>
```

已发布或已下线版本必须传入只读版本数据。宿主不得在浏览器端跳过模拟结果或直接生成 BPMN XML。

组件入口、受支持节点、权限边界与最小验证见[工作流设计器使用指南](docs/工作流设计器使用指南.md)；使用、权限和升级边界见 [模块开发规范](docs/MODULE-DEVELOPMENT-STANDARD.md)。

## 模块开发与设计资料

使用本模块的子项目必须遵循 [模块开发规范](docs/MODULE-DEVELOPMENT-STANDARD.md)。[项目设计和开发参考资料](docs/project-reference/INDEX.md) 提供发布方的设计、需求及规则背景，不构成下游强制约束。
