import type { VxeTableGridOptions } from '@levin/admin-framework/framework-commons/adapter/vxe-table';

import type { MenuRecord, SelectOption } from './types';

export const fallbackPageTypeOptions: SelectOption[] = [
  { color: 'success', label: '本地页面', value: 'LocalPage' },
  { color: 'processing', label: 'Amis页面', value: 'AmisPage' },
  { color: 'warning', label: 'Html页面', value: 'HtmlPage' },
];

export const fallbackActionTypeOptions: SelectOption[] = [
  { label: '默认', value: 'Default' },
  { label: 'Tab栏', value: 'TabPanel' },
  { label: '模态窗口', value: 'ModalWindow' },
  { label: '新浏览器窗口', value: 'NewWindow' },
  { label: '地址栏重定向', value: 'Redirect' },
  { label: 'jsonp回调', value: 'Jsonp' },
  { label: '服务端动作', value: 'ServerSideAction' },
];

function findOptionLabel(options: SelectOption[], value?: boolean | string) {
  return String(
    options.find((item) => item.value === value)?.label || value || '-',
  );
}

export function resolvePageTypeLabel(value?: string) {
  return findOptionLabel(fallbackPageTypeOptions, value);
}

export function resolveActionTypeLabel(value?: string) {
  return findOptionLabel(fallbackActionTypeOptions, value);
}

function resolveBooleanLabel(value?: boolean) {
  if (value === false) {
    return '禁用';
  }

  return '启用';
}

export function useColumns(): VxeTableGridOptions<MenuRecord>['columns'] {
  return [
    {
      align: 'left',
      field: 'name',
      fixed: 'left',
      minWidth: 260,
      slots: { default: 'title' },
      title: '菜单名称',
      treeNode: true,
    },
    {
      align: 'center',
      field: 'pageType',
      formatter: ({ row }) => resolvePageTypeLabel(row.pageType),
      title: '页面类型',
      width: 120,
    },
    {
      align: 'center',
      field: 'actionType',
      formatter: ({ row }) => resolveActionTypeLabel(row.actionType),
      title: '打开方式',
      width: 130,
    },
    {
      field: 'path',
      minWidth: 220,
      title: '路径',
    },
    {
      field: 'moduleId',
      minWidth: 160,
      title: '模块ID',
    },
    {
      field: 'requireAuthorizations',
      formatter: ({ row }) => row.requireAuthorizations?.join('\n') || '-',
      minWidth: 220,
      title: '所需权限',
    },
    {
      field: 'opButtonList',
      minWidth: 220,
      slots: { default: 'opButtons' },
      title: '操作按钮',
    },
    {
      align: 'center',
      field: 'enable',
      formatter: ({ row }) => resolveBooleanLabel(row.enable),
      title: '是否启用',
      width: 110,
    },
    {
      align: 'center',
      field: 'editable',
      formatter: ({ row }) => resolveBooleanLabel(row.editable),
      title: '是否可编辑',
      width: 120,
    },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: '操作',
      width: 220,
    },
  ];
}
