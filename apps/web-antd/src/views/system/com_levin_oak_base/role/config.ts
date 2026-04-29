import { computed, ref, watch } from 'vue';

import type { CrudPageConfig } from '../../shared/types';

import {
  confidentialLevelOptionsLoader,
  moduleFetchDictOptions,
  roleOptionsLoader,
  tenantOptionsLoader,
} from '../api-module';
import { buildCrudOperationPermissions } from '../../shared/crud-permissions';

const roleTypeOptionsLoader = () =>
  moduleFetchDictOptions('com.levin.oak.base.entities.Role.type');

const rolePageCrudConfig: CrudPageConfig = {
  apiBase: '/Role',
  allowRetrieve: true,
  defaultFormValues: {
    editable: true,
    enable: true,
    orderCode: 100,
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  description:
    '角色权限列表与当前登录用户权限同步收敛，避免越权创建、编辑或删除。',
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
      visibleForSaasUser: true,
    },
    {
      key: '__tenant',
      label: '归属租户',
      fixed: 'left',
      form: false,
      table: true,
      type: 'tenant',
      visibleForSaasUser: true,
      width: 180,
    },
    {
      key: 'id',
      label: '角色ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    { key: 'containsName', label: '角色名称', form: false, search: true },
    { key: 'name', label: '角色名称', required: true, table: true, width: 150 },
    { key: 'containsCode', label: '角色编码', form: false, search: true },
    { key: 'code', label: '角色编码', required: true, table: true, width: 160 },
    {
      key: 'exclusiveRoleList',
      label: '互斥角色列表',
      loadOptions: roleOptionsLoader,
      multiple: true,
      placeholder: '选择互斥角色',
      remoteSearch: true,
      type: 'role-select',
    },
    {
      key: 'coexistRoleList',
      label: '必须共存角色列表',
      loadOptions: roleOptionsLoader,
      multiple: true,
      placeholder: '选择必须共存的角色',
      remoteSearch: true,
      type: 'role-select',
    },
    {
      key: 'inType',
      label: '角色类型',
      form: false,
      loadOptions: roleTypeOptionsLoader,
      multiple: true,
      search: true,
      type: 'select',
    },
    {
      key: 'type',
      label: '角色类型',
      loadOptions: roleTypeOptionsLoader,
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'gteExpiredTime',
      label: '过期时间开始',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteExpiredTime',
      label: '过期时间结束',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'expiredTime',
      label: '过期时间',
      table: true,
      type: 'datetime',
      width: 180,
    },
    { key: 'icon', label: '图标', table: true, type: 'image', width: 90 },
    {
      key: 'confidentialLevel',
      label: '机密等级',
      loadOptions: confidentialLevelOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'confidentialDataAccessLevel',
      label: '机密数据访问级别',
      loadOptions: confidentialLevelOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 160,
    },
    {
      key: 'permissionList',
      label: '资源权限列表',
      fullRow: true,
      form: false,
      placeholder: '一行一个权限表达式',
      table: true,
      type: 'string-array',
      width: 220,
    },
    {
      key: 'assignPreCondition',
      label: '角色分配前置条件',
      fullRow: true,
      type: 'textarea',
    },
    { key: 'exInfo', label: '扩展信息', fullRow: true, type: 'json' },
    { key: 'orderCode', label: '排序代码', type: 'number' },
    {
      key: 'enable',
      label: '是否启用',
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    {
      key: 'editable',
      label: '是否可编辑',
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 110,
    },
    {
      key: 'createTime',
      label: '创建时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'lastUpdateTime',
      label: '更新时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    { key: 'remark', label: '备注', search: true, type: 'textarea' },
  ],
  modalWidth: 1120,
  title: '角色管理',
};

export function useRolePageConfig() {
  const dataPermissionDialogOpen = ref(false);
  const pageKey = ref(0);
  const resourcePermissionDialogOpen = ref(false);
  const selectedDataPermissionRecord = ref<null | Record<string, any>>(null);
  const selectedResourcePermissionRecord = ref<null | Record<string, any>>(
    null,
  );

  const config = computed(() => ({
    ...rolePageCrudConfig,
    rowActions: [
      ...(rolePageCrudConfig.rowActions || []),
      {
        handler: async (record: Record<string, any>) => {
          selectedResourcePermissionRecord.value = record;
          resourcePermissionDialogOpen.value = true;
        },
        label: '资源权限分配',
        permission:
          rolePageCrudConfig.editPermission ||
          buildCrudOperationPermissions(rolePageCrudConfig, 'update'),
        reloadAfterAction: false,
        successMessage: false as const,
      },
      {
        handler: async (record: Record<string, any>) => {
          selectedDataPermissionRecord.value = record;
          dataPermissionDialogOpen.value = true;
        },
        label: '数据权限分配',
        permission:
          rolePageCrudConfig.editPermission ||
          buildCrudOperationPermissions(rolePageCrudConfig, 'update'),
        reloadAfterAction: false,
        successMessage: false as const,
      },
    ],
  }));

  function handleSaved() {
    pageKey.value += 1;
  }

  watch(dataPermissionDialogOpen, (open) => {
    if (!open) {
      selectedDataPermissionRecord.value = null;
    }
  });

  watch(resourcePermissionDialogOpen, (open) => {
    if (!open) {
      selectedResourcePermissionRecord.value = null;
    }
  });

  return {
    config,
    dataPermissionDialogOpen,
    handleSaved,
    pageKey,
    resourcePermissionDialogOpen,
    selectedDataPermissionRecord,
    selectedResourcePermissionRecord,
  };
}
