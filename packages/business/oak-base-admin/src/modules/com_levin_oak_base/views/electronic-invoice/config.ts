import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { electronicInvoiceService } from '../../api/electronic-invoice-service';
import {
  buildModuleOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
  withModuleCrudConfig,
} from '../api-module';

const partnerOptions = buildModuleOptionsLoader(
  '/Partner/list',
  'subjectName',
  'id',
);
export const pageMeta = {
  name: 'ElectronicInvoice',
  title: '电子发票',
  description: '维护电子发票。',
} as const;

export const electronicInvoicePageCrudConfig: CrudPageConfig =
  withModuleCrudConfig({
    apiBase: '/EInvoice',
    apiService: electronicInvoiceService,
    createPath: '/EInvoice/issue',
    title: '电子发票',
    modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
    transformSubmit: async (values) => {
      const amountWithoutTax = Number(values.amountWithoutTax);
      const taxAmount = Number(values.taxAmount);
      const amountWithTax = Number(values.amountWithTax);

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

      return values;
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
        required: true,
        table: true,
        width: 180,
      },
      {
        key: 'partnerId',
        label: '销方合作伙伴',
        help: '请选择已完成开票资料维护并已开通供应商连接的商户主体；提交后系统会冻结该主体的票面快照。',
        required: true,
        loadOptions: partnerOptions,
        remoteSearch: true,
        search: true,
        table: true,
        type: 'select',
        width: 220,
      },
      {
        key: 'bizType',
        label: '业务类型',
        required: true,
        search: true,
        table: true,
        width: 140,
      },
      {
        key: 'buyerInfo',
        label: '购方开票信息',
        help: '按票种填写购方抬头、税号及需要的专票资料。',
        type: 'json',
        table: false,
      },
      { key: 'invoiceReceiveEmail', label: '发票接收邮箱', width: 200 },
      {
        key: 'amountWithoutTax',
        label: '不含税金额',
        required: true,
        type: 'number',
        width: 130,
      },
      {
        key: 'taxAmount',
        label: '税额',
        required: true,
        type: 'number',
        width: 120,
      },
      {
        key: 'amountWithTax',
        label: '价税合计',
        required: true,
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
        search: true,
        table: true,
        form: false,
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
        help: '每项填写项目名称、规格、单位、数量、单价、金额、税率和税额。',
        type: 'json',
        table: false,
      },
      {
        key: 'originalInvoiceId',
        label: '原发票ID',
        form: false,
        table: true,
        width: 160,
      },
      {
        key: 'redReason',
        label: '红冲原因',
        form: false,
        table: true,
        width: 180,
      },
      {
        key: 'invoiceFileUrl',
        label: '发票文件链接',
        form: false,
        table: true,
        width: 220,
      },
      {
        key: 'lastStatusDesc',
        label: '最后状态描述',
        form: false,
        table: true,
        width: 220,
      },
      {
        key: 'errorMessage',
        label: '错误信息',
        form: false,
        table: true,
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
