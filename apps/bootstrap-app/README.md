# 后台启动应用

<!-- cspell:ignore inapp FEISHU JSAPI -->

本应用的企业 App 内授权交互验收入口为 [Playwright 独立配置](enterprise-inapp.playwright.config.ts) 和 [三家交互矩阵](tests/e2e/enterprise-inapp.spec.ts)，供应商边界配置见 [测试辅助程序](tests/e2e/support/enterprise-inapp-fixture.ts)。

## 企业授权交互验收

在 `frontend/admin` 工程根目录执行。先启动专用前端 `127.0.0.1:15667`、后端 `127.0.0.1:18082` 与供应商模拟服务 `127.0.0.1:18093`，使用专用 PostgreSQL/Redis 与虚构用户；不得对日常开发或生产数据库执行本矩阵。模拟服务的 `/control/config` 提供此次验收的应用地址及虚构账号。

前端新启动前按仓库规则刷新依赖；使用现有声明版本，不升级依赖。开发代理只允许本机目标，并保留Host以供真实后端校验站点及回调：

```sh
pnpm install --force
LEVIN_DEV_BACKEND_TARGET=http://127.0.0.1:18082 pnpm --filter @levin/bootstrap-app dev --host 127.0.0.1 --port 15667 --strictPort
```

全套的 [初始夹具校验](tests/e2e/support/enterprise-inapp-global-setup.ts) 只运行一次，要求5个用户及3条预置绑定。主动绑定用例会合法新增虚构记录，重跑前先按根仓库夹具说明执行受限恢复；worker因用例失败重启不重新判定初始数量。单worker串行执行，不支持共享夹具并发。

```sh
pnpm exec playwright test --config apps/bootstrap-app/enterprise-inapp.playwright.config.ts
```

默认使用已安装的 Playwright Chromium。若机器缺少其独立浏览器缓存，但已经安装 Google Chrome，可明确选择 Chrome 通道；Playwright 创建独立 headless 测试 profile，不使用用户现有 Chrome 会话。

```sh
ENTERPRISE_INTERACTION_BROWSER_CHANNEL=chrome pnpm exec playwright test --config apps/bootstrap-app/enterprise-inapp.playwright.config.ts
```

只验证首个飞书成功链路，可追加 `--grep 'FEISHU.*已绑定身份 LOGIN'`。浏览器不可用属于环境失败，不会通过跳过用例冒充验收完成，也不由此配置安装新依赖。

本地业务接口、Cookie、令牌交换和数据库操作均实际执行；仅严格匹配的供应商授权网页/官方 JSAPI 脚本使用模拟边界。本套件证明模拟容器全栈流程，不代表实体 App 或真实企业凭据验收。脱敏节点记录及截图位于 `/tmp/enterprise-inapp-browser`；原始 Playwright trace 默认关闭，避免记录 Authorization、授权码和平台令牌。

飞书授权页实际点击同意或取消；企微snsapi_base直接静默302回调；钉钉通过原生桥接成功或onFail。无平台code/回调的钉钉取消场景检查无证明PENDING及零会话写入，不要求FAILED。每个创建/回调/兑换节点读取真实PG/Redis，重放允许正常访问审计，但不得追加供应商调用、绑定或会话。迟到兑换必须等实际响应后确认当前本地用户未被替换。

可用 `ENTERPRISE_EVIDENCE_DIR` 为每轮设置独立证据目录。安全reporter记录场景、状态、耗时、断言位置和错误数量，默认不输出异常原文；原始trace/video关闭，截图故障仍释放浏览器并保留Node证据。35个适用浏览器场景须实际通过；钉钉没有外部state回传的1项明确不适用，不计为成功。

## 平台名称显示验收

[独立显示配置](platform-name.playwright.config.ts)使用[真实组件夹具](tests/e2e/fixtures/social-platform-name.ts)验证按钮及绑定卡片的中文名称。复用本地15666前端，平台与绑定列表按当前API的sourcePlatform字段提供夹具，不生成令牌、不写数据库，不代替认证全栈验收。IAB不支持Document替换，使用独立Chrome提供测试HTML及两项列表响应；组件仍由真实Vite编译。

```sh
pnpm exec playwright test --config apps/bootstrap-app/platform-name.playwright.config.ts
```

截图保存至/tmp/enterprise-platform-name-browser/platform-names.png。
