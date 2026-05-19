import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { onlineCodeGenService } from '../../api/online-code-gen-service';

import { DEFAULT_CRUD_MODAL_WIDTH } from '../api-module';

function buildGenAmisPageCodeAction(record: Record<string, any>) {
  return onlineCodeGenService.genAmisPageCode({
    id: record.id,
  });
}

export const onlineCodeGenPageCrudConfig: CrudPageConfig = {
  allowCreate: false,
  allowDelete: false,
  allowEdit: false,
  apiBase: '/OnlineCodeGen',
  apiService: onlineCodeGenService,
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  fields: [
    {
      key: 'id',
      label: '控制器ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 260,
    },
    {
      key: 'pluginName',
      label: '插件名称',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'pluginVersion',
      label: '插件版本',
      form: false,
      table: true,
      width: 120,
    },
    {
      key: 'name',
      label: '控制器名称',
      form: false,
      search: true,
      table: true,
      width: 200,
    },
    {
      key: 'label',
      label: '控制器标签',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'pathPrefix',
      label: '控制器路径前缀',
      form: false,
      table: true,
      width: 260,
    },
    {
      key: 'type',
      label: '控制器类型',
      form: false,
      table: true,
      width: 160,
    },
    {
      key: 'desc',
      label: '控制器描述',
      form: false,
      table: true,
      width: 260,
    },
    {
      key: 'pageContent',
      label: '百度 Amis 页面 JSON',
      form: false,
      fullRow: true,
      type: 'code',
    },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  permissionResourceName: 'Spring控制器',
  permissionTypePrefix: '专家数据',
  rowActions: [
    {
      handler: buildGenAmisPageCodeAction,
      label: '生成百度 Amis 页面',
      opRefTargetType: 'SingleRow',
      permission: buildApiMethodPermissions(
        onlineCodeGenService,
        'genAmisPageCode',
      ),
      successAction: 'showForm',
    },
  ],
  title: '在线代码生成',
};
