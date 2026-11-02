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
import { initializeFieldValueGrants } from '../../../../../packages/business/admin-framework/src/framework-commons/shared/crud-field-value-scope';
import CrudPage from '../../../../../packages/business/admin-framework/src/framework-commons/shared/dynamic-crud-page.vue';

const args = new URLSearchParams(location.search);
const actor = args.get('actor') || '';
const resource = args.get('resource') || '';
if (
  !(
    (resource === 'enum' &&
      ['scoped-full', 'scoped-multi', 'scoped-revocable'].includes(actor)) ||
    (resource === 'dict' &&
      ['dict', 'dict-multi', 'dict-other'].includes(actor))
  )
) {
  throw new Error('仅允许指定隔离枚举或字典测试主体');
}
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(location.origin))
  throw new Error('仅支持回环测试代理');
const root =
  resource === 'enum'
    ? '/enum-fixture/partners'
    : '/enum-fixture/dict-partners';
const operationRoot =
  resource === 'enum'
    ? 'enum-fixture:业务数据:合作伙伴'
    : 'dict-fixture:业务数据:合作伙伴';
const headers = { 'Content-Type': 'application/json', 'X-Fixture-User': actor };
const request = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${location.origin}${path}`, {
    ...init,
    headers,
  });
  const body = await response.json();
  if (!response.ok || body.successful === false)
    throw new Error(body.msg || `HTTP ${response.status}`);
  return body.data ?? body;
};
const [contract, identity, metadata] = await Promise.all([
  request('/enum-fixture/static-contract'),
  request('/enum-fixture/identity'),
  request(
    resource === 'enum'
      ? '/enum-fixture/permissions'
      : '/enum-fixture/dictionary-metadata',
  ),
]);
if (!Array.isArray(identity.accessCodes))
  throw new Error('测试主体缺少真实操作授权');
registerDataAttrStaticContract(contract);
initializeDataAttrFieldGrants(identity.fieldGroupGrants);
initializeFieldValueGrants(identity.fieldValueGrants);
const pinia = createPinia();
setActivePinia(pinia);
useAccessStore().setAccessCodes(identity.accessCodes);
useUserStore().setUserInfo({
  id: identity.id,
  tenantId: identity.tenantId,
  roles: [],
} as any);
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/',
      name: 'FieldValueBrowserFixture',
      component: { render: () => null },
    },
  ],
});
await router.push('/');
await router.isReady();
// 真实业务服务由 apiService 请求；其余模块请求不得误连到宿主业务后端。
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
const valuesFor = (attribute: string) => {
  const field = metadata.find((entry: any) => entry.attribute === attribute);
  if (!field) throw new Error(`测试服务缺少字段候选：${attribute}`);
  return field.values.map((entry: any) => ({
    label: entry.label,
    value: entry.name,
  }));
};
const selectFields =
  resource === 'enum'
    ? [
        {
          key: 'kind',
          label: '伙伴类型',
          type: 'select',
          valueType: 'string',
          options: valuesFor('kind'),
          required: true,
          table: true,
          form: true,
        },
        {
          key: 'region',
          label: '所属区域',
          type: 'select',
          valueType: 'string',
          options: valuesFor('region'),
          required: true,
          table: true,
          form: true,
        },
      ]
    : [
        {
          key: 'level',
          label: '客户等级',
          type: 'select',
          valueType: 'string',
          options: valuesFor('level'),
          required: true,
          table: true,
          form: true,
        },
      ];
const send = (action: string, payload: any) =>
  request(`${root}/${action}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
const config = {
  apiBase: root,
  title: resource === 'enum' ? '枚举范围伙伴' : '字典范围伙伴',
  allowRetrieve: false,
  allowExport: false,
  queryPermission: `${operationRoot}:查询`,
  createPermission: `${operationRoot}:新增`,
  editPermission: `${operationRoot}:更新`,
  deletePermission: `${operationRoot}:删除`,
  dataAttrTargets: {
    list: { method: 'GET', path: root },
    create: { method: 'POST', path: `${root}/create` },
    update: { method: 'POST', path: `${root}/update` },
    delete: { method: 'POST', path: `${root}/delete` },
  },
  apiService: {
    list: () => request(root),
    create: (data: any) => send('create', data),
    update: (data: any) => send('update', data),
    delete: (data: any) => send('delete', data),
  },
  fields: [
    {
      key: 'id',
      label: '编号',
      required: true,
      showIdOnCreate: true,
      table: true,
      form: true,
      disabledOnEdit: true,
    },
    { key: 'name', label: '名称', table: true, form: true },
    ...selectFields,
  ],
};
createApp({
  render: () =>
    h('div', [
      h(
        'p',
        { 'data-test': 'field-value-fixture' },
        `隔离数据范围账号：${actor}`,
      ),
      h(CrudPage as any, { config }),
    ]),
})
  .use(pinia)
  .use(router)
  .mount('#app');
