# @levin/bpm-designer

独立流程设计器包。它提供流程定义编辑组件和受控的定义契约；BPMN 转换、模拟和发布始终由后端工作流 API 执行。

`WorkflowDesigner` 提供业务对象选择、字段映射、类型化条件树、业务用途依赖、可视化节点与连线、多人审批、节点表单和结果操作。它通过 `options.users`、`options.groups` 与 `options.businessTypes` 接收已授权候选和业务能力目录，不要求业务对象有固定状态字段。`WorkflowDefinitionWorkbench` 提供保存草稿、自动模拟和发布入口，服务端执行最终权限、配置、覆盖率和生命周期校验。

```vue
<WorkflowDefinitionWorkbench
  v-model:definition="definition"
  :options="{ users, groups, businessTypes }"
  :version="version"
  :permissions="{ save: canSave, simulate: canSimulate, publish: canPublish }"
  @refreshed="reloadVersion"
/>
```

已发布或已下线版本必须传入只读版本数据。宿主不得在浏览器端跳过模拟结果或直接生成 BPMN XML。

模拟报告仅说明服务端已实现边界内的配置和覆盖结果，不能替代真实业务写入、外部发送、并发与权限隔离验收。当前批次的模拟隔离扩展仍在集成，不能依据组件构建成功宣称完整平台已交付。

使用 `createDefinition(processKey, name)` 创建 schemaVersion 2 的新草稿。已有版本直接读取 `version.lowflowDefinition`；保存与 `refreshed` 响应须保留最新 `optimisticLock`。修改 Testing 版本会使原模拟结果失效。

组件入口、受支持节点、权限边界与最小验证见[工作流设计器使用指南](docs/工作流设计器使用指南.md)；组件职责及状态处理见[设计与实现说明](docs/流程设计器设计与实现.md)；使用、权限和升级边界见 [模块开发规范](docs/MODULE-DEVELOPMENT-STANDARD.md)。

## 模块开发与设计资料

使用本模块的子项目必须遵循 [模块开发规范](docs/MODULE-DEVELOPMENT-STANDARD.md)。[项目设计和开发参考资料](docs/project-reference/INDEX.md) 提供发布方的设计、需求及规则背景，不构成下游强制约束。
