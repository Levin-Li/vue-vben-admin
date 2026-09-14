<script setup lang="ts">
import type { AclTestKind } from '../../api/acl-test-service';

import { onDeactivated, onUnmounted, ref } from 'vue';

import { Alert, Button, Card, Input, Select } from 'ant-design-vue';

import { aclTestService } from '../../api/acl-test-service';
import { pageMeta } from './config';
import { createAclSignatureHeaders } from './signature';

const body = ref('{\n  "message": "访问控制测试"\n}');
const appId = ref('');
const secret = ref('');
const signMode = ref('valid');
const busy = ref<'' | AclTestKind>('');
const result = ref('');
const error = ref('');
const outcome = ref('');
const buttons: { key: AclTestKind; label: string }[] = [
  { key: 'sms', label: '短信验证码' },
  { key: 'email', label: '邮箱验证码' },
  { key: 'mfa', label: 'MFA 验证' },
  { key: 'hmi', label: '行为验证码' },
  { key: 'sign', label: '签名验证' },
];
function clearSecret() {
  secret.value = '';
}
onDeactivated(clearSecret);
onUnmounted(clearSecret);

async function run(kind: AclTestKind) {
  if (busy.value) return;
  error.value = '';
  result.value = '';
  outcome.value = '';
  try {
    JSON.parse(body.value);
  } catch {
    error.value = '请输入有效 JSON。';
    return;
  }
  if (kind === 'sign' && (!appId.value.trim() || !secret.value)) {
    error.value = '请先输入应用 ID 和签名密钥。';
    return;
  }
  busy.value = kind;
  try {
    // 先固定正文，避免挑战期间编辑影响签名或重放内容。
    const payload = JSON.stringify(JSON.parse(body.value));
    let response: unknown;
    if (kind === 'sign') {
      const headers = await createAclSignatureHeaders({
        appId: appId.value.trim(),
        secret: secret.value,
        body: payload,
      });
      if (signMode.value === 'invalid') {
        headers['X-UrlAcl-Signature'] =
          `${headers['X-UrlAcl-Signature'][0] === '0' ? '1' : '0'}${headers['X-UrlAcl-Signature'].slice(1)}`;
      }
      response = await aclTestService.sign(payload, headers);
    } else {
      response = await aclTestService[kind](payload);
    }
    result.value = JSON.stringify(response, null, 2);
    outcome.value =
      kind === 'sign' && signMode.value === 'invalid'
        ? '错误签名被放行：请检查访问控制规则是否启用并命中。'
        : '请求已通过，以下是服务端回显。';
  } catch (error_: unknown) {
    error.value =
      error_ instanceof Error
        ? error_.message
        : '请求失败，请查看服务端错误提示。';
  } finally {
    busy.value = '';
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card :title="pageMeta.title">
      <p class="text-muted-foreground mb-4">
        {{ pageMeta.description }}
        短信和邮箱使用测试环境模拟码，收到验证码后仍需手动输入。
      </p>
      <label for="acl-test-body" class="mb-2 block">请求内容（JSON）</label>
      <Input.TextArea
        id="acl-test-body"
        v-model:value="body"
        :rows="6"
        :disabled="!!busy"
      />
      <div class="mt-4 flex flex-wrap gap-3">
        <Button
          v-for="button in buttons"
          :key="button.key"
          :loading="busy === button.key"
          :disabled="!!busy && busy !== button.key"
          type="primary"
          @click="run(button.key)"
        >
          {{ button.label }}
        </Button>
      </div>
    </Card>
    <Card title="签名测试凭据">
      <div class="grid gap-4 md:grid-cols-3">
        <div>
          <label for="acl-app-id" class="mb-2 block">应用 ID</label>
          <Input
            id="acl-app-id"
            v-model:value="appId"
            :disabled="!!busy"
            autocomplete="off"
          />
        </div>
        <div>
          <label for="acl-app-secret" class="mb-2 block">签名密钥</label>
          <Input.Password
            id="acl-app-secret"
            v-model:value="secret"
            :disabled="!!busy"
            autocomplete="off"
          />
        </div>
        <div>
          <label for="acl-sign-mode" class="mb-2 block">签名场景</label>
          <Select
            id="acl-sign-mode"
            v-model:value="signMode"
            class="w-full"
            :disabled="!!busy"
            :options="[
              { label: '正确签名', value: 'valid' },
              { label: '错误签名（预期拒绝）', value: 'invalid' },
            ]"
          />
        </div>
      </div>
      <p class="text-muted-foreground mt-3">
        应用 ID 请填写客户端应用的主键 ID。密钥仅用于本页面临时签名，离开页面后清空。
      </p>
    </Card>
    <Alert v-if="error" type="error" show-icon :message="error" />
    <Card v-if="result" title="服务端回显">
      <p class="mb-3" role="status">{{ outcome }}</p>
      <pre class="max-h-96 overflow-auto whitespace-pre-wrap break-all">{{
        result
      }}</pre>
    </Card>
  </div>
</template>
