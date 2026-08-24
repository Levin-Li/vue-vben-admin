import { computed, ref, watch } from 'vue';

import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { roleService } from '../../api/role-service';
import {
  confidentialLevelOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  moduleFetchDictOptions,
  roleOptionsLoader,
  tenantOptionsLoader,
} from '../api-module';
import { buildCrudOperationPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  getDataPermissionCount,
  getResourcePermissionCount,
} from '../permission-action-counts';

const roleTypeOptionsLoader = () =>
  moduleFetchDictOptions('com.levin.oak.base.entities.Role.type');

function normalizeRoleConstraintValues(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (item === null || item === undefined) {
        return '';
      }

      return String(item).trim();
    })
    .filter(Boolean);
}

async function validateRoleConstraintSubmit(values: Record<string, any>) {
  const exclusiveRoles = new Set(
    normalizeRoleConstraintValues(values.exclusiveRoleList),
  );
  const duplicatedRoles = normalizeRoleConstraintValues(
    values.coexistRoleList,
  ).filter((role) => exclusiveRoles.has(role));

  if (duplicatedRoles.length > 0) {
    throw new Error(
      `互斥角色列表和必须共存角色列表不能同时包含：${duplicatedRoles.join('、')}`,
    );
  }

  return values;
}

const rolePageCrudConfig: CrudPageConfig = {
  apiBase: '/Role',
  apiService: roleService,
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
      visibleForPlatformUser: true,
    },
    {
      key: '__tenant',
      label: '归属租户',
      fixed: 'left',
      form: false,
      table: true,
      type: 'tenant',
      visibleForPlatformUser: true,
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
      cellSingleLine: true,
      help: '把当前角色分配给用户时，用户不能已拥有这里选择的任一角色；用于配置不能同时拥有的角色组合。留空表示不限制互斥角色。',
      fullRow: true,
      layoutNewRow: true,
      loadOptions: roleOptionsLoader,
      multiple: true,
      placeholder: '选择互斥角色',
      remoteSearch: true,
      table: true,
      type: 'role-select',
      width: 220,
    },
    {
      key: 'coexistRoleList',
      label: '必须共存角色列表',
      cellSingleLine: true,
      help: '把当前角色分配给用户时，用户必须已拥有这里选择的全部角色；用于配置分配当前角色前必须具备的前置角色。留空表示不要求共存角色。',
      fullRow: true,
      layoutNewRow: true,
      loadOptions: roleOptionsLoader,
      multiple: true,
      placeholder: '选择必须共存的角色',
      remoteSearch: true,
      table: true,
      type: 'role-select',
      width: 220,
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
      valueType: 'number',
      width: 120,
    },
    {
      key: 'confidentialDataAccessLevel',
      label: '机密数据访问级别',
      loadOptions: confidentialLevelOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      valueType: 'number',
      width: 160,
    },
    {
      key: 'permissionList',
      label: '资源权限列表',
      cellTooltip: false,
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
      cellSingleLine: true,
      formVisibleForSuperAdmin: true,
      fullRow: true,
      help: '填写角色分配前置条件表达式，默认按 Groovy 表达式判断；可使用 _tenant（当前租户）、_user（被分配用户）、_role（当前角色）变量，表达式满足时才允许分配。示例：_user.type == "2"。留空表示不限制。',
      placeholder: '例如：_user.type == "2" && _tenant != null；留空表示不限制',
      table: true,
      type: 'textarea',
      width: 260,
    },
    { key: 'exInfo', label: '扩展信息', type: 'json' },
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
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '角色管理',
  transformSubmit: validateRoleConstraintSubmit,
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
        badgeCount: getResourcePermissionCount,
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
        badgeCount: getDataPermissionCount,
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
