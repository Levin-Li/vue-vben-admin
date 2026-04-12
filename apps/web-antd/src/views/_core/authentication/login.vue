<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed } from 'vue';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: '请输入登录账号/手机号/邮箱',
      },
      fieldName: 'account',
      label: '账号',
      rules: z.string().min(1, { message: '请输入登录账号' }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: '请输入登录密码',
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
    {
      component: 'VbenSelect',
      componentProps: {
        allowClear: true,
        options: [
          { label: '图片验证码', value: 'Captcha' },
          { label: '短信验证码', value: 'Sms' },
          { label: '邮箱验证码', value: 'Email' },
          { label: 'MFA', value: 'Mfa' },
        ],
        placeholder: '可选，按租户登录策略填写',
      },
      fieldName: 'verifyCodeType',
      label: '验证码类型',
      rules: z.string().optional(),
    },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: '可选，启用验证码登录时填写',
      },
      fieldName: 'verifyCode',
      label: '验证码',
      rules: z.string().optional(),
    },
  ];
});
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    @submit="authStore.authLogin"
  />
</template>
