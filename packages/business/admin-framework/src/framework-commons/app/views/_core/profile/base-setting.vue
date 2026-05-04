<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { Button, Divider, Form, Input, Typography, message } from 'ant-design-vue';

import { getUserInfoApi, updateLoginInfoApi } from '@levin/admin-framework/framework-commons/app/api';

const saving = ref(false);
const userStore = useUserStore();
const form = reactive({
  name: '',
  signature: '',
});

const currentUser = computed(() => userStore.userInfo as Record<string, any>);
const displayLoginName = computed(() => displayText(currentUser.value?.loginName));
const displayTelephone = computed(() =>
  displayText(
    currentUser.value?.telephone ||
      currentUser.value?.mobile ||
      currentUser.value?.phone,
  ),
);
const displayEmail = computed(() => displayText(currentUser.value?.email));

function displayText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || '未设置';
}

function applyUserToForm(data: Record<string, any>) {
  form.name = String(data.realName || data.name || '').trim();
  form.signature = String(data.signature || data.introduction || '').trim();
}

async function refreshUserInfo() {
  const data = await getUserInfoApi();
  userStore.setUserInfo(data);
  applyUserToForm(data);
}

async function handleSubmit() {
  if (saving.value) {
    return;
  }

  try {
    saving.value = true;
    await updateLoginInfoApi({
      newName: form.name.trim(),
      signature: form.signature,
    });
    await refreshUserInfo();
    message.success('基本信息已更新');
  } finally {
    saving.value = false;
  }
}

onMounted(refreshUserInfo);
</script>

<template>
  <div class="profile-base-setting">
    <section class="rounded-lg border border-border p-4">
      <div class="mb-3 text-sm font-medium text-muted-foreground">
        账号信息
      </div>
      <div class="grid gap-3 md:grid-cols-3">
        <div>
          <div class="text-xs text-muted-foreground">登录名</div>
          <Typography.Text class="mt-1 block text-foreground">
            {{ displayLoginName }}
          </Typography.Text>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">手机号</div>
          <Typography.Text class="mt-1 block text-foreground">
            {{ displayTelephone }}
          </Typography.Text>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">邮箱</div>
          <Typography.Text class="mt-1 block text-foreground">
            {{ displayEmail }}
          </Typography.Text>
        </div>
      </div>
    </section>

    <Divider class="my-5" />

    <Form layout="vertical" class="max-w-2xl" @submit.prevent="handleSubmit">
      <Form.Item label="名称">
        <Input
          v-model:value="form.name"
          allow-clear
          placeholder="请输入名称"
        />
      </Form.Item>

      <Form.Item label="个人简介">
        <Input.TextArea
          v-model:value="form.signature"
          :auto-size="{ minRows: 3, maxRows: 6 }"
          allow-clear
          placeholder="请输入个人简介"
        />
      </Form.Item>

      <Button type="primary" :loading="saving" @click="handleSubmit">
        更新基本信息
      </Button>
    </Form>
  </div>
</template>

<style scoped>
.profile-base-setting {
  width: min(100%, 760px);
}
</style>
