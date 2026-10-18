<script setup lang="ts">
import type { UploadProps } from 'ant-design-vue';

import type {
  SettlementCommand,
  SettlementPaymentCommand,
  SettlementRecord,
} from '../../api/settlement-statement-service';
import type { SettlementActionMethod } from './actions';

import { computed, onBeforeUnmount, reactive, ref } from 'vue';

import { fileStorageService } from '@levin/admin-framework/framework-commons/app/api/file-storage-service';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  message,
  Modal,
  Timeline,
  Upload,
} from 'ant-design-vue';

import { fileResService } from '../../api/file-res-service';
import { settlementStatementService } from '../../api/settlement-statement-service';
import CrudPage from '../crud-page.vue';
import {
  canRunSettlementAction,
  decimalUnits,
  positiveMoney,
  settlementActions,
  settlementStatusLabels,
} from './actions';
import {
  buildSettlementPageConfig,
  settlementFinancialPermission,
} from './config';
import SettlementContentEditor from './content-editor.vue';
import { uploadSettlementProof } from './proof-upload';

const { hasPermission } = useRbacAccess();
const allowed = (method: string) =>
  hasPermission(buildApiMethodPermissions(settlementStatementService, method));
const action = ref<SettlementActionMethod>();
const selected = ref<SettlementRecord>();
const busy = ref(false);
const uploading = ref(false);
const actionError = ref('');
const proofName = ref('');
const proofUrl = ref('');
const form = reactive({
  amount: '',
  paidTime: '',
  proofFileResId: '',
  invoiceRefId: '',
  reason: '',
  remark: '',
  newAmount: '',
});
const frozenPayment = ref<SettlementPaymentCommand>();
const financial = ref<SettlementRecord>();
const financialOpen = ref(false);
const financialError = ref('');
const financialLoading = ref(false);
let selectionVersion = 0;
let financialVersion = 0;
let completeAction: ((value?: unknown) => void) | undefined;
const actionTitle = computed(
  () =>
    settlementActions.find((item) => item.method === action.value)?.label ||
    '结算操作',
);
const actionSubmitLabel = computed(() =>
  actionTitle.value.startsWith('确认')
    ? actionTitle.value
    : `确认${actionTitle.value}`,
);
const canUpload = computed(
  () =>
    hasPermission(
      buildApiMethodPermissions(fileStorageService, 'uploadFile'),
    ) && hasPermission(buildApiMethodPermissions(fileResService, 'create')),
);
const logs = computed(() =>
  (financial.value?.actionLog || []).toSorted((left, right) =>
    String(left.occurTime || '').localeCompare(String(right.occurTime || '')),
  ),
);
const financialGroups = [
  { key: 'payeeBankAccount', title: '收款账户' },
  { key: 'payerInvoiceInfo', title: '付款方开票资料' },
  { key: 'invoiceDocuments', title: '发票单据' },
  { key: 'paymentDocuments', title: '付款单据' },
  { key: 'settlementContent', title: '结算业务内容' },
] as const;

// 打开动作前刷新摘要，支持事件、权限与版本均取最新服务端结果。
async function openAction(
  method: SettlementActionMethod,
  record: SettlementRecord,
) {
  if (
    !allowed(method) ||
    !canRunSettlementAction(method, record) ||
    busy.value ||
    action.value
  )
    throw new Error('当前状态或权限不允许该操作');
  const version = ++selectionVersion;
  const latest = await settlementStatementService.retrieve({
    id: record.id,
  });
  if (version !== selectionVersion) return;
  if (!allowed(method) || !canRunSettlementAction(method, latest))
    throw new Error('结算状态已变化，请刷新列表');
  selected.value = latest;
  Object.assign(form, {
    amount: '',
    paidTime: '',
    proofFileResId: '',
    invoiceRefId: '',
    reason: '',
    remark: '',
    newAmount: '',
  });
  frozenPayment.value = undefined;
  proofName.value = '';
  proofUrl.value = '';
  actionError.value = '';
  action.value = method;
  return new Promise((resolve) => {
    completeAction = resolve;
  });
}
function closeAction() {
  if (busy.value || uploading.value) return;
  selectionVersion++;
  action.value = undefined;
  selected.value = undefined;
  frozenPayment.value = undefined;
  completeAction?.();
  completeAction = undefined;
}
const uploadProof: NonNullable<UploadProps['customRequest']> = async (
  options,
) => {
  if (
    !selected.value ||
    !canUpload.value ||
    uploading.value ||
    frozenPayment.value
  )
    return;
  if (!(options.file instanceof File)) {
    options.onError?.(new Error('请选择本地凭证文件'));
    return;
  }
  const version = selectionVersion;
  uploading.value = true;
  actionError.value = '';
  try {
    const uploaded = await uploadSettlementProof(options.file, selected.value);
    if (version !== selectionVersion) return;
    form.proofFileResId = uploaded.id;
    proofUrl.value = uploaded.url;
    proofName.value = options.file.name;
    options.onSuccess?.(uploaded.id);
  } catch (error) {
    if (version === selectionVersion)
      actionError.value =
        error instanceof Error ? error.message : '凭证上传失败';
    options.onError?.(
      error instanceof Error ? error : new Error('凭证上传失败'),
    );
  } finally {
    uploading.value = false;
  }
};

// 仅提交动作 DTO 白名单；打款首次提交后冻结请求，失败重试复用相同键和内容。
async function submitAction() {
  const record = selected.value;
  const method = action.value;
  if (
    !record ||
    !method ||
    busy.value ||
    uploading.value ||
    !allowed(method) ||
    !canRunSettlementAction(method, record)
  )
    return;
  actionError.value = '';
  const command: SettlementCommand = {
    id: record.id,
    optimisticLock: record.optimisticLock,
    remark: form.remark || undefined,
  };
  try {
    if (method === 'invoice' && !form.invoiceRefId.trim())
      throw new Error('请输入实际发票编号或引用');
    if (
      (method === 'returnInvoice' || method === 'adjustAmount') &&
      !form.reason.trim()
    )
      throw new Error('请输入原因');
    if (method === 'adjustAmount') {
      const error = positiveMoney(form.newAmount);
      if (error) throw new Error(error);
      const current = decimalUnits(form.newAmount);
      const paid = decimalUnits(record.paidAmount);
      if (current !== undefined && paid !== undefined && current < paid)
        throw new Error('调整后金额不得低于已打款累计');
    }
    if (method === 'registerPayment' && !frozenPayment.value) {
      const error = positiveMoney(form.amount);
      if (error) throw new Error(error);
      const amount = decimalUnits(form.amount);
      const total = decimalUnits(record.settlementAmount);
      const paid = decimalUnits(record.paidAmount);
      if (
        amount !== undefined &&
        total !== undefined &&
        paid !== undefined &&
        amount > total - paid
      )
        throw new Error('本次金额超过未打款余额');
      if (!form.proofFileResId) throw new Error('请先上传交易流水凭证');
      if (!form.paidTime || new Date(form.paidTime).getTime() > Date.now())
        throw new Error('请选择不晚于当前时间的实际打款时间');
      frozenPayment.value = {
        ...command,
        amount: form.amount,
        paidTime: form.paidTime,
        proofFileResId: form.proofFileResId,
        requestKey: crypto.randomUUID(),
      };
    }
    busy.value = true;
    let result: SettlementRecord;
    switch (method) {
      case 'adjustAmount': {
        result = await settlementStatementService.adjustAmount({
          ...command,
          newAmount: form.newAmount,
          reason: form.reason,
        });
        break;
      }
      case 'invoice': {
        result = await settlementStatementService.invoice({
          ...command,
          invoiceRefId: form.invoiceRefId,
        });
        break;
      }
      case 'registerPayment': {
        result = await settlementStatementService.registerPayment(
          frozenPayment.value!,
        );
        break;
      }
      case 'returnInvoice': {
        result = await settlementStatementService.returnInvoice({
          ...command,
          reason: form.reason,
        });
        break;
      }
      default: {
        result = await settlementStatementService[method](command);
      }
    }
    action.value = undefined;
    selected.value = undefined;
    frozenPayment.value = undefined;
    financial.value = undefined;
    financialOpen.value = false;
    financialVersion++;
    completeAction?.(result);
    completeAction = undefined;
    message.success('结算操作已完成');
  } catch (error) {
    actionError.value =
      error instanceof Error
        ? error.message
        : '操作失败，请核对当前权限、状态和版本后重试';
  } finally {
    busy.value = false;
  }
}

// 财务详情每次独立授权读取；没有返回的分组不渲染，也不从列表或旧详情补值。
async function openFinancial(record: SettlementRecord) {
  const version = ++financialVersion;
  financial.value = undefined;
  financialError.value = '';
  financialOpen.value = true;
  if (!hasPermission(settlementFinancialPermission)) {
    financialError.value = '没有结算资料读取权限';
    return;
  }
  financialLoading.value = true;
  try {
    const data = await settlementStatementService.readFinancialDetails({
      id: record.id,
    });
    if (version === financialVersion && financialOpen.value)
      financial.value = data;
  } catch {
    if (version === financialVersion)
      financialError.value = '结算资料不可访问或权限已变化';
  } finally {
    if (version === financialVersion) financialLoading.value = false;
  }
}
function closeFinancial() {
  financialVersion++;
  financial.value = undefined;
  financialOpen.value = false;
  financialLoading.value = false;
}
const config = buildSettlementPageConfig(openAction, openFinancial);
onBeforeUnmount(() => {
  selectionVersion++;
  financialVersion++;
  completeAction?.();
});
</script>

<template>
  <CrudPage :config="config">
    <template #form-field-settlementContent="{ disabled, formState }">
      <SettlementContentEditor
        v-model="formState.settlementContent"
        :id="formState.id"
        :tenant-id="formState.tenantId"
        :org-id="formState.orgId"
        :disabled="disabled"
      />
    </template>
  </CrudPage>
  <Modal
    :open="Boolean(action)"
    :title="actionTitle"
    :confirm-loading="busy"
    :closable="!busy && !uploading"
    :mask-closable="false"
    :keyboard="!busy && !uploading"
    width="720px"
    @cancel="closeAction"
    @ok="submitAction"
  >
    <Alert
      v-if="actionError"
      :message="actionError"
      type="error"
      class="mb-3"
    />
    <Alert
      v-if="frozenPayment"
      message="本次打款请求已固定，失败重试使用同一请求键与内容；提交结果不明确时请先核对单据。"
      type="info"
      class="mb-3"
    />
    <Form
      name="settlement-flow-action"
      data-form-id="settlement-flow-action"
      data-form-name="结算流程操作"
      layout="vertical"
    >
      <Form.Item
        v-if="action === 'invoice'"
        label="实际发票编号或引用"
        required
      >
        <Input
          v-model:value="form.invoiceRefId"
          :maxlength="128"
          :disabled="busy"
        />
      </Form.Item>
      <template v-if="action === 'registerPayment'">
        <Form.Item label="本次打款金额" required>
          <Input
            v-model:value="form.amount"
            :disabled="busy || Boolean(frozenPayment)"
            placeholder="正数，最多四位小数"
          />
        </Form.Item>
        <Form.Item label="实际打款时间" required>
          <DatePicker
            v-model:value="form.paidTime"
            value-format="YYYY-MM-DDTHH:mm:ss"
            show-time
            class="w-full"
            :disabled="busy || Boolean(frozenPayment)"
          />
        </Form.Item>
        <Form.Item label="交易流水凭证" required>
          <Upload
            :custom-request="uploadProof"
            :show-upload-list="false"
            :disabled="
              busy || uploading || Boolean(frozenPayment) || !canUpload
            "
          >
            <Button
              :loading="uploading"
              :disabled="busy || Boolean(frozenPayment) || !canUpload"
            >
              {{ proofName ? '替换凭证' : '上传凭证' }}
            </Button>
          </Upload>
          <div v-if="proofName" class="mt-2">
            <span>已登记凭证：</span>
            <a :href="proofUrl" target="_blank" rel="noopener noreferrer">
              {{ proofName }}
            </a>
          </div>
          <Alert
            v-if="!canUpload"
            type="warning"
            message="上传凭证需要文件上传权限及文件资源新增权限。"
          />
        </Form.Item>
      </template>
      <Form.Item v-if="action === 'adjustAmount'" label="协商后金额" required>
        <Input
          v-model:value="form.newAmount"
          :disabled="busy"
          placeholder="大于零且不低于已打款累计"
        />
      </Form.Item>
      <Form.Item
        v-if="action === 'returnInvoice' || action === 'adjustAmount'"
        :label="action === 'returnInvoice' ? '退回原因' : '调整说明'"
        required
      >
        <Input.TextArea
          v-model:value="form.reason"
          :maxlength="512"
          :disabled="busy"
        />
      </Form.Item>
      <Form.Item label="备注">
        <Input.TextArea
          v-model:value="form.remark"
          :maxlength="512"
          :disabled="busy || Boolean(frozenPayment)"
        />
      </Form.Item>
    </Form>
    <template #footer>
      <Button :disabled="busy || uploading" @click="closeAction"> 取消 </Button>
      <Button
        type="primary"
        :loading="busy"
        :disabled="uploading"
        @click="submitAction"
      >
        {{ actionSubmitLabel }}
      </Button>
    </template>
  </Modal>
  <Modal
    :open="financialOpen"
    title="结算财务资料"
    :footer="null"
    width="960px"
    @cancel="closeFinancial"
  >
    <Alert v-if="financialLoading" type="info" message="正在读取授权财务资料" />
    <Alert v-if="financialError" type="error" :message="financialError" />
    <Alert
      v-if="
        financial &&
        !financialGroups.some((group) => financial?.[group.key] != null) &&
        financial.actionLog == null
      "
      type="info"
      message="当前账号没有可查看的财务字段组。"
    />
    <template v-if="financial">
      <template v-for="group in financialGroups" :key="group.key">
        <section v-if="financial[group.key] != null" class="mb-4">
          <h3 class="mb-2 font-medium">{{ group.title }}</h3>
          <pre
            class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border p-3"
            v-text="JSON.stringify(financial[group.key], null, 2)"
          ></pre>
        </section>
      </template>
      <section v-if="financial.actionLog != null">
        <h3 class="mb-2 font-medium">操作日志</h3>
        <Timeline>
          <Timeline.Item v-for="(log, index) in logs" :key="index">
            <div>{{ log.occurTime }}</div>
            <div>{{ log.operator }}</div>
            <div>
              {{ settlementStatusLabels[log.beforeStatus || ''] || '初始' }} →
              {{ log.action }} →
              {{
                settlementStatusLabels[log.afterStatus || ''] || '状态不可用'
              }}
            </div>
            <div v-if="log.remark?.trim()">{{ log.remark }}</div>
          </Timeline.Item>
        </Timeline>
      </section>
    </template>
  </Modal>
</template>
