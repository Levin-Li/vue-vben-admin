import type {
  CrudFieldConfig,
  CrudPageConfig,
} from '@levin/admin-framework/framework-commons/shared/types';

import { demoService } from '../../api/demo-service';
import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
  userOptionsLoader,
} from '../api-module';

// 四级对象只声明字段语义和映射；边框、缩进与请求组装由公共 CRUD 执行。
const nestedCategoryOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Demo$NestedCategory',
);
const nestedStageOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Demo$NestedStage',
);

function nestedField(
  key: string,
  label: string,
  complexGroupKey: string,
  layoutOrder: number,
  options: Partial<CrudFieldConfig> = {},
): CrudFieldConfig {
  return {
    complexGroupKey,
    key,
    label,
    layoutGroup: 'nested',
    layoutGroupTitle: '四层嵌套对象',
    layoutOrder,
    ...options,
  };
}

const nestedObjectFields: CrudFieldConfig[] = [
  // 第一层：标题必填；整数为可选但必须非负。
  nestedField('nestedOneTitle', '一级标题', 'nestedOne', 10, {
    required: true,
    maxLength: 80,
  }),
  nestedField('nestedOneCode', '一级编码', 'nestedOne', 20, { maxLength: 32 }),
  nestedField('nestedOneDescription', '一级描述', 'nestedOne', 30, {
    maxLength: 256,
  }),
  nestedField('nestedOneContact', '一级联系人', 'nestedOne', 40, {
    maxLength: 64,
  }),
  nestedField('nestedOneRemark', '一级备注', 'nestedOne', 50, {
    maxLength: 256,
  }),
  nestedField('nestedOneSortOrder', '一级排序值', 'nestedOne', 60, {
    type: 'number',
    valueType: 'number',
    validator: (value) =>
      value === undefined ||
      value === null ||
      value === '' ||
      (Number.isInteger(Number(value)) && Number(value) >= 0)
        ? undefined
        : '请输入非负整数',
  }),

  // 第二层：枚举值来自实体声明，不使用硬编码的英文编码作展示标签。
  nestedField('nestedTwoName', '二级名称', 'nestedTwo', 10, {
    required: true,
    maxLength: 80,
  }),
  nestedField('nestedTwoCategory', '二级类别', 'nestedTwo', 20, {
    loadOptions: nestedCategoryOptionsLoader,
    required: true,
    type: 'select',
    valueType: 'string',
  }),
  nestedField('nestedTwoStatus', '二级状态', 'nestedTwo', 30, {
    maxLength: 32,
  }),
  nestedField('nestedTwoReference', '二级关联编号', 'nestedTwo', 40, {
    maxLength: 64,
  }),
  nestedField('nestedTwoNote', '二级说明', 'nestedTwo', 50, { maxLength: 256 }),

  // 第三层：普通枚举与日期时间保留各自的 Java 值类型。
  nestedField('nestedThreeLabel', '三级标签', 'nestedThree', 10, {
    required: true,
    maxLength: 80,
  }),
  nestedField('nestedThreeIdentifier', '三级标识', 'nestedThree', 20, {
    maxLength: 32,
  }),
  nestedField('nestedThreeOwner', '三级负责人', 'nestedThree', 30, {
    maxLength: 64,
  }),
  nestedField('nestedThreePhase', '三级阶段', 'nestedThree', 40, {
    loadOptions: nestedStageOptionsLoader,
    required: true,
    type: 'select',
    valueType: 'string',
  }),
  nestedField('nestedThreeDetail', '三级内容', 'nestedThree', 50, {
    maxLength: 256,
  }),
  nestedField('nestedThreeEventTime', '三级事件时间', 'nestedThree', 60, {
    required: true,
    type: 'datetime',
  }),

  // 第四层：false 是有效的必填布尔值，不能被当作空值。
  nestedField('nestedFourValue', '四级值', 'nestedFour', 10, {
    required: true,
    maxLength: 120,
  }),
  nestedField('nestedFourUnit', '四级单位', 'nestedFour', 20, {
    maxLength: 24,
  }),
  nestedField('nestedFourSource', '四级来源', 'nestedFour', 30, {
    maxLength: 64,
  }),
  nestedField('nestedFourVersion', '四级版本', 'nestedFour', 40, {
    maxLength: 32,
  }),
  nestedField('nestedFourComment', '四级备注', 'nestedFour', 50, {
    maxLength: 256,
  }),
  nestedField('nestedFourEnabled', '四级启用', 'nestedFour', 60, {
    required: true,
    type: 'switch',
    valueType: 'boolean',
  }),
];

export const pageMeta = {
  name: 'Demo',
  title: 'Demo',
  description: '维护 Demo 样例数据。',
} as const;

// 四级示例显式记录父组；公共表单仍按 CrudPageConfig 消费这些配置。
type NestedDemoPageConfig = Omit<CrudPageConfig, 'complexGroups'> & {
  complexGroups: Array<
    NonNullable<CrudPageConfig['complexGroups']>[number] & {
      parentKey?: string;
    }
  >;
};

export const demoPageCrudConfig: NestedDemoPageConfig = {
  apiBase: '/Demo',
  domainObject: true,
  apiService: demoService,
  defaultFormValues: {
    editable: false,
    enable: true,
    num: 99,
    orderCode: 1000,
    orgShared: false,
    tenantShared: false,
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  complexGroups: [
    {
      key: 'nestedOne',
      title: '四层嵌套对象',
      submitKey: 'nestedObject',
      fieldMappings: {
        nestedOneTitle: 'title',
        nestedOneCode: 'code',
        nestedOneDescription: 'description',
        nestedOneContact: 'contact',
        nestedOneRemark: 'remark',
        nestedOneSortOrder: 'sortOrder',
      },
    },
    {
      key: 'nestedTwo',
      parentKey: 'nestedOne',
      title: '第二层对象',
      submitKey: 'nestedObject.levelTwo',
      fieldMappings: {
        nestedTwoName: 'name',
        nestedTwoCategory: 'category',
        nestedTwoStatus: 'status',
        nestedTwoReference: 'reference',
        nestedTwoNote: 'note',
      },
    },
    {
      key: 'nestedThree',
      parentKey: 'nestedTwo',
      title: '第三层对象',
      submitKey: 'nestedObject.levelTwo.levelThree',
      fieldMappings: {
        nestedThreeLabel: 'label',
        nestedThreeIdentifier: 'identifier',
        nestedThreeOwner: 'owner',
        nestedThreePhase: 'phase',
        nestedThreeDetail: 'detail',
        nestedThreeEventTime: 'eventTime',
      },
    },
    {
      key: 'nestedFour',
      parentKey: 'nestedThree',
      title: '第四层对象',
      submitKey: 'nestedObject.levelTwo.levelThree.levelFour',
      fieldMappings: {
        nestedFourValue: 'value',
        nestedFourUnit: 'unit',
        nestedFourSource: 'source',
        nestedFourVersion: 'version',
        nestedFourComment: 'comment',
        nestedFourEnabled: 'enabled',
      },
    },
  ],
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
      layoutGroup: 'basic',
      layoutGroupTitle: '基础信息',
      layoutOrder: 5,
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
      visibleForPlatformUser: true,
    },
    {
      key: 'orgId',
      label: '所属组织',
      layoutGroup: 'basic',
      layoutOrder: 6,
      type: 'org-tree-select',
    },
    {
      key: 'ownerId',
      label: '所属用户',
      layoutGroup: 'basic',
      layoutOrder: 7,
      loadOptions: userOptionsLoader,
      remoteSearch: true,
      type: 'select',
    },
    {
      key: '__tenant',
      detail: false,
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
      label: '示例ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'mobile',
      label: '手机号码',
      layoutGroup: 'basic',
      layoutOrder: 10,
      search: true,
      table: true,
      width: 140,
    },
    {
      key: 'email',
      label: '邮箱',
      layoutGroup: 'basic',
      layoutOrder: 20,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'url',
      label: '普通链接',
      layoutGroup: 'basic',
      layoutOrder: 30,
      search: true,
      table: true,
      width: 200,
    },
    {
      key: 'qrCode',
      label: '二维码',
      layoutGroup: 'basic',
      layoutOrder: 40,
      type: 'qrcode',
    },
    {
      key: 'location',
      label: '地理位置',
      layoutGroup: 'basic',
      layoutOrder: 50,
      table: true,
      width: 180,
    },
    {
      key: 'areaCode',
      label: '省市区行政编码',
      layoutGroup: 'basic',
      layoutOrder: 60,
      areaCascader: {
        selectableLevels: ['district'],
        valueKey: 'areaCode',
      },
      table: true,
      type: 'area-cascader',
      width: 180,
    },
    {
      key: 'timeRange',
      label: '时间范围',
      layoutGroup: 'basic',
      layoutOrder: 70,
    },
    {
      key: 'treeOrg',
      label: '树形组织',
      layoutGroup: 'basic',
      layoutOrder: 80,
      type: 'org-tree-select',
    },
    ...nestedObjectFields,
    {
      key: 'imageUrl',
      label: '单张图片',
      layoutGroup: 'media',
      layoutGroupTitle: '媒体资源',
      layoutOrder: 10,
      layoutNewRow: true,
      table: true,
      type: 'image',
      width: 120,
    },
    {
      key: 'imageUrls',
      label: '图片集',
      layoutGroup: 'media',
      layoutOrder: 20,
      multiple: true,
      type: 'image',
    },
    {
      key: 'fileUrl',
      label: '文件链接',
      layoutGroup: 'media',
      layoutOrder: 30,
      type: 'file',
    },
    {
      key: 'pdfFileUrl',
      label: 'PDF文件',
      layoutGroup: 'media',
      layoutOrder: 40,
      type: 'file',
    },
    {
      key: 'num',
      label: '数值',
      layoutGroup: 'business',
      layoutGroupTitle: '时间与数值',
      layoutOrder: 10,
      type: 'number',
    },
    {
      key: 'gteLocalDateTime',
      label: '时间日期开始',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteLocalDateTime',
      label: '时间日期结束',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'localDateTime',
      label: '时间日期',
      layoutGroup: 'business',
      layoutOrder: 20,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'gteLocalDate',
      label: '日期开始',
      form: false,
      search: true,
      type: 'date',
    },
    {
      key: 'lteLocalDate',
      label: '日期结束',
      form: false,
      search: true,
      type: 'date',
    },
    {
      key: 'localDate',
      label: '日期',
      layoutGroup: 'business',
      layoutOrder: 30,
      table: true,
      type: 'date',
      width: 160,
    },
    {
      key: 'gteLocalTime',
      label: '时间开始',
      form: false,
      search: true,
      type: 'time',
    },
    {
      key: 'lteLocalTime',
      label: '时间结束',
      form: false,
      search: true,
      type: 'time',
    },
    {
      key: 'localTime',
      label: '时间',
      layoutGroup: 'business',
      layoutOrder: 40,
      table: true,
      type: 'time',
      width: 140,
    },
    // 其余明确属于创建请求的普通字段继续使用现有控件，不从名称推断选项。
    {
      key: 'tenantShared',
      label: '租户间共享',
      layoutGroup: 'business',
      layoutOrder: 50,
      table: true,
      type: 'switch',
      valueType: 'boolean',
    },
    {
      key: 'orgShared',
      label: '组织间共享',
      layoutGroup: 'business',
      layoutOrder: 60,
      table: true,
      type: 'switch',
      valueType: 'boolean',
    },
    {
      key: 'orderCode',
      label: '排序代码',
      layoutGroup: 'business',
      layoutOrder: 70,
      type: 'number',
      valueType: 'number',
    },
    {
      key: 'enable',
      label: '是否启用',
      layoutGroup: 'business',
      layoutOrder: 80,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
    },
    {
      key: 'editable',
      label: '是否可编辑',
      layoutGroup: 'business',
      layoutOrder: 90,
      table: true,
      type: 'switch',
      valueType: 'boolean',
    },
    {
      key: 'jsonData',
      label: 'JSON数据',
      layoutGroup: 'content',
      layoutGroupTitle: '内容与组件',
      layoutOrder: 10,
      type: 'json',
    },
    {
      key: 'htmlData',
      label: 'HTML',
      layoutGroup: 'content',
      layoutOrder: 20,
      fullRow: true,
      type: 'html',
    },
    {
      key: 'jsCode',
      label: 'JavaScript代码',
      layoutGroup: 'content',
      layoutOrder: 30,
      type: 'code',
    },
    {
      key: 'cssCode',
      label: 'CSS代码',
      layoutGroup: 'content',
      layoutOrder: 40,
      type: 'css',
    },
    {
      key: 'conditionData',
      label: '逻辑条件编辑',
      layoutGroup: 'content',
      layoutOrder: 50,
      type: 'code',
    },
    { key: 'slider', label: '滑块', layoutGroup: 'content', layoutOrder: 60 },
    {
      key: 'transfer',
      label: '穿梭器',
      layoutGroup: 'content',
      layoutOrder: 70,
    },
    {
      key: 'multiSelect',
      label: '多选',
      layoutGroup: 'content',
      layoutOrder: 80,
    },
    {
      key: 'singleSelect',
      label: '单选',
      layoutGroup: 'content',
      layoutOrder: 90,
    },
    {
      key: 'remark',
      label: '备注',
      layoutGroup: 'content',
      layoutOrder: 100,
      fullRow: true,
      maxLength: 512,
      type: 'textarea',
    },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: 'Demo',
  transformSubmit: (values) => {
    const nextValues = { ...values };

    if (Array.isArray(nextValues.imageUrls)) {
      nextValues.imageUrls = nextValues.imageUrls.join(',');
    }

    return nextValues;
  },
};
