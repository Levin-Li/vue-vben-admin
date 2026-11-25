<script setup lang="ts">
import { ref } from 'vue';
import { Button, ConfigProvider } from 'ant-design-vue';
import { useUserStore } from '../packages/runtime/src/vendor/stores/modules/user';
import { setAdminFrameworkRuntime } from '../packages/business/admin-framework/src/framework-commons/runtime';
import type { ReportRuntimePage } from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/report-view/report-runtime';
import type { ReportManagementInfo, ReportPageDesign, ReportSourceCatalog } from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/report-definition-management-service';
import ReportRuntimeView from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/report-view/report-runtime-view.vue';
import ReportDesignEditor from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/report-center/report-design-editor.vue';
import ReportCenter from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/report-center/index.vue';
import ResourcePermissionDialog from '@report-role-dialog';
import { isGeneratedReportMenuPath } from '../packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/report-center/report-menu-permission';
import { setRoleFixtureSession } from './role-rbac';

const parameters = new URLSearchParams(location.search);
const reportId = parameters.get('reportId') || '';
const tokenHeader = parameters.get('tokenHeader') || '';
const page = ref<ReportRuntimePage>();
const error = ref('');
const notice = ref('');
const draft = ref<ReportManagementInfo>();
const design = ref<ReportPageDesign>();
const catalog = ref<ReportSourceCatalog>();
const managing = ref(false);
const roleOpen = ref(false);
const user = useUserStore();
let token = '';
setAdminFrameworkRuntime({ requestClient: {
  async request(path: string, options: { method?: string; data?: unknown; params?: Record<string, string> }) {
    const suffix = options.params ? `?${new URLSearchParams(options.params)}` : '';
    const response = await fetch(`/isolated-api${path}${suffix}`, { method: options.method || 'GET', credentials: 'omit',
      headers: { 'Content-Type': 'application/json', [tokenHeader]: token },
      ...(options.data === undefined ? {} : { body: JSON.stringify(options.data) }) });
    if (!response.ok) throw new Error(`请求失败 (${response.status})`);
    return (await response.json()).data;
  },
} as any });
const loadRole = () => get('fixture/role');
const saveRole = (changes: { permissions: string[] }) => post('fixture/role', { permissions: changes.permissions });
async function post(path: string, data: object, authenticated = true) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authenticated) headers[tokenHeader] = token;
  const response = await fetch(`/isolated-api/com.levin.oak.base/V1/api/${path}`, {
    method: 'POST', headers, credentials: 'omit', body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`请求失败 (${response.status})`);
  const result = await response.json();
  return result.data;
}
async function get(path: string) {
  const response = await fetch(`/isolated-api/com.levin.oak.base/V1/api/${path}`, { headers: { [tokenHeader]: token }, credentials: 'omit' });
  if (!response.ok) throw new Error(`请求失败 (${response.status})`);
  return (await response.json()).data;
}
async function login() {
  try {
    const result = await post('rbac/login', { account: 'fixture-user', password: 'fixture-password' }, false);
    token = result.accessToken;
    setRoleFixtureSession(tokenHeader, token);
    user.setUserInfo({ userId: 'actor', id: 'actor', username: 'fixture-user', realName: '虚构用户', avatar: '',
      tenantId: 'tenant-1', orgId: 'org-1', isSuperAdmin: true });
    page.value = await post('ReportDefinition/use/page', { reportId });
  } catch (cause) { error.value = String(cause); }
}
async function edit() {
  try {
    error.value = ''; notice.value = '';
    catalog.value = await get('ReportDefinitionManagement/catalog');
    draft.value = await post('ReportDefinitionManagement/getDraft', { reportId });
    design.value = draft.value?.draft || undefined;
    if (!design.value) throw new Error('草稿不可用');
  } catch (cause) { error.value = String(cause); }
}
async function publish() {
  if (!draft.value || !design.value) return;
  try {
    error.value = '';
    await post('ReportDefinitionManagement/saveDraft', { reportId, expectedLock: draft.value.optimisticLock,
      expectedDefinitionVersion: draft.value.definitionVersion, name: draft.value.name, menuId: draft.value.menuId, design: design.value });
    draft.value = await post('ReportDefinitionManagement/getDraft', { reportId });
    await post('ReportDefinitionManagement/publish', { reportId, expectedLock: draft.value?.optimisticLock,
      expectedDefinitionVersion: draft.value?.definitionVersion });
    page.value = await post('ReportDefinition/use/page', { reportId });
    design.value = undefined; notice.value = '保存并发布成功';
  } catch (cause) { error.value = String(cause); }
}
function query(componentId: string, params: Readonly<Record<string, string>>) {
  return post('ReportDefinition/use/query', { reportId, componentId, parameters: params });
}
function exportComponent(componentId: string, params: Readonly<Record<string, string>>) {
  return post('ReportDefinition/use/export', { reportId, componentId, parameters: params });
}
</script>
<template>
  <ConfigProvider>
    <p>隔离认证验收 · 仅使用临时虚构数据</p>
    <Button v-if="!page" @click="login">登录并查看报表</Button>
    <Button v-if="page && !design" @click="managing = !managing">{{ managing ? '返回运行页' : '打开报表管理' }}</Button>
    <Button v-if="page" @click="roleOpen = true">配置虚构角色权限</Button>
    <Button v-if="page && !design && !managing" @click="edit">设计报表</Button>
    <Button v-if="design" @click="publish">保存并发布</Button>
    <p v-if="error">{{ error }}</p>
    <p v-if="notice">{{ notice }}</p>
    <ReportCenter v-if="managing" />
    <ReportDesignEditor v-else-if="design && catalog" v-model="design" :catalog="catalog" />
    <ReportRuntimeView v-else-if="page" :page="page" :query="query" :export-component="exportComponent"
      :initial-parameters="{ org: 'org-1' }" initial-context-key="fixture" context-key="fixture" />
    <ResourcePermissionDialog v-model:open="roleOpen" :load-target="loadRole" :save-target="saveRole"
      :auto-include-menu-ancestors="isGeneratedReportMenuPath" subject-label="角色" title="虚构角色资源权限" />
  </ConfigProvider>
</template>
