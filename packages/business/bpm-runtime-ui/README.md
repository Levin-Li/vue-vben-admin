# @levin/bpm-runtime-ui

独立流程执行 UI 包，提供待办详情和审批动作组件。宿主必须使用服务端返回的动作、表单与二次验证要求，不能自行放宽权限。

流程图复用 `@levin/bpm-designer` 中按原技术选型适配的 lowflow-design 画布，因此使用本包时还必须安装其 `peerDependencies` 声明的精确设计器版本。运行图始终以只读模式消费服务端授权的固定版本节点、连线和状态。

`WorkflowBusinessPanel` 嵌入原业务详情，通过 `businessReference` 查询该对象各用途的启动资格与办理历史，执行带幂等键的手动发起。`WorkflowBusinessDetail` 展示授权业务摘要，支持通过本地注册的组件键渲染业务专用详情。

`WorkflowRuntimeWorkbench` 提供待办、已办、我发起和可选的抄送列表；传入 `loadCopied` 才会启用抄送数据。`WorkflowTaskPanel` 会根据服务端的 `requiredFields`、`actions` 和 `verificationTypes` 限制可提交动作，并通过事件把表单和验证码交给 `WorkflowRuntimeService`。流程图是服务端节点状态的安全展示，不渲染服务端下发的任意 HTML/SVG。

```vue
<WorkflowRuntimeWorkbench
  :load-copied="loadCopiedTasks"
  @completed="refreshBusinessDetail"
  @error="showWorkflowError"
/>
```

执行组件不会把用户身份、候选资格或动作许可提交为可伪造参数；后端必须在完成任务和签发二次验证挑战时按当前会话重新授权。

动作面板支持通过、拒绝、退回、转办、委派、委派归还及加签的独立参数表单。没有服务端授权动作时不会补造“通过”；退回节点、目标人员或加签顺序缺少受控选项时不开放该动作，并显示原因。

组件入口、服务端授权边界与最小验证见[工作流执行界面使用指南](docs/工作流执行界面使用指南.md)；使用、权限和升级边界见 [模块开发规范](docs/MODULE-DEVELOPMENT-STANDARD.md)。

## 模块开发与设计资料

使用本模块的子项目必须遵循 [模块开发规范](docs/MODULE-DEVELOPMENT-STANDARD.md)。[项目设计和开发参考资料](docs/project-reference/INDEX.md) 提供发布方的设计、需求及规则背景，不构成下游强制约束。
