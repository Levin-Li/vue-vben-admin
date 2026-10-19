# 2026-10-19 AI浏览器兼容修复发布

## 范围与版本

仅交付 `@levin/oak-base-admin@6.0.11`，保留既有SDK精确版本及Node基线，不增加依赖。工作区其它文件存储源码及其所属包未纳入本次Git提交和发布候选；已有构建同步的非规范性背景副本不代表文件存储功能已交付。主要改动为Oak构建配置、浏览器SDK子入口、transport延迟加载、3个加载阶段回归文件、独立消费者门禁脚本/测试、使用指南及内联依赖许可。

## 实现与边界

SDK/Provider在包内编译为自包含ESM，公开子入口所有条件均指向dist。AST构建门禁拒绝残留导入及CommonJS require；不使用OIDC替身或Node polyfill。基础模块/目录读取不加载SDK；实际调用时才加载，等待受AbortSignal及总超时约束，迟到模块不能继续请求。业务鉴权、配置范围、HTTPS与凭据隔离、限额、取消和错误脱敏保持原语义；不添加后端中转。

## 验证

29项原协议/安全及加载/取消/失败回归、4项消费者门禁单测均通过；Oak vue-tsc无诊断，修改代码定向ESLint通过。真实tarball独立安装后采用Vite7.3.1默认配置（仅本机HTTP模型协议模拟插件，无兼容alias/optimizeDeps/polyfill），开发冷启动、刷新及生产预览均在in-app browser通过真实SDK调用：status=passed、调用前SDK资源0、process/Buffer=undefined、每次仅1个同源POST、errors及跨源请求0。所有模型响应来自协议模拟，未重新使用真实供应商账号或密钥，不宣称完整登录业务系统/全部Agent技能重新验收。截图ai-browser-esm-dev.png及ai-browser-esm-preview.png保留在本机会话附件，不进包。

浏览器验收SDK SHA-256：`5306bd95ecae12051a230c544e90224689c5fe747a1880f7f1afc78275f20c26`。transport SHA-256：`ba053aa2da7911c2b755675eca82593dbfe37f501d8ce7f5155f9ea79d4ca232`。正式发布重新构建时通过LEVIN_AI_BROWSER_RUNTIME_SHA256/LEVIN_AI_BROWSER_TRANSPORT_SHA256校验关键字节与已验收包一致；元数据时间等允许重新生成，不把浏览器预验包冒充相同完整tarball。

## 发布与升级

标准发布器 `--publish --only=@levin/oak-base-admin` 以退出0完成，npm明确发布6.0.11成功，上传前实际tarball分类/文档/导出/版本/内部精确依赖及独立消费者生产构建通过。使用现有Nexus hosted npm及Maven认证，不保留凭据、不反查成功版本。内联9个第三方包的许可证/声明随THIRD-PARTY-LICENSES.txt交付。

子项目升级Oak至6.0.11并重启开发服务即可，无需添加Vercel令牌或Vite/OIDC补丁。仍需按既有配置启用网页直连及供应商CORS；本次不修改子项目源码、后端服务或业务数据库。
