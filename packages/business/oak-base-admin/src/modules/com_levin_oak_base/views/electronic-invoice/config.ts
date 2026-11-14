import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { electronicInvoiceService } from '../../api/electronic-invoice-service';
import { fixedCrudDataAttrTargets } from '../../api/standard-crud-data-attr-targets';
import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
  withModuleCrudConfig,
} from '../api-module';

const electronicInvoiceStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.EInvoice$Status',
);
export const pageMeta = {
  name: 'ElectronicInvoice',
  title: '开票申请',
  description: '提交和跟踪开票申请，开具成功后查看票据链接。',
} as const;

export const electronicInvoicePageCrudConfig: CrudPageConfig =
  withModuleCrudConfig({
    apiBase: '/EInvoice',
    domainObject: true,
    apiService: electronicInvoiceService,
    dataAttrTargets: fixedCrudDataAttrTargets(electronicInvoiceService, {
      list: { method: 'GET', path: 'list' },
      retrieve: { method: 'GET', path: 'retrieve' },
    }),
    createPath: '/EInvoice/issue',
    createSubmitKeys: ['amountWithoutTax', 'taxAmount', 'amountWithTax'],
    allowEdit: false,
    allowDelete: false,
    title: '开票申请',
    modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
    transformSubmit: async (values) => {
      const items = Array.isArray(values.itemList) ? values.itemList : [];
      if (
        items.length === 0 ||
        items.some(
          (item) =>
            !item.itemName?.trim() ||
            !Number.isFinite(Number(item.quantity)) ||
            !Number.isFinite(Number(item.unitPrice)),
        )
      ) {
        throw new Error('请填写至少一项完整的票面明细。');
      }
      if (!values.buyerInfo?.name?.trim() || !values.buyerInfo?.taxNo?.trim()) {
        throw new Error('请填写购买方名称和纳税人识别号。');
      }
      const amountWithoutTax = Number(
        items
          .reduce((sum, item) => sum + Number(item.amountWithoutTax ?? 0), 0)
          .toFixed(4),
      );
      const taxAmount = Number(
        items
          .reduce((sum, item) => sum + Number(item.taxAmount ?? 0), 0)
          .toFixed(4),
      );
      const amountWithTax = Number((amountWithoutTax + taxAmount).toFixed(4));

      if (
        !Number.isFinite(amountWithoutTax) ||
        !Number.isFinite(taxAmount) ||
        !Number.isFinite(amountWithTax)
      ) {
        throw new TypeError('请填写有效的不含税金额、税额和价税合计。');
      }

      if (Math.abs(amountWithoutTax + taxAmount - amountWithTax) > 0.0001) {
        throw new Error('不含税金额与税额之和必须等于价税合计。');
      }

      return {
        ...values,
        requestNo: undefined,
        bizType: undefined,
        amountWithoutTax,
        taxAmount,
        amountWithTax,
      };
    },
    // 单独声明详情字段，保留表格、查询和提交配置。
    detailExtraFields: [
      {
        key: 'tenantName',
        label: '租户名称',
        detail: false,
      },
      {
        key: 'orgId',
        label: '组织标识',
        detail: false,
      },
      {
        key: 'orgName',
        label: '组织名称',
        detail: false,
      },
      {
        key: 'ownerId',
        label: '所有者标识',
        detail: false,
      },
      {
        key: 'ownerName',
        label: '拥有者名称',
      },
      {
        key: 'owner',
        label: '所有者',
        detail: false,
      },
      {
        key: 'confidentialLevel',
        label: '机密等级',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 45,
      },
      {
        key: 'techServiceProviderCode',
        label: '技术服务商编码',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 50,
      },
      {
        key: 'techServiceData',
        label: '技术服务临时数据',
        detail: false,
      },
      {
        key: 'bizOrderId',
        label: '外部业务订单ID',
      },
      {
        key: 'actionLog',
        label: '流程日志',
        detail: false,
      },
      {
        key: 'applyProcessSnapshotList',
        label: '申请处理过程快照列表',
        detail: false,
      },
      {
        key: 'lastStatusTime',
        label: '最后状态时间',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 55,
        type: 'datetime',
      },
      {
        key: 'supportEventsByCurrentStatus',
        label: '当前支持事件',
        detail: false,
      },
      {
        key: 'invoiceQrCode',
        label: '发票二维码或查验标识',
      },
      {
        key: 'issuedTime',
        label: '开票成功时间',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 60,
        type: 'datetime',
      },
      {
        key: 'amountWithTaxUppercase',
        label: '价税合计大写',
      },
      {
        key: 'drawerName',
        label: '开票人名称快照',
      },
      {
        key: 'domainId',
        label: '领域标识',
        detail: false,
      },
      {
        key: 'creator',
        label: '创建者',
        detail: false,
      },
      {
        key: 'lastUpdateTime',
        label: '更新时间',
        layoutOrder: 925,
        type: 'datetime',
      },
      {
        key: 'orderCode',
        label: '排序代码',
        layoutOrder: 900,
      },
      {
        key: 'enable',
        label: '是否启用',
        layoutOrder: 905,
        type: 'switch',
      },
      {
        key: 'editable',
        label: '是否可编辑',
        layoutOrder: 910,
        type: 'switch',
      },
      {
        key: 'remark',
        label: '备注',
        layoutOrder: 915,
      },
      {
        key: 'optimisticLock',
        label: '乐观锁版本号',
        detail: false,
      },
    ],
    fields: [
      {
        key: 'tenantId',
        label: '归属租户',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 5,
        loadOptions: tenantOptionsLoader,
        remoteSearch: true,
        search: true,
        type: 'select',
        visibleForPlatformUser: true,
      },
      {
        key: 'id',
        label: '发票申请ID',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 10,
        form: false,
        search: true,
        table: true,
        width: 180,
      },
      {
        key: 'containsRequestNo',
        label: '申请号',
        form: false,
        search: true,
      },
      {
        key: 'requestNo',
        label: '申请号',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 15,
        form: false,
        table: false,
        width: 180,
      },
      {
        key: 'partnerId',
        label: '销售方公司',
        form: false,
        search: true,
        table: true,
        tableValue: (record) =>
          record.sellerSnapshot?.subjectName || record.partnerId,
        type: 'select',
        width: 220,
      },
      {
        key: 'issuerChannelAuthorizationId',
        label: '销售方公司及开票授权',
        help: '请选择您有权使用的公司及其有效开票授权。',
        required: true,
        type: 'select',
        table: false,
      },
      {
        key: 'bizType',
        label: '外部业务类型',
        form: false,
        search: true,
        width: 140,
      },
      {
        key: 'buyerInfo',
        label: '购买方信息',
        help: '购买方开票抬头对应 buyerInfo.name；专票再填写地址、电话和银行资料。',
        type: 'json',
        table: false,
      },
      { key: 'invoiceReceiveEmail', label: '发票接收邮箱', width: 200 },
      {
        key: 'amountWithoutTax',
        label: '不含税金额',
        required: true,
        form: false,
        type: 'number',
        width: 130,
      },
      {
        key: 'taxAmount',
        label: '税额',
        required: true,
        form: false,
        type: 'number',
        width: 120,
      },
      {
        key: 'amountWithTax',
        label: '价税合计',
        required: true,
        form: false,
        type: 'number',
        table: true,
        width: 130,
      },
      {
        key: 'invoiceType',
        label: '票种',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 25,
        help: '正式开票时应填写供应商已授权的票种编码；模拟联调可按测试数据填写。',
        width: 140,
      },
      {
        key: 'direction',
        label: '发票方向',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 40,
        form: false,
        search: true,
        table: true,
        width: 110,
      },
      {
        key: 'status',
        label: '开票状态',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 35,
        loadOptions: electronicInvoiceStatusOptionsLoader,
        search: true,
        table: true,
        form: false,
        type: 'select',
        width: 130,
      },
      {
        key: 'invoiceNo',
        label: '发票号码',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 20,
        form: false,
        table: true,
        width: 150,
      },
      { key: 'sellerSnapshot', label: '销方快照', type: 'json', form: false },
      {
        key: 'itemList',
        label: '票面明细',
        help: '逐项填写项目、数量、单价和税率；金额与税额自动计算。',
        type: 'json',
        required: true,
        table: false,
      },
      {
        key: 'originalInvoiceId',
        label: '原发票ID',
        form: false,
        detail: true,
        width: 160,
      },
      {
        key: 'redReason',
        label: '红冲原因',
        form: false,
        detail: true,
        width: 180,
      },
      {
        key: 'invoiceFileUrl',
        label: '票据文档链接',
        form: false,
        detail: true,
        width: 220,
      },
      {
        key: 'lastStatusDesc',
        label: '最后状态描述',
        form: false,
        detail: true,
        width: 220,
      },
      {
        key: 'errorMessage',
        label: '错误信息',
        form: false,
        detail: true,
        width: 260,
      },
      {
        key: 'createTime',
        label: '申请时间',
        layoutOrder: 920,
        form: false,
        table: true,
        type: 'datetime',
        width: 180,
      },
    ],
  });
