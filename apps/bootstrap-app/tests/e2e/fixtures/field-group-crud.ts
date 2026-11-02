import { createApp, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { useAccessStore, useUserStore } from '@vben/runtime/stores';
import '@vben/runtime/styles';
import '@vben/runtime/styles/antd';

import { createPinia, setActivePinia } from 'pinia';

import {
  initializeDataAttrFieldGrants,
  registerDataAttrStaticContract,
} from '../../../../../packages/business/admin-framework/src/framework-commons/data-attr-policy';
import { setAdminFrameworkRuntime } from '../../../../../packages/business/admin-framework/src/framework-commons/runtime';
import CrudPage from '../../../../../packages/business/admin-framework/src/framework-commons/shared/dynamic-crud-page.vue';

const options = new URLSearchParams(location.search);
const actor = options.get('actor');
const port = options.get('port');
if (
  !['reader', 'writer'].includes(actor || '') ||
  !/^\d{2,5}$/.test(port || '')
) {
  throw new Error('仅允许使用 reader/writer 和回环测试服务端口');
}
// 独立回环代理只透传真实测试服务；直接入口仍可指向服务端口。
const origin =
  options.get('proxy') === '1' ? location.origin : `http://127.0.0.1:${port}`;
const root = '/fixture/ui/contracts';
const headers = {
  'Content-Type': 'application/json',
  'X-Fixture-User': actor || '',
};
const request = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${origin}${path}`, { ...init, headers });
  const json = await response.json();
  if (!response.ok || json.successful === false)
    throw new Error(json.msg || `HTTP ${response.status}`);
  return json.data ?? json;
};
const [contract, grants] = await Promise.all([
  request('/fixture/ui/contract'),
  request('/fixture/ui/grants'),
]);
// 静态契约与用户结论都由隔离服务端真实控制器模型和角色计算产生。
registerDataAttrStaticContract(contract);
initializeDataAttrFieldGrants(grants);

const pinia = createPinia();
setActivePinia(pinia);
if (!Array.isArray(grants.accessCodes))
  throw new Error('测试主体缺少服务端操作授权');
useAccessStore().setAccessCodes(grants.accessCodes);
useUserStore().setUserInfo({ id: actor, roles: [] } as any);
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/',
      name: 'FieldGroupBrowserFixture',
      component: { render: () => null },
    },
  ],
});
await router.push('/');
await router.isReady();
// 页面配置、字典等非验收 HTTP 不访问真实业务系统。
const noSettings = async () => null as any;
setAdminFrameworkRuntime({
  requestClient: {
    get: noSettings,
    post: noSettings,
    put: noSettings,
    delete: noSettings,
    request: noSettings,
  },
});
const call = (path: string, data?: any) =>
  request(
    `${root}/${path}`,
    data === undefined ? {} : { method: 'POST', body: JSON.stringify(data) },
  );
const config = {
  apiBase: root,
  title: '字段权限合同',
  allowDelete: false,
  allowExport: false,
  queryPermission: 'fixture:contracts:contract:query',
  detailPermission: 'fixture:contracts:contract:info',
  createPermission: 'fixture:contracts:contract:create',
  editPermission: 'fixture:contracts:contract:update',
  dataAttrTargets: {
    list: { method: 'GET', path: `${root}/list` },
    retrieve: { method: 'GET', path: `${root}/info` },
    create: { method: 'POST', path: `${root}/create` },
    update: { method: 'POST', path: `${root}/update` },
  },
  apiService: {
    list: (params: Record<string, any>) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(params))
        if (value !== null && value !== undefined && value !== '')
          query.set(key, String(value));
      return request(`${root}/list?${query}`);
    },
    retrieve: () => call('info'),
    create: (data: any) => call('create', data),
    update: (data: any) => call('update', data),
  },
  fields: [
    { key: 'id', label: '合同编号', table: true, detail: true, form: false },
    {
      key: 'title',
      label: '合同标题',
      table: true,
      detail: true,
      form: true,
      search: true,
    },
    {
      key: 'amount',
      label: '合同金额',
      table: true,
      detail: true,
      form: true,
      search: true,
    },
  ],
};
createApp({
  render: () =>
    h('div', [
      h('p', { 'data-test': 'field-fixture-actor' }, `隔离测试账号：${actor}`),
      h(CrudPage as any, { config }),
    ]),
})
  .use(pinia)
  .use(router)
  .mount('#app');
