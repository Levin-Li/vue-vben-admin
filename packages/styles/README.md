# @vben/styles

用于多个 `app` 公用的样式文件，继承了 `@vben-core/design` 的所有能力。业务上有通用的样式文件可以放在这里。

## 用法

### 添加依赖

```bash
# 进入目标应用目录，例如 apps/xxxx-app
# cd apps/xxxx-app
pnpm add @vben/styles
```

### 使用

```ts
import '@vben/styles';
```

## 模块开发与设计资料

使用本模块的子项目必须遵循 [模块开发规范](docs/MODULE-DEVELOPMENT-STANDARD.md)。[项目设计和开发参考资料](docs/project-reference/INDEX.md) 提供发布方的设计、需求及规则背景，不构成下游强制约束。
