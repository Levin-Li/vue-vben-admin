# 公共表单分步填写发布

1. 公共 CRUD 分步填写展示全部有效步骤与底部上一步，并保留数据和原有校验。入口文案调整为“分步填写”。
2. 发布 `@levin/admin-framework`、`@levin/bpm-designer`、`@levin/bpm-runtime-ui` 版本 `6.0.35`，`@levin/oak-base-admin` 版本 `6.0.45`；四包本地 tarball 逐包校验文件、文档、依赖及独立消费者安装后上传成功。
3. 14 项组件测试、布局与页面清单检查、公共包构建通过。真实业务页面尚未验证：本机后端未启动，隔离模拟账号登录失败。未部署生产。完整发布日志 `/tmp/crud-stepper-publish-final.log`。
