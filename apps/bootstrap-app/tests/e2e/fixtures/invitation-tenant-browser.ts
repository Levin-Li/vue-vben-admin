import { createApp, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { useAccessStore, useUserStore } from '@vben/runtime/stores';
import '@vben/runtime/styles';
import '@vben/runtime/styles/antd';

import { createPinia, setActivePinia } from 'pinia';

import { initializeDataAttrFieldGrants } from '../../../../../packages/business/admin-framework/src/framework-commons/data-attr-policy';
import { setAdminFrameworkRuntime } from '../../../../../packages/business/admin-framework/src/framework-commons/runtime';
import { initializeFieldValueGrants } from '../../../../../packages/business/admin-framework/src/framework-commons/shared/crud-field-value-scope';
import { registerOakDataAttrContract } from '../../../../../packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/register-data-attr-contract';
import InvitationRegisterPage from '../../../../../packages/business/admin-framework/src/framework-commons/app/views/_core/authentication/invitation-register.vue';
import { invitationRegisterService } from '../../../../../packages/business/admin-framework/src/framework-commons/app/api/invitation-register-service';
import { rbacService } from '../../../../../packages/business/admin-framework/src/framework-commons/app/api/rbac-service';
import InvitationLinkPage from '../../../../../packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/invitation-link/index.vue';

// 仅在本机测试路径运行；所有业务数据和授权均为本文件内的虚构夹具。
if (!['127.0.0.1', 'localhost'].includes(location.hostname)) {
  throw new Error('仅允许在本机运行邀请链接测试夹具');
}
const actor = new URLSearchParams(location.search).get('actor') || 'platform';
const backendMode = new URLSearchParams(location.search).get('backend');
const realBackend = backendMode === 'real' || backendMode === 'pg';
if (!['platform', 'tenant'].includes(actor))
  throw new Error('未知隔离测试主体');
const platform = actor === 'platform';
registerOakDataAttrContract();
initializeDataAttrFieldGrants({ version: 1, allowed: [] });
initializeFieldValueGrants({ version: 1, allowed: [] });
const pinia = createPinia();
setActivePinia(pinia);
useUserStore().setUserInfo({
  id: `fixture-${actor}`,
  platformUser: platform,
  superAdmin: platform,
  tenantId: platform ? null : 'tenant-a',
  orgId: platform ? null : 'org-a',
  roles: [],
} as any);
useAccessStore().setAccessCodes(['*:*:*:*']);

const tenants = [
  { id: 'tenant-a', name: '测试租户甲' },
  { id: 'tenant-b', name: '测试租户乙' },
];
const organizations: Record<string, { id: string; name: string }[]> = {
  'tenant-a': [{ id: 'org-a', name: '甲租户组织' }],
  'tenant-b': [{ id: 'org-b', name: '乙租户组织' }],
};
const requests = ref<any[]>([]);
const createdRegistrationUrl = ref('');
const registerToken = new URLSearchParams(location.search).get('token');
const records: any[] = [];

// 默认使用纯内存数据；real 模式仅转发至本机隔离 H2 测试服务。
async function request(urlOrConfig: any, config: any = {}) {
  const url = typeof urlOrConfig === 'string' ? urlOrConfig : urlOrConfig.url;
  const options = typeof urlOrConfig === 'string' ? config : urlOrConfig;
  const path = new URL(String(url), location.origin).pathname;
  const data = options?.data || {};
  const loggedData = structuredClone(data);
  for (const key of ['token', 'password', 'verificationCode']) {
    if (key in loggedData) loggedData[key] = '[已隐藏]';
  }
  requests.value = [...requests.value, { path, data: loggedData }];
  if (realBackend && (path.includes('/InvitationLink/') || path.includes('/InvitationRegister/'))) {
    const response = await fetch(`${backendMode === 'pg' ? '/fixture-pg-api' : '/fixture-api'}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Fixture-Actor': actor },
      body: JSON.stringify(data),
    });
    const payload = await response.json();
    if (!response.ok || payload.code !== 0) {
      throw new Error(payload.msg || `隔离测试接口失败：${response.status}`);
    }
    if (backendMode === 'pg' && path.includes('/InvitationLink/create') && payload.data?.url) {
      const token = new URL(payload.data.url, location.origin).searchParams.get('token');
      if (token) createdRegistrationUrl.value = `${location.origin}/?actor=platform&backend=pg&token=${encodeURIComponent(token)}`;
    }
    return payload.data;
  }
  if (path.endsWith('/targetTenants')) return tenants;
  if (path.endsWith('/targetOrganizations')) {
    return organizations[platform ? data.tenantId : 'tenant-a'] || [];
  }
  if (path.endsWith('/targetChannels')) {
    const tenant = platform ? data.tenantId : 'tenant-a';
    let choices: Array<{ id: string; name: string }> = [];
    if (tenant === 'tenant-a' && data.targetOrgId === 'org-a') {
      choices = [{ id: 'channel-a', name: '甲组织渠道' }];
    } else if (tenant === 'tenant-b' && data.targetOrgId === 'org-b') {
      choices = [{ id: 'channel-b', name: '乙组织渠道' }];
    }
    const keyword = String(data.keyword || '').trim();
    return choices.filter((item) => item.name.includes(keyword));
  }
  if (path.endsWith('/targetDictionaryOptions')) {
    const tenant = platform ? data.tenantId : 'tenant-a';
    if (!organizations[tenant]) return [];
    const suffix = tenant === 'tenant-a' ? '甲' : '乙';
    if (data.field === 'organizationCategory') {
      return [{ label: `${suffix}组织类别`, value: `category-${suffix}` }];
    }
    if (data.field === 'accountType') {
      return [{ label: `${suffix}用户类型`, value: `account-${suffix}` }];
    }
    return [];
  }
  if (path.endsWith('/InvitationLink/list')) {
    return {
      items: records,
      total: records.length,
      pageIndex: 1,
      pageSize: 20,
    };
  }
  if (path.includes('/InvitationLink/create')) {
    const tenantId = platform ? data.tenantId : 'tenant-a';
    if (!organizations[tenantId]?.some((org) => org.id === data.targetOrgId)) {
      throw new Error('测试夹具：组织不属于所选租户');
    }
    const id = `invitation-${records.length + 1}`;
    const targetType = path.slice(
      path.lastIndexOf('/create') + '/create'.length,
    );
    if (
      ![
        'ChannelPartner',
        'Customer',
        'Internal',
        'Member',
        'SupplierPartner',
      ].includes(targetType)
    ) {
      throw new Error('测试夹具：未知邀请目标');
    }
    records.push({
      ...data,
      id,
      tenantId,
      targetType,
      targetOrgName: organizations[tenantId][0].name,
      createdAt: '2026-11-03T00:00:00',
      status: 'Active',
      successCount: 0,
    });
    return { id, url: `https://example.test/invitation/${id}` };
  }
  if (path.endsWith('/InvitationLink/retrieve'))
    return records.find((row) => row.id === data.id);
  if (path.includes('/UiSetting/')) return null;
  return [];
}
const noSettings = async () => null as any;
setAdminFrameworkRuntime({
  requestClient: {
    request,
    get: noSettings,
    post: noSettings,
    put: noSettings,
    delete: noSettings,
  } as any,
});

// 注册页面使用真实组件和控制器；仅站点登录配置与短信发送为测试替身。
if (backendMode === 'pg') {
  (rbacService as any).getLoginOptions = async () => ({ enableInvitationRegister: true });
  (rbacService as any).getVerifyCode = async ({ account }: { account: string }) => {
    const response = await fetch('/fixture/pg-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account }) });
    if (!response.ok) throw new Error('隔离验证码生成失败');
    const data = await response.json();
    return { type: 'Sms', mock: true, code: data.code };
  };
  (invitationRegisterService as any).preview = (token: string) => request('/com.levin.oak.base/V1/api/InvitationRegister/preview', { data: { token } });
  (invitationRegisterService as any).redeem = (data: any) => request('/com.levin.oak.base/V1/api/InvitationRegister/redeem', { data });
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/',
      name: 'InvitationTenantFixture',
      component: InvitationLinkPage,
    },
    { path: '/register', component: InvitationRegisterPage },
  ],
});
await router.push(registerToken ? { path: '/register', query: { token: registerToken } } : '/');
await router.isReady();
// Vite 对全部 HTML 注入宿主启动遮罩；夹具不运行宿主启动代码，需自行移除。
document.querySelector('#__app-loading__')?.remove();
createApp({
  render: () =>
    h('div', [
      h('p', `隔离测试主体：${actor}`),
      registerToken ? h(InvitationRegisterPage) : h(InvitationLinkPage),
      !registerToken && createdRegistrationUrl.value ? h('a', { href: createdRegistrationUrl.value, target: '_blank', 'data-testid': 'fixture-registration-link' }, '打开隔离邀请注册页面') : null,
      h(
        'pre',
        { 'data-testid': 'fixture-requests' },
        JSON.stringify(requests.value, null, 2),
      ),
    ]),
})
  .use(pinia)
  .use(router)
  .mount('#app');
