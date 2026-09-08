import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { backendFixedJobService } from '../../api/backend-fixed-job-service';
import { DEFAULT_CRUD_MODAL_WIDTH } from '../api-module';

export const pageMeta = {
  name: 'BackendFixedJob',
  title: '后端固定定时任务',
  description: '查看后端注册的固定定时任务，维护名称、描述、启用状态和配置。',
} as const;

// 与业务控制器的更新白名单一致，主键和版本只能来自读取到的记录。
export function transformBackendFixedJobSubmit(
  values: Record<string, any>,
  editingRecord: null | Record<string, any>,
) {
  if (
    !editingRecord?.id ||
    editingRecord.optimisticLock === null ||
    editingRecord.optimisticLock === undefined
  ) {
    throw new Error('缺少任务标识或版本号，请刷新后重试');
  }
  const payload: Record<string, any> = {
    id: editingRecord.id,
    optimisticLock: editingRecord.optimisticLock,
  };
  for (const key of ['name', 'remark', 'enable', 'configData']) {
    if (Object.hasOwn(values, key)) payload[key] = values[key];
  }
  if (
    Object.hasOwn(payload, 'remark') &&
    (payload.remark === null ||
      payload.remark === undefined ||
      payload.remark === '')
  ) {
    payload.forceUpdateFields = ['remark'];
  }
  return payload;
}

export const backendFixedJobPageCrudConfig: CrudPageConfig = {
  apiBase: '/BackendFixedJob',
  apiService: backendFixedJobService,
  allowCreate: false,
  allowDelete: false,
  allowEdit: true,
  allowRetrieve: true,
  defaultQuery: { pageIndex: 1, pageSize: 10 },
  fields: [
    {
      key: 'containsName',
      label: '名称',
      search: true,
      form: false,
      detail: false,
    },
    {
      key: 'name',
      label: '名称',
      required: true,
      maxLength: 128,
      table: true,
      width: 220,
    },
    {
      key: 'enable',
      label: '是否启用',
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 110,
    },
    {
      key: 'id',
      label: '定时任务类名',
      search: true,
      table: true,
      fullRow: true,
      disabledOnEdit: true,
      width: 340,
    },
    {
      key: 'remark',
      label: '描述',
      table: true,
      type: 'textarea',
      fullRow: true,
      maxLength: 512,
      width: 320,
    },
    {
      key: 'configDataEditor',
      label: '配置数据编辑器',
      disabledOnEdit: true,
      omitOnEdit: true,
      fullRow: true,
    },
    {
      key: 'configData',
      jsonSchemaEditor: true,
      jsonSchema: ':configDataEditor',
      label: '配置数据',
      type: 'json',
      fullRow: true,
      required: true,
    },
    {
      key: 'createTime',
      label: '创建时间',
      type: 'datetime',
      form: false,
      table: true,
      width: 180,
    },
    {
      key: 'lastUpdateTime',
      label: '更新时间',
      type: 'datetime',
      form: false,
      table: true,
      width: 180,
    },
    { key: 'domainId', label: '领域标识', form: false },
    { key: 'creator', label: '创建者', form: false },
    { key: 'orderCode', label: '排序代码', type: 'number', form: false },
    { key: 'editable', label: '是否可编辑', type: 'switch', form: false },
    { key: 'optimisticLock', label: '乐观锁版本号', form: false },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: pageMeta.title,
  description: pageMeta.description,
  transformSubmit: transformBackendFixedJobSubmit,
};
