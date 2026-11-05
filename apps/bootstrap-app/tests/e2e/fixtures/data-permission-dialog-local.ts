import { createApp, h } from 'vue';
import { createPinia } from 'pinia';

import '@vben/runtime/styles';
import '@vben/runtime/styles/antd';

import DataPermissionDialog from '../../../../../packages/business/admin-framework/src/framework-commons/shared/data-permission-dialog.vue';

const previewPayload = {
  detail: {
    deniedDomainScopeList: [],
    deniedOrgScopeList: [],
    deniedTenantScopeList: [],
    domainScopeList: [],
    id: 'local-role',
    name: '演示角色',
    orgScopeList: [],
    tenantScopeList: [],
  },
  orgTree: [
    {
      children: [
        { children: [], id: 'org-1', name: '微码' },
        { children: [], id: 'org-2', name: 'VM文超' },
      ],
      id: 'org-root',
      name: '分销一部',
    },
  ],
};

createApp({
  setup() {
    return () =>
      h(DataPermissionDialog, {
        open: true,
        previewPayload,
        record: { id: 'local-role' },
        subjectType: 'role',
      });
  },
})
  .use(createPinia())
  .mount('#app');
