# 2026-10-26 性能监控前端包发布记录

## 范围与版本

从隔离工作区发布本次性能监控页面和其必要的运行时依赖修复，未包含原工作区其它未提交功能。`@levin/oak-base-admin` 选择北京时间当天时每 5 秒请求一次后端实时统计；历史日期不轮询。

| 包 | 版本 |
| --- | --- |
| `@vben/runtime` | `6.0.4` |
| `@vben/common-ui` | `6.0.4` |
| `@vben/layouts` | `6.0.4` |
| `@levin/admin-framework` | `6.0.18` |
| `@levin/bpm-designer` | `6.0.18` |
| `@levin/bpm-runtime-ui` | `6.0.18` |
| `@levin/oak-base-admin` | `6.0.20` |

`@vben/runtime` 原有的 `vxe-pc-ui` 依赖由宽松范围收紧为精确的 `4.12.35`。实际运行时 tarball 声明该精确版本，包内的 `es/style.css` 路径与当前运行时代码相符。消费者版本依发布器计算的内部精确依赖闭包同步递增；没有新增依赖或使用 overrides。

## 发布和验证

首次仅尝试管理模块包时，标准发布器在上传前的独立消费者构建发现旧运行时依赖范围可能安装缺少样式路径的新版本，故未上传。修复后，从前端仓库根目录运行标准 `publish:packages -- --only=@vben/runtime,@levin/oak-base-admin`；7 份实际 tarball 的文件、路由、依赖及模块文档门禁通过，独立消费者安装和 Vite 生产构建通过，7 个包均报告“发布成功”，命令零退出码。

监控页面定向测试 4 项、ESLint、运行时与管理模块类型检查以及运行时/管理模块构建通过。实际 `@levin/oak-base-admin@6.0.20` tarball 含监控页面源码、使用指南、AGENTS、README 与模块开发规范。发布不等于应用部署，未重启线上或本地服务。
