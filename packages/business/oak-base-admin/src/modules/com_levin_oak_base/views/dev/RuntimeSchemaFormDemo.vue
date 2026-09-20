<script lang="ts" setup>
import { ref } from 'vue';

import JsonSchemaFormField from '@levin/admin-framework/framework-commons/shared/json-schema-form-field.vue';

const value = ref({
  apiEndpoint: 'https://api.example.com',
  auth: { token: '' },
  callback: { retryCount: 3, url: '' },
  endpoints: [],
  mode: 'managed',
  plan: 'free',
});

const schema = {
  properties: {
    apiEndpoint: {
      description: '供应商 API 的基础访问地址。',
      title: 'API 端点',
      type: 'string',
    },
    auth: {
      description: '访问供应商接口所需的认证信息。',
      properties: {
        token: {
          format: 'password',
          title: 'API Token',
          type: 'string',
          writeOnly: true,
        },
      },
      required: ['token'],
      title: '认证信息',
      type: 'object',
    },
    callback: {
      properties: {
        retryCount: { minimum: 0, title: '重试次数', type: 'integer' },
        url: { title: '回调地址', type: 'string' },
      },
      title: '回调配置',
      type: 'object',
    },
    endpoints: {
      items: {
        properties: {
          name: { title: '名称', type: 'string' },
          url: { title: '地址', type: 'string' },
        },
        type: 'object',
      },
      title: '备用端点',
      type: 'array',
    },
    mode: {
      oneOf: [
        { const: 'managed', title: '托管模式' },
        { const: 'custom', title: '自定义模式' },
      ],
      title: '运行模式',
    },
    plan: {
      description: '当前供应商套餐。',
      enum: ['free', 'team', 'enterprise'],
      title: '套餐',
      type: 'string',
    },
  },
  required: ['apiEndpoint'],
  title: '运行时动态配置',
  type: 'object',
};
</script>

<template>
  <div class="mx-auto max-w-5xl p-6">
    <div class="mb-6">
      <h1 class="text-xl font-semibold">运行时动态表单测试</h1>
      <p class="text-muted-foreground mt-2">
        本页仅使用固定 JSON Schema 验证公共表单组件，不读取或写入业务配置。
      </p>
    </div>

    <JsonSchemaFormField v-model="value" :schema="schema" inline />
  </div>
</template>
