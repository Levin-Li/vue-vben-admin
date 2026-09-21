<script lang="ts" setup>
import { AuthenticationQrCodeLogin } from '@vben/common-ui';
import { LOGIN_PATH } from '@vben/runtime/constants';

defineOptions({ name: 'QrCodeLogin' });
</script>

<template>
  <AuthenticationQrCodeLogin :login-path="LOGIN_PATH" />
</template>
