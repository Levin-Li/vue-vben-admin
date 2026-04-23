<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, ref } from 'vue';

import { ProfilePasswordSetting, z } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { updateLoginInfoApi } from '#/api';

const passwordSettingRef = ref();
const saving = ref(false);

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      fieldName: 'oldPwd',
      label: '旧密码',
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: '请输入旧密码',
      },
    },
    {
      fieldName: 'newPwd',
      label: '新密码',
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: '请输入新密码',
      },
      rules: z
        .string({ required_error: '请输入新密码' })
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/, {
          message: '密码必须包含数字和大小写字母且长度不少于6',
        }),
    },
    {
      fieldName: 'confirmPassword',
      label: '确认密码',
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: '请再次输入新密码',
      },
      dependencies: {
        rules(values) {
          const { newPwd } = values;
          return z
            .string({ required_error: '请再次输入新密码' })
            .min(1, { message: '请再次输入新密码' })
            .refine((value) => value === newPwd, {
              message: '两次输入的密码不一致',
            });
        },
        triggerFields: ['newPwd'],
      },
    },
  ];
});

async function handleSubmit(values: Record<string, string>) {
  if (saving.value) {
    return;
  }

  try {
    saving.value = true;
    await updateLoginInfoApi({
      newPwd: values.newPwd,
      oldPwd: values.oldPwd,
    });
    message.success('密码修改成功');
    await passwordSettingRef.value?.getFormApi()?.resetForm();
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <ProfilePasswordSetting
    ref="passwordSettingRef"
    class="w-full max-w-xl"
    :form-schema="formSchema"
    @submit="handleSubmit"
  />
</template>
