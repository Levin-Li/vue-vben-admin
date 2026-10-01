<script lang="ts" setup>
import { computed, reactive, ref } from 'vue';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { Alert, Button, Form, Input, message, Modal } from 'ant-design-vue';

import { electronicInvoiceService } from '../../api/electronic-invoice-service';
import CrudPage from '../crud-page.vue';
import { electronicInvoicePageCrudConfig } from './config';

interface InvoiceRecord {
  id?: string;
  status?: string;
  tenantId?: string;
}

const redIssueOpen = ref(false);
const redIssueSubmitting = ref(false);
const selectedInvoice = ref<InvoiceRecord>();
const reloadInvoices = ref<() => Promise<void> | void>();
const redIssueForm = reactive({ redRequestNo: '', redReason: '' });
const { hasPermission } = useRbacAccess();
const redIssuePermission = buildApiMethodPermissions(
  electronicInvoiceService,
  'redIssue',
);

const pageConfig = computed(() => ({
  ...electronicInvoicePageCrudConfig,
  rowActions: [
    {
      handler: async (record: InvoiceRecord) => {
        await electronicInvoiceService.reconcile({
          id: record.id,
          tenantId: record.tenantId,
        });
      },
      label: '重新对账',
      permission: buildApiMethodPermissions(
        electronicInvoiceService,
        'reconcile',
      ),
      visible: (record: InvoiceRecord) => record.status === 'Processing',
    },
  ],
}));

// 行插槽提供当前表格原位刷新函数，保留用户的查询、分页和排序状态。
function openRedIssue(
  record: InvoiceRecord,
  reload: () => Promise<void> | void,
) {
  selectedInvoice.value = record;
  reloadInvoices.value = reload;
  redIssueForm.redRequestNo = '';
  redIssueForm.redReason = '';
  redIssueOpen.value = true;
}

async function submitRedIssue() {
  if (!selectedInvoice.value?.id) {
    message.warning('未找到需要红冲的电子发票');
    return;
  }
  if (!redIssueForm.redRequestNo.trim() || !redIssueForm.redReason.trim()) {
    message.warning('请填写红冲业务单号和红冲原因');
    return;
  }
  redIssueSubmitting.value = true;
  try {
    await electronicInvoiceService.redIssue({
      originalInvoiceId: selectedInvoice.value.id,
      tenantId: selectedInvoice.value.tenantId,
      redRequestNo: redIssueForm.redRequestNo.trim(),
      redReason: redIssueForm.redReason.trim(),
    });
    message.success('红冲申请已提交');
    redIssueOpen.value = false;
    try {
      await reloadInvoices.value?.();
    } catch {
      message.warning('红冲已提交，但列表刷新失败');
    }
  } catch (error) {
    console.error(error);
    message.error('红冲申请提交失败');
  } finally {
    redIssueSubmitting.value = false;
  }
}
</script>

<template>
  <div class="electronic-invoice-page">
    <Alert
      description="请以商户自身税号为销方提交申请。申请号用于幂等；提交后票面冻结，失败后可修正并用同一申请号重新提交。红冲会创建关联原票的独立红字票。"
      message="商户自用电子发票"
      show-icon
      type="info"
    />
    <CrudPage :config="pageConfig">
      <template #row-actions="{ record, reload }">
        <Button
          v-if="record.status === 'Issued' && hasPermission(redIssuePermission)"
          size="small"
          type="link"
          @click="openRedIssue(record, reload)"
        >
          申请红冲
        </Button>
      </template>
    </CrudPage>
  </div>

  <Modal
    v-model:open="redIssueOpen"
    :confirm-loading="redIssueSubmitting"
    :mask-closable="false"
    destroy-on-close
    ok-text="提交红冲"
    title="申请电子发票红冲"
    @ok="submitRedIssue"
  >
    <Form layout="vertical">
      <Form.Item label="红冲业务单号" required>
        <Input v-model:value="redIssueForm.redRequestNo" :maxlength="128" />
      </Form.Item>
      <Form.Item label="红冲原因" required>
        <Input.TextArea
          v-model:value="redIssueForm.redReason"
          :maxlength="512"
          :rows="4"
        />
      </Form.Item>
    </Form>
  </Modal>
</template>

<style scoped>
.electronic-invoice-page {
  display: grid;
  gap: 12px;
}
</style>
