# 通用行为验证码组件

`BehaviorCaptcha` 是 `@levin/admin-framework` 的公开通用组件，登录和 API 二次验证共用同一实现。不要复制题面、轨迹收集或操作提示到业务页面。

普通业务页面只需使用公共请求客户端；后端配置 URL ACL 后，公共请求层自动打开验证弹窗。以下直接使用方式适用于登录页或专用验证入口。

```vue
<script setup lang="ts">
import { BehaviorCaptcha, normalizeBehaviorCaptchaChallenge } from '@levin/admin-framework';
import { ref } from 'vue';

const challenge = ref<ReturnType<typeof normalizeBehaviorCaptchaChallenge>>(null);
const loading = ref(false);
// 接口返回后使用 normalizeBehaviorCaptchaChallenge(data) 设置 challenge。
// refresh 重新申请题面；complete 将验证数据交给对应的后端验证流程。
</script>

<template>
  <BehaviorCaptcha
    :challenge="challenge"
    :loading="loading"
    @refresh="loadChallenge"
    @complete="submitVerification"
  />
</template>
```

示例中的 `loadChallenge`、`submitVerification` 由登录或公共验证流程接入实际 API，不能用本地判断代替后端校验。

- 输入：`challenge`（规范化题面或 null）、`loading`。
- 事件：`refresh`、`complete(verifyCode)`；后者包含原有题面 ID、答案和轨迹，不更改验证协议。
- 支持：点选、成语点选、滑块拼图和障碍躲避。
- 操作指引：优先使用后端 `instruction`，规范化为 `challenge.prompt`；前端不自行拼接模式文案，缺失时应由服务端补齐。
- 文字指令位于题面原生头部，与提示图同区显示：指令告诉用户怎样操作，提示图告诉用户依次选择哪些目标。文本安全转义，不渲染任意 HTML。
- 公共验证弹窗不再重复显示“Api接口需要……才能调用”；短信/邮箱发送状态、测试码和错误提示仍保留。
