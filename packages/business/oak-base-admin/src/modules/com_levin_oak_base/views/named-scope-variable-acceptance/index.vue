<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { Alert, Button, Card, Form, Select } from 'ant-design-vue';

import { oakBaseGet, oakBasePost } from '../../api/_module';

type ScopeValues = {
  domainId?: string;
  orgId?: string;
  ownerId?: string;
  tenantId?: string;
};

type ScopeOption = { label: string; value: string };

const loading = ref(false);
const loadingOptions = ref(false);
const error = ref('');
const result = ref('');
const options = reactive<Record<keyof ScopeValues, ScopeOption[]>>({
  domainId: [],
  orgId: [],
  ownerId: [],
  tenantId: [],
});
const values = reactive<ScopeValues>({});

function normalizeOptions(payload: any): ScopeOption[] {
  const list = payload?.data?.items || payload?.items || payload?.data || payload || [];
  return Array.isArray(list)
    ? list.map((item) => ({
        label: String(item.name || item.nickname || item.account || item.id),
        value: String(item.id),
      }))
    : [];
}

async function loadOptions() {
  loadingOptions.value = true;
  error.value = '';
  try {
    // 候选始终通过真实管理接口加载；前端不根据名称或当前表单推断授权范围。
    const [tenants, domains, orgs, users] = await Promise.all([
      oakBaseGet('/Tenant/list', { params: { pageIndex: 1, pageSize: 100 } }),
      oakBaseGet('/PlatformDomain/list', {
        params: { pageIndex: 1, pageSize: 100, state: 'Published' },
      }),
      oakBaseGet('/Org/list', { params: { pageIndex: 1, pageSize: 100 } }),
      oakBaseGet('/User/list', { params: { pageIndex: 1, pageSize: 100 } }),
    ]);
    options.tenantId = normalizeOptions(tenants);
    options.domainId = normalizeOptions(domains);
    options.orgId = normalizeOptions(orgs);
    options.ownerId = normalizeOptions(users);
  } catch (cause: unknown) {
    error.value = cause instanceof Error ? cause.message : '加载候选失败。';
  } finally {
    loadingOptions.value = false;
  }
}

async function submit() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  result.value = '';
  try {
    // submitted* 保留浏览器显式参数；同名顶层字段由后端 @InjectVar 实际改写或回退。
    const scope = { ...values };
    const response: any = await oakBasePost('/namedScopeVariableAcceptance/echo', {
      ...scope,
      submittedDomainId: scope.domainId,
      submittedOrgId: scope.orgId,
      submittedOwnerId: scope.ownerId,
      submittedOwnerIdList: scope.ownerIdList,
      submittedTenantId: scope.tenantId,
    });
    result.value = JSON.stringify(response?.data ?? response, null, 2);
  } catch (cause: unknown) {
    error.value = cause instanceof Error ? cause.message : '验收请求失败。';
  } finally {
    loading.value = false;
  }
}

function clearExplicitValues() {
  values.tenantId = undefined;
  values.domainId = undefined;
  values.orgId = undefined;
  values.ownerId = undefined;
  result.value = '';
  error.value = '';
}

onMounted(loadOptions);
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card title="具名数据范围变量真实验收">
      <Alert
        class="mb-4"
        show-icon
        type="info"
        message="本页只在非生产环境可用。顶部全局领域、组织和用户选择器会自动写入 X-Oak Header；本表单的显式选择用于验证原值优先。"
      />
      <Form layout="vertical" class="grid gap-x-4 md:grid-cols-2">
        <Form.Item label="显式租户">
          <Select
            v-model:value="values.tenantId"
            allow-clear
            show-search
            :filter-option="true"
            :loading="loadingOptions"
            :options="options.tenantId"
            placeholder="不选时可验证 Header / Host 回退"
          />
        </Form.Item>
        <Form.Item label="显式平台领域">
          <Select
            v-model:value="values.domainId"
            allow-clear
            show-search
            :filter-option="true"
            :loading="loadingOptions"
            :options="options.domainId"
            placeholder="不选时使用顶部全局领域 Header"
          />
        </Form.Item>
        <Form.Item label="显式组织">
          <Select
            v-model:value="values.orgId"
            allow-clear
            show-search
            :filter-option="true"
            :loading="loadingOptions"
            :options="options.orgId"
            placeholder="不选时使用顶部全局组织 Header"
          />
        </Form.Item>
        <Form.Item label="显式个人">
          <Select
            v-model:value="values.ownerId"
            allow-clear
            show-search
            :filter-option="true"
            :loading="loadingOptions"
            :options="options.ownerId"
            placeholder="不选时使用顶部全局用户 Header"
          />
        </Form.Item>
      </Form>
      <div class="flex flex-wrap gap-3">
        <Button :loading="loadingOptions" @click="loadOptions">刷新候选</Button>
        <Button :disabled="loading" @click="clearExplicitValues">清空显式参数</Button>
        <Button type="primary" :loading="loading" @click="submit">提交并查看最终解析值</Button>
      </div>
    </Card>
    <Alert v-if="error" show-icon type="error" :message="error" />
    <Card v-if="result" title="后端真实解析结果">
      <p class="text-muted-foreground mb-3">
        对比 submitted、headers 和 resolved：同维度显式参数应优先；显式为空时才会使用经服务端授权的 Header 候选。
      </p>
      <pre class="max-h-96 overflow-auto whitespace-pre-wrap break-all">{{ result }}</pre>
    </Card>
  </div>
</template>
