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
        key: 'id',
        label: '发票申请ID',
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
        help: '正式开票时应填写供应商已授权的票种编码；模拟联调可按测试数据填写。',
        width: 140,
      },
      {
        key: 'direction',
        label: '发票方向',
        form: false,
        search: true,
        table: true,
        width: 110,
      },
      {
        key: 'status',
        label: '开票状态',
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
        form: false,
        table: true,
        type: 'datetime',
        width: 180,
      },
    ],
  });
