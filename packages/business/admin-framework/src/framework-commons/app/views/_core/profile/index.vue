<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Profile } from '@vben/common-ui';
import { useUserStore } from '@vben/runtime/stores';

import { mustChangeInitialPassword } from '../../../initial-password';
import ProfileAvatarUpload from './avatar-upload.vue';
import ProfileBase from './base-setting.vue';
import ProfileNotificationSetting from './notification-setting.vue';
import { hasPendingBindCallback } from './oauth-bind-callback';
import ProfilePasswordSetting from './password-setting.vue';
import ProfileSecuritySetting from './security-setting.vue';
import ProfileSocialAccountSetting from './social-account-setting.vue';

// 全局弹窗与独立个人页均在合法回调到达时挂载绑定面板。
const props = defineProps<{
  initialTab?: 'basic' | 'password' | 'social-account';
}>();

const userStore = useUserStore();
const route = useRoute();
const initialPasswordRequired = computed(() =>
  mustChangeInitialPassword(userStore.userInfo),
);

const tabsValue = ref<string>(
  initialPasswordRequired.value || route.query.tab === 'password'
    ? 'password'
    : props.initialTab ||
        (hasPendingBindCallback() ? 'social-account' : 'basic'),
);

const normalTabs = [
  {
    label: '基本设置',
    value: 'basic',
  },
  {
    label: '安全设置',
    value: 'security',
  },
  {
    label: '第三方账号绑定',
    value: 'social-account',
  },
  {
    label: '修改密码',
    value: 'password',
  },
  {
    label: '新消息提醒',
    value: 'notice',
  },
];
const tabs = computed(() =>
  initialPasswordRequired.value
    ? normalTabs.filter((item) => item.value === 'password')
    : normalTabs,
);
</script>
<template>
  <Profile
    v-model:model-value="tabsValue"
    title="个人中心"
    :user-info="userStore.userInfo"
    :tabs="tabs"
  >
    <template #avatar>
      <ProfileAvatarUpload />
    </template>
    <template #content>
      <ProfileBase v-if="tabsValue === 'basic'" />
      <ProfileSecuritySetting v-if="tabsValue === 'security'" />
      <ProfileSocialAccountSetting v-if="tabsValue === 'social-account'" />
      <ProfilePasswordSetting v-if="tabsValue === 'password'" />
      <ProfileNotificationSetting v-if="tabsValue === 'notice'" />
    </template>
  </Profile>
</template>
