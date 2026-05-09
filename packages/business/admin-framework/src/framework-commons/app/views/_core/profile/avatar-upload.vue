<script setup lang="ts">
import { computed, ref } from 'vue';

import { preferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import {
  getUserInfoApi,
  updateLoginInfoApi,
} from '@levin/admin-framework/framework-commons/app/api';
import { uploadFileByFileStorageController } from '@levin/admin-framework/framework-commons/app/api/file-storage-service';

const fileInputRef = ref<HTMLInputElement>();
const uploading = ref(false);
const userStore = useUserStore();

const avatarUrl = computed(
  () => userStore.userInfo?.avatar || preferences.app.defaultAvatar,
);
const avatarText = computed(() => {
  const name =
    userStore.userInfo?.realName ||
    userStore.userInfo?.username ||
    userStore.userInfo?.loginName ||
    '用户';
  return String(name).trim().slice(0, 2).toUpperCase();
});
const imageLoadFailed = ref(false);

function openFilePicker() {
  if (uploading.value) {
    return;
  }

  fileInputRef.value?.click();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';

  if (!file) {
    return;
  }

  if (!file.type.startsWith('image/')) {
    message.warning('请选择图片文件');
    return;
  }

  try {
    uploading.value = true;
    const avatar = await uploadFileByFileStorageController(file);
    await updateLoginInfoApi({ avatar });
    const nextUserInfo = await getUserInfoApi();
    imageLoadFailed.value = false;
    userStore.setUserInfo(nextUserInfo);
    message.success('头像已更新');
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <button
    :disabled="uploading"
    class="bg-muted text-muted-foreground ring-offset-background hover:ring-primary/50 focus-visible:ring-primary group relative flex size-20 items-center justify-center overflow-hidden rounded-full text-sm font-medium outline-none transition hover:ring-2 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-70"
    title="点击上传头像"
    type="button"
    @click="openFilePicker"
  >
    <img
      v-if="avatarUrl && !imageLoadFailed"
      :src="avatarUrl"
      alt="头像"
      class="size-full object-cover"
      @error="imageLoadFailed = true"
    />
    <span v-else>{{ avatarText }}</span>
    <span
      class="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100"
    >
      {{ uploading ? '上传中' : '上传' }}
    </span>
  </button>
  <input
    ref="fileInputRef"
    accept="image/*"
    class="hidden"
    type="file"
    @change="handleFileChange"
  />
</template>
