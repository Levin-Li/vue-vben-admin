# 2026-09-08 全部变更发布

## 发布依赖闭包

|顺序|包|当前版本|目标版本|原因|本批依赖|
|---|---|---|---|---|---|
|1|@vben/constants|5.6.8|5.6.9|直接变更||
|2|@vben/icons|5.6.9|5.6.10|直接变更||
|3|@vben/locales|5.6.16|5.6.17|直接变更||
|4|@vben/preferences|5.6.12|5.6.13|直接变更||
|5|@vben/stores|5.6.10|5.6.11|直接变更||
|6|@vben/styles|5.6.8|5.6.9|直接变更||
|7|@vben/types|5.6.8|5.6.9|直接变更||
|8|@vben/utils|5.6.9|5.6.10|直接变更||
|9|@vben/access|5.6.10|5.6.11|直接变更|@vben/preferences, @vben/stores, @vben/types, @vben/utils|
|10|@vben/hooks|5.6.10|5.6.11|直接变更|@vben/preferences, @vben/stores, @vben/types, @vben/utils|
|11|@vben/request|5.6.10|5.6.11|直接变更|@vben/locales, @vben/utils|
|12|@vben/common-ui|5.6.13|5.6.14|直接变更|@vben/constants, @vben/hooks, @vben/icons, @vben/locales, @vben/types|
|13|@vben/layouts|5.6.25|5.6.26|直接变更|@vben/constants, @vben/hooks, @vben/icons, @vben/locales, @vben/preferences, @vben/stores, @vben/types, @vben/utils|
|14|@vben/plugins|5.6.12|5.6.13|直接变更|@vben/hooks, @vben/icons, @vben/locales, @vben/preferences, @vben/types, @vben/utils|
|15|@levin/admin-framework|5.6.93|5.6.95|直接变更|@vben/access, @vben/common-ui, @vben/constants, @vben/hooks, @vben/icons, @vben/layouts, @vben/locales, @vben/plugins, @vben/preferences, @vben/request, @vben/stores, @vben/styles, @vben/types, @vben/utils|
|16|@levin/oak-base-admin|5.6.95|5.6.97|直接变更|@levin/admin-framework, @vben/common-ui, @vben/icons, @vben/plugins, @vben/stores|

## 变更文件归属

### @vben/constants

- `packages/constants/package-version.d.mts`
- `packages/constants/package-version.mjs`
- `packages/constants/package.json`

### @vben/icons

- `packages/icons/package-version.d.mts`
- `packages/icons/package-version.mjs`
- `packages/icons/package.json`

### @vben/locales

- `packages/locales/package-version.d.mts`
- `packages/locales/package-version.mjs`
- `packages/locales/package.json`

### @vben/preferences

- `packages/preferences/package-version.d.mts`
- `packages/preferences/package-version.mjs`
- `packages/preferences/package.json`

### @vben/stores

- `packages/stores/package-version.d.mts`
- `packages/stores/package-version.mjs`
- `packages/stores/package.json`

### @vben/styles

- `packages/styles/package-version.d.mts`
- `packages/styles/package-version.mjs`
- `packages/styles/package.json`

### @vben/types

- `packages/types/package-version.d.mts`
- `packages/types/package-version.mjs`
- `packages/types/package.json`

### @vben/utils

- `packages/utils/package-version.d.mts`
- `packages/utils/package-version.mjs`
- `packages/utils/package.json`

### @vben/access

- `packages/effects/access/package-version.d.mts`
- `packages/effects/access/package-version.mjs`
- `packages/effects/access/package.json`

### @vben/hooks

- `packages/effects/hooks/package-version.d.mts`
- `packages/effects/hooks/package-version.mjs`
- `packages/effects/hooks/package.json`

### @vben/request

- `packages/effects/request/package-version.d.mts`
- `packages/effects/request/package-version.mjs`
- `packages/effects/request/package.json`

### @vben/common-ui

- `packages/effects/common-ui/package-version.d.mts`
- `packages/effects/common-ui/package-version.mjs`
- `packages/effects/common-ui/src/ui/profile/__tests__/profile.test.ts`
- `packages/effects/common-ui/package.json`
- `packages/effects/common-ui/src/ui/profile/profile.vue`

### @vben/layouts

- `packages/effects/layouts/package-version.d.mts`
- `packages/effects/layouts/package-version.mjs`
- `packages/effects/layouts/package.json`

### @vben/plugins

- `packages/effects/plugins/package-version.d.mts`
- `packages/effects/plugins/package-version.mjs`
- `packages/effects/plugins/package.json`

### @levin/admin-framework

- `packages/business/admin-framework/docs/frontend-package-versions.md`
- `packages/business/admin-framework/package-version.d.mts`
- `packages/business/admin-framework/package-version.mjs`
- `packages/business/admin-framework/src/framework-commons/app/framework-package-metadata.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-edit-tenant-omission.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-json-schema-actions.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-list-height-settings.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-list-height.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/json-editor-validity.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/json-schema-field-validation.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/crud-json-schema-actions.ts`
- `packages/business/admin-framework/src/framework-commons/shared/crud-list-height.ts`
- `packages/business/admin-framework/src/framework-commons/shared/json-schema-field-validation.ts`
- `packages/business/admin-framework/package.json`
- `packages/business/admin-framework/src/framework-commons/app/__tests__/frontend-build-versions.test.ts`
- `packages/business/admin-framework/src/framework-commons/app/frontend-build-versions.ts`
- `packages/business/admin-framework/src/framework-commons/app/layouts/__tests__/basic-layout-brand.test.ts`
- `packages/business/admin-framework/src/framework-commons/app/layouts/basic.vue`
- `packages/business/admin-framework/src/framework-commons/app/views/_core/authentication/__tests__/register.test.ts`
- `packages/business/admin-framework/src/framework-commons/app/views/_core/authentication/register.vue`
- `packages/business/admin-framework/src/framework-commons/module-contract.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-json-schema-editor.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-page-display.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/json-schema-editor-field.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/json-schema-source.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/page-display-settings-drawer.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/crud-page-display.ts`
- `packages/business/admin-framework/src/framework-commons/shared/crud-page.vue`
- `packages/business/admin-framework/src/framework-commons/shared/json-editor-field.vue`
- `packages/business/admin-framework/src/framework-commons/shared/json-schema-editor-field.vue`
- `packages/business/admin-framework/src/framework-commons/shared/json-schema-form-field.vue`
- `packages/business/admin-framework/src/framework-commons/shared/json-schema-source.ts`
- `packages/business/admin-framework/src/framework-commons/shared/page-display-settings-drawer.vue`
- `packages/business/admin-framework/src/framework-commons/shared/types.ts`

### @levin/oak-base-admin

- `packages/business/oak-base-admin/package-version.d.mts`
- `packages/business/oak-base-admin/package-version.mjs`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/audit-report-service.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/backend-fixed-job-service.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/audit-report/__tests__/config.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/audit-report/config.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/audit-report/index.vue`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/backend-fixed-job/__tests__/config.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/backend-fixed-job/config.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/backend-fixed-job/index.vue`
- `packages/business/oak-base-admin/package.json`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/__tests__/home-route.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/__tests__/routes.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/admin-crud.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/index.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/module.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/config.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/service-plugin/config.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/setting-history-data/config.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/ui-setting/__tests__/config.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/ui-setting/config.ts`

## 交付范围

包含当前前端源码、测试、规则和版本元数据全部变更。npm-packages 与 admin-bootstrap 下的本地构建产物不提交。根目录规则与发布脚本随仓库交付；框架包携带模块使用规范。

## 验证

执行中：全量测试、类型检查、逐包打包清单、标准发布器构建及独立消费者安装、私服反查。

## 最终归属包补充

发布准备新增设计规范打包、README/AGENTS和打包门禁，所有16包均发布；公共脚本和根前端规则随Git交付。

### @vben/constants

- `packages/constants/AGENTS.md`
- `packages/constants/README.md`
- `packages/constants/docs/.gitignore`
- `packages/constants/docs/.npmignore`
- `packages/constants/package-version.d.mts`
- `packages/constants/package-version.mjs`
- `packages/constants/package.json`

### @vben/icons

- `packages/icons/AGENTS.md`
- `packages/icons/README.md`
- `packages/icons/docs/.gitignore`
- `packages/icons/docs/.npmignore`
- `packages/icons/package-version.d.mts`
- `packages/icons/package-version.mjs`
- `packages/icons/package.json`

### @vben/locales

- `packages/locales/AGENTS.md`
- `packages/locales/README.md`
- `packages/locales/docs/.gitignore`
- `packages/locales/docs/.npmignore`
- `packages/locales/package-version.d.mts`
- `packages/locales/package-version.mjs`
- `packages/locales/package.json`

### @vben/preferences

- `packages/preferences/AGENTS.md`
- `packages/preferences/README.md`
- `packages/preferences/docs/.gitignore`
- `packages/preferences/docs/.npmignore`
- `packages/preferences/package-version.d.mts`
- `packages/preferences/package-version.mjs`
- `packages/preferences/package.json`

### @vben/stores

- `packages/stores/AGENTS.md`
- `packages/stores/README.md`
- `packages/stores/docs/.gitignore`
- `packages/stores/docs/.npmignore`
- `packages/stores/package-version.d.mts`
- `packages/stores/package-version.mjs`
- `packages/stores/package.json`

### @vben/styles

- `packages/styles/AGENTS.md`
- `packages/styles/README.md`
- `packages/styles/docs/.gitignore`
- `packages/styles/docs/.npmignore`
- `packages/styles/package-version.d.mts`
- `packages/styles/package-version.mjs`
- `packages/styles/package.json`

### @vben/types

- `packages/types/AGENTS.md`
- `packages/types/README.md`
- `packages/types/docs/.gitignore`
- `packages/types/docs/.npmignore`
- `packages/types/package-version.d.mts`
- `packages/types/package-version.mjs`
- `packages/types/package.json`

### @vben/utils

- `packages/utils/AGENTS.md`
- `packages/utils/README.md`
- `packages/utils/docs/.gitignore`
- `packages/utils/docs/.npmignore`
- `packages/utils/package-version.d.mts`
- `packages/utils/package-version.mjs`
- `packages/utils/package.json`

### @vben/access

- `packages/effects/access/AGENTS.md`
- `packages/effects/access/README.md`
- `packages/effects/access/docs/.gitignore`
- `packages/effects/access/docs/.npmignore`
- `packages/effects/access/package-version.d.mts`
- `packages/effects/access/package-version.mjs`
- `packages/effects/access/package.json`

### @vben/hooks

- `packages/effects/hooks/AGENTS.md`
- `packages/effects/hooks/README.md`
- `packages/effects/hooks/docs/.gitignore`
- `packages/effects/hooks/docs/.npmignore`
- `packages/effects/hooks/package-version.d.mts`
- `packages/effects/hooks/package-version.mjs`
- `packages/effects/hooks/package.json`

### @vben/request

- `packages/effects/request/AGENTS.md`
- `packages/effects/request/README.md`
- `packages/effects/request/docs/.gitignore`
- `packages/effects/request/docs/.npmignore`
- `packages/effects/request/package-version.d.mts`
- `packages/effects/request/package-version.mjs`
- `packages/effects/request/package.json`

### @vben/common-ui

- `packages/effects/common-ui/AGENTS.md`
- `packages/effects/common-ui/README.md`
- `packages/effects/common-ui/docs/.gitignore`
- `packages/effects/common-ui/docs/.npmignore`
- `packages/effects/common-ui/package-version.d.mts`
- `packages/effects/common-ui/package-version.mjs`
- `packages/effects/common-ui/package.json`
- `packages/effects/common-ui/src/ui/profile/__tests__/profile.test.ts`
- `packages/effects/common-ui/src/ui/profile/profile.vue`

### @vben/layouts

- `packages/effects/layouts/AGENTS.md`
- `packages/effects/layouts/README.md`
- `packages/effects/layouts/docs/.gitignore`
- `packages/effects/layouts/docs/.npmignore`
- `packages/effects/layouts/package-version.d.mts`
- `packages/effects/layouts/package-version.mjs`
- `packages/effects/layouts/package.json`

### @vben/plugins

- `packages/effects/plugins/AGENTS.md`
- `packages/effects/plugins/README.md`
- `packages/effects/plugins/docs/.gitignore`
- `packages/effects/plugins/docs/.npmignore`
- `packages/effects/plugins/package-version.d.mts`
- `packages/effects/plugins/package-version.mjs`
- `packages/effects/plugins/package.json`

### @levin/admin-framework

- `packages/business/admin-framework/AGENTS.md`
- `packages/business/admin-framework/README.md`
- `packages/business/admin-framework/docs/.gitignore`
- `packages/business/admin-framework/docs/.npmignore`
- `packages/business/admin-framework/docs/frontend-package-versions.md`
- `packages/business/admin-framework/package-version.d.mts`
- `packages/business/admin-framework/package-version.mjs`
- `packages/business/admin-framework/package.json`
- `packages/business/admin-framework/src/framework-commons/app/__tests__/frontend-build-versions.test.ts`
- `packages/business/admin-framework/src/framework-commons/app/framework-package-metadata.ts`
- `packages/business/admin-framework/src/framework-commons/app/frontend-build-versions.ts`
- `packages/business/admin-framework/src/framework-commons/app/layouts/__tests__/basic-layout-brand.test.ts`
- `packages/business/admin-framework/src/framework-commons/app/layouts/basic.vue`
- `packages/business/admin-framework/src/framework-commons/app/views/_core/authentication/__tests__/register.test.ts`
- `packages/business/admin-framework/src/framework-commons/app/views/_core/authentication/register.vue`
- `packages/business/admin-framework/src/framework-commons/module-contract.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-content-spacing.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-edit-tenant-omission.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-json-schema-actions.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-json-schema-editor.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-list-height-settings.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-list-height.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-page-display.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/json-editor-validity.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/json-schema-editor-field.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/json-schema-field-validation.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/json-schema-source.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/page-display-settings-drawer.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/script-workbench-dialog.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/crud-json-schema-actions.ts`
- `packages/business/admin-framework/src/framework-commons/shared/crud-list-height.ts`
- `packages/business/admin-framework/src/framework-commons/shared/crud-page-display.ts`
- `packages/business/admin-framework/src/framework-commons/shared/crud-page.vue`
- `packages/business/admin-framework/src/framework-commons/shared/json-editor-field.vue`
- `packages/business/admin-framework/src/framework-commons/shared/json-schema-editor-field.vue`
- `packages/business/admin-framework/src/framework-commons/shared/json-schema-field-validation.ts`
- `packages/business/admin-framework/src/framework-commons/shared/json-schema-form-field.vue`
- `packages/business/admin-framework/src/framework-commons/shared/json-schema-source.ts`
- `packages/business/admin-framework/src/framework-commons/shared/page-display-settings-drawer.vue`
- `packages/business/admin-framework/src/framework-commons/shared/types.ts`

### @levin/oak-base-admin

- `packages/business/oak-base-admin/AGENTS.md`
- `packages/business/oak-base-admin/README.md`
- `packages/business/oak-base-admin/docs/.gitignore`
- `packages/business/oak-base-admin/docs/.npmignore`
- `packages/business/oak-base-admin/package-version.d.mts`
- `packages/business/oak-base-admin/package-version.mjs`
- `packages/business/oak-base-admin/package.json`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/__tests__/home-route.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/__tests__/routes.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/admin-crud.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/audit-report-service.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/backend-fixed-job-service.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/index.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/module.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/__tests__/form-layout-coordination.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/__tests__/json-field-layout.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/audit-report/__tests__/config.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/audit-report/config.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/audit-report/index.vue`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/backend-fixed-job/__tests__/config.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/backend-fixed-job/config.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/backend-fixed-job/index.vue`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/dict/__tests__/config.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/domain/__tests__/config.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/file-res/config.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/config.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/open-area/__tests__/config.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/service-plugin/config.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/setting-history-data/config.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/traffic-control-rule/__tests__/config.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/ui-setting/__tests__/config.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/ui-setting/config.ts`

## 验证结果

前端全量1461项测试中1458项首轮通过，3项并行资源超时在降低并发后复测通过（相关36项通过）。类型检查通过，发布脚本ESLint通过。bootstrap-app生产构建成功并生成dist.zip。所有发布入口引用均有实际文件；锁文件已同步。逐包源变更pack预检初轮零缺失；文档及最终私服包核对结果待发布完成追加。

## 最终发布核验

16包全部发布成功；标准发布器完成独立消费者安装及私服tarball反查。每包参考资料的清单与SHA-256全部通过；本批源文件、规范和README等逐路径检查无缺失、无内容差异。每个精确版本均npm view反查成功。

|包|发布版本|参考资料数|tarball文件数|关键文件核对|
|---|---|---|---|---|
|@vben/constants|5.6.9|1040|1055|通过|
|@vben/icons|5.6.10|1040|1097|通过|
|@vben/locales|5.6.17|1040|1081|通过|
|@vben/preferences|5.6.13|1040|1052|通过|
|@vben/stores|5.6.11|1040|1079|通过|
|@vben/styles|5.6.9|1040|1062|通过|
|@vben/types|5.6.9|1040|1056|通过|
|@vben/utils|5.6.10|1040|1091|通过|
|@vben/access|5.6.11|1040|1068|通过|
|@vben/hooks|5.6.11|1040|1076|通过|
|@vben/request|5.6.11|1040|1088|通过|
|@vben/common-ui|5.6.14|1040|1367|通过|
|@vben/layouts|5.6.26|1040|1459|通过|
|@vben/plugins|5.6.13|1040|1090|通过|
|@levin/admin-framework|5.6.95|1045|2018|通过|
|@levin/oak-base-admin|5.6.97|1045|2137|通过|

发布过程中检测到并行任务继续调整当前页面路由设置，已补测89项及类型检查，并补发框架5.6.95和Oak5.6.97；先前5.6.94/5.6.96是中间版本。资料为每包构建时的设计快照，后续任务完成状态在Git记录。
