# @vben/types

用于多个 `app` 公用的工具类型，继承了 `@vben-core/typings` 的所有能力。业务上有通用的类型定义可以放在这里。

## 用法

### 添加依赖

```bash
# 进入目标应用目录，例如 apps/xxxx-app
# cd apps/xxxx-app
pnpm add @vben/types
```

### 使用

```ts
// 推荐加上 type
import type { SelectOption } from '@vben/types';
```

## 模块开发与设计资料

使用本模块的子项目必须遵循 [模块开发规范](docs/MODULE-DEVELOPMENT-STANDARD.md)。[项目设计和开发参考资料](docs/project-reference/INDEX.md) 提供发布方的设计、需求及规则背景，不构成下游强制约束。
