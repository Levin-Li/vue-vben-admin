<script lang="ts" setup>
import type { ContractSealPosition } from '../../components/electronic-contract/contract-document-preview-utils';

import { computed, ref } from 'vue';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { Alert, Button, Card, Input, Select } from 'ant-design-vue';

import { channelPartnerService } from '../../api/channel-partner-service';
import { customerService } from '../../api/customer-service';
import { electronicContractService } from '../../api/electronic-contract-service';
import { electronicContractSimulationService } from '../../api/electronic-contract-simulation-service';
import { electronicContractTemplateService } from '../../api/electronic-contract-template-service';
import { legalSubjectService } from '../../api/legal-subject-service';
import { supplierPartnerService } from '../../api/supplier-partner-service';
import { ElectronicContractDocumentPreview } from '../../components/electronic-contract';
import CrudPage from '../crud-page.vue';
import { electronicContractPageCrudConfig } from './config';
import ContractPreviewPanel from './contract-preview-panel.vue';

type ContractPartyKind = 'ChannelPartner' | 'Customer' | 'SupplierPartner';
type Option = { label: string; value: string };
type Template = {
  id: string;
  name: string;
  status?: string;
  templateFieldSchema?: unknown;
};
type TemplateField = { key: string; required?: boolean; title: string };

// 列表接口可能返回原始分页或统一响应包装，统一抽取当前页记录。
function listItems(response: unknown): Record<string, unknown>[] {
  const payload =
    response && typeof response === 'object' && 'data' in response
      ? (response as { data: unknown }).data
      : response;
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const page = payload as {
      items?: unknown;
      list?: unknown;
      records?: unknown;
    };
    for (const items of [page.items, page.records, page.list]) {
      if (Array.isArray(items)) return items;
    }
  }
  return [];
}

const templateOptions = ref<Option[]>([]);
const subjectOptions = ref<Option[]>([]);
const counterpartyOptions = ref<Option[]>([]);
const templates = ref<Template[]>([]);
const templatePage = ref(0);
const subjectPage = ref(0);
const counterpartyPage = ref(0);
const draftForm = ref({
  templateId: '',
  contractNo: '',
  name: '',
  partyALegalSubjectId: '',
  counterpartyKind: 'Customer' as ContractPartyKind,
  counterpartyId: '',
  providerCode: '',
  templateValues: {} as Record<string, string>,
});
const draftContract = ref<null | Record<string, any>>(null);
const draftBusy = ref(false);
const draftMessage = ref('');
const draftError = ref('');
const signingUrl = ref('');
const { hasPermission } = useRbacAccess();
const signingEntryPermission = buildApiMethodPermissions(
  electronicContractService,
  'signingEntry',
);
const canReceiveSigningEntry = computed(() =>
  hasPermission(signingEntryPermission),
);

const templateFields = computed<TemplateField[]>(() => {
  const selected = templates.value.find(
    (item) => String(item.id) === draftForm.value.templateId,
  );
  const schema = selected?.templateFieldSchema;
  const parsed =
    typeof schema === 'string'
      ? (() => {
          try {
            return JSON.parse(schema);
          } catch {
            return [];
          }
        })()
      : schema;
  return Array.isArray(parsed)
    ? parsed.filter(
        (field) =>
          field &&
          typeof field.key === 'string' &&
          typeof field.title === 'string',
      )
    : [];
});

// 选择器只列出已上线模板及当前权限可见的签约主体。
async function loadDraftOptions() {
  draftError.value = '';
  try {
    templatePage.value = 0;
    subjectPage.value = 0;
    templates.value = [];
    templateOptions.value = [];
    subjectOptions.value = [];
    await Promise.all([loadMoreTemplates(), loadMoreSubjects()]);
    await loadCounterparties();
  } catch (error) {
    draftError.value =
      error instanceof Error ? error.message : '加载签约选项失败';
  }
}

async function loadMoreTemplates() {
  const next = templatePage.value + 1;
  const items = listItems(
    await electronicContractTemplateService.list({
      pageIndex: next,
      pageSize: 100,
      status: 'Published',
    }),
  );
  templatePage.value = next;
  const added = items.filter(
    (item) =>
      item.id !== null && item.id !== undefined && item.status === 'Published',
  ) as Template[];
  templates.value = [...templates.value, ...added];
  templateOptions.value = templates.value.map((item) => ({
    label: item.name,
    value: String(item.id),
  }));
}

async function loadMoreSubjects() {
  const next = subjectPage.value + 1;
  const items = listItems(
    await legalSubjectService.list({ pageIndex: next, pageSize: 100 }),
  );
  subjectPage.value = next;
  subjectOptions.value = [
    ...subjectOptions.value,
    ...items
      .filter((item) => item.id !== null && item.id !== undefined)
      .map((item) => ({
        label: String(item.subjectName || item.name || item.id),
        value: String(item.id),
      })),
  ];
}

async function loadCounterparties() {
  draftForm.value.counterpartyId = '';
  counterpartyPage.value = 0;
  counterpartyOptions.value = [];
  await loadMoreCounterparties();
}

async function loadMoreCounterparties() {
  let service = channelPartnerService;
  if (draftForm.value.counterpartyKind === 'Customer')
    service = customerService;
  else if (draftForm.value.counterpartyKind === 'SupplierPartner')
    service = supplierPartnerService;
  try {
    const next = counterpartyPage.value + 1;
    const response = await service.list({ pageIndex: next, pageSize: 100 });
    counterpartyPage.value = next;
    counterpartyOptions.value = [
      ...counterpartyOptions.value,
      ...listItems(response)
        .filter((item) => item.id !== null && item.id !== undefined)
        .map((item) => ({
          label: String(
            item.name || item.displayName || item.subjectName || item.id,
          ),
          value: String(item.id),
        })),
    ];
  } catch (error) {
    counterpartyOptions.value = [];
    draftError.value =
      error instanceof Error ? error.message : '加载签约对方失败';
  }
}

function unwrapRecord(response: unknown): Record<string, any> {
  const data =
    response && typeof response === 'object' && 'data' in response
      ? (response as { data: unknown }).data
      : response;
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, any>)
    : {};
}

// 服务端负责变量替换、文件冻结和两方快照；页面先校验必填输入。
async function createTemplateDraft() {
  const form = draftForm.value;
  draftError.value = '';
  if (
    !form.templateId ||
    !form.contractNo.trim() ||
    !form.name.trim() ||
    !form.partyALegalSubjectId ||
    !form.counterpartyId
  ) {
    draftError.value = '请填写模板、合同号、合同名称及甲乙双方';
    return;
  }
  const missing = templateFields.value.find(
    (field) => field.required && !form.templateValues[field.key]?.trim(),
  );
  if (missing) {
    draftError.value = `请填写${missing.title}`;
    return;
  }
  draftBusy.value = true;
  try {
    draftContract.value = unwrapRecord(
      await electronicContractService.createFromTemplate({
        ...form,
        providerCode: form.providerCode || undefined,
        templateValues: { ...form.templateValues },
      }),
    );
    if (!draftContract.value.id) throw new Error('创建草稿未返回合同 ID');
    draftMessage.value = '合同文件已生成，请预览确认后提交签署。';
    signingUrl.value = '';
  } catch (error) {
    draftError.value = error instanceof Error ? error.message : '模板出约失败';
  } finally {
    draftBusy.value = false;
  }
}

async function submitTemplateDraft() {
  if (!draftContract.value?.id) return;
  draftBusy.value = true;
  draftError.value = '';
  try {
    draftContract.value = {
      ...draftContract.value,
      ...unwrapRecord(
        await electronicContractService.submitSigning({
          id: draftContract.value.id,
        }),
      ),
    };
    draftMessage.value = '已提交签署，可分别领取甲方或乙方签署入口。';
  } catch (error) {
    draftError.value = error instanceof Error ? error.message : '提交签署失败';
  } finally {
    draftBusy.value = false;
  }
}

// 模板草稿修改变量或双方时，只走受控重新生成接口。
async function regenerateTemplateDraft() {
  if (!draftContract.value?.id || draftContract.value.status !== 'Draft')
    return;
  draftError.value = '';
  const missing = templateFields.value.find(
    (field) =>
      field.required && !draftForm.value.templateValues[field.key]?.trim(),
  );
  if (missing) {
    draftError.value = `请填写${missing.title}`;
    return;
  }
  draftBusy.value = true;
  try {
    draftContract.value = unwrapRecord(
      await electronicContractService.regenerateFromTemplate({
        ...draftForm.value,
        contractId: String(draftContract.value.id),
        providerCode: draftForm.value.providerCode || undefined,
        templateValues: { ...draftForm.value.templateValues },
      }),
    );
    draftMessage.value = '待签文件已重新生成，请再次预览确认。';
    signingUrl.value = '';
  } catch (error) {
    draftError.value =
      error instanceof Error ? error.message : '重新生成合同失败';
  } finally {
    draftBusy.value = false;
  }
}

async function getSigningEntry(signerIndex: 0 | 1, contractId?: string) {
  if (!canReceiveSigningEntry.value) {
    draftError.value = '当前账号没有领取签署入口权限';
    return;
  }
  const id = contractId || draftContract.value?.id;
  if (!id) return;
  draftError.value = '';
  try {
    const result = unwrapRecord(
      await electronicContractService.signingEntry({
        id: String(id),
        signerIndex,
      }),
    );
    if (typeof result.url !== 'string') throw new Error('签署入口无效');
    const target = new URL(result.url, window.location.origin);
    const localSimulation =
      target.origin === 'http://127.0.0.1:8081' &&
      target.pathname.startsWith(
        '/com.levin.oak.base/V1/api/EContractSimulation/esign/',
      );
    if (
      target.protocol !== 'https:' &&
      target.origin !== window.location.origin &&
      !localSimulation
    ) {
      throw new Error('签署入口无效');
    }
    signingUrl.value = target.href;
    draftMessage.value =
      signerIndex === 0 ? '甲方签署入口已领取' : '乙方签署入口已领取';
  } catch (error) {
    draftError.value =
      error instanceof Error ? error.message : '领取签署入口失败';
  }
}

const previewUrl = ref('');
const previewPositionsText = ref(
  JSON.stringify(
    [
      {
        height: 0.12,
        pageNo: 1,
        signerLabel: '甲方签章',
        source: 'override',
        width: 0.22,
        x: 0.64,
        y: 0.78,
      },
    ],
    null,
    2,
  ),
);
type ContractSimulationData = {
  contractNo?: string;
  id?: string;
  orgId?: string;
  ownerId?: string;
  status?: string;
  tenantId?: string;
  url?: string;
};

const simulationContractId = ref('contract-001');
const simulationTenantId = ref('');
const simulationOrgId = ref('');
const simulationOwnerId = ref('');
const simulationStatus = ref('Draft');
const simulationMessage = ref(
  '选择草稿合同后，可逐步模拟提交签署、查看日志、复制重签和下载已签文件。',
);
const simulationMessageType = ref<'info' | 'success' | 'warning'>('info');

previewUrl.value = '/mock-files/electronic-contract-sample.docx';

const previewState = computed<{
  error: string;
  positions: ContractSealPosition[];
}>(() => {
  try {
    const parsed = JSON.parse(previewPositionsText.value || '[]');
    return { positions: Array.isArray(parsed) ? parsed : [], error: '' };
  } catch (error) {
    return {
      positions: [],
      error: error instanceof Error ? error.message : '签章位置 JSON 解析失败',
    };
  }
});
const previewPositions = computed(() => previewState.value.positions);
const previewError = computed(() => previewState.value.error);

const canSubmitSigning = computed(() => simulationStatus.value === 'Draft');
const canReceiveCallback = computed(() => simulationStatus.value === 'Signing');
const canReplayCompletedCallback = computed(() =>
  ['Signed', 'Signing'].includes(simulationStatus.value),
);
const canCancelSigning = computed(() => simulationStatus.value === 'Signing');
const canDownloadSignedFile = computed(
  () => simulationStatus.value === 'Signed',
);
const canCopyForResign = computed(() =>
  ['Archived', 'Canceled', 'Expired', 'Rejected', 'Signed'].includes(
    simulationStatus.value,
  ),
);
const canArchive = computed(() =>
  ['Canceled', 'Expired', 'Rejected', 'Signed'].includes(
    simulationStatus.value,
  ),
);

async function loadSimulationContract() {
  try {
    const response = await electronicContractService.retrieve({
      id: simulationContractId.value,
      orgId: simulationOrgId.value || undefined,
      ownerId: simulationOwnerId.value || undefined,
      tenantId: simulationTenantId.value || undefined,
    });
    // 同时识别服务返回的实体与标准 data 包装，字段访问保持在已知合同摘要内。
    const payload: unknown =
      response && typeof response === 'object' && 'data' in response
        ? response.data
        : response;
    const data =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as ContractSimulationData)
        : {};
    simulationTenantId.value = data?.tenantId || simulationTenantId.value;
    simulationOrgId.value = data?.orgId || simulationOrgId.value;
    simulationOwnerId.value = data?.ownerId || simulationOwnerId.value;
    // 服务端返回未知非空状态时保留原值；所有动作仅对明确的已知状态开放。
    simulationStatus.value = data?.status?.trim() || 'Draft';
    simulationMessage.value = `合同 ${data?.contractNo || simulationContractId.value} 已加载，当前状态：${simulationStatus.value}。`;
    simulationMessageType.value = 'success';
  } catch (error) {
    simulationMessage.value =
      error instanceof Error ? error.message : '加载合同状态失败';
    simulationMessageType.value = 'warning';
  }
}

async function runSimulationAction(
  action:
    | 'archive'
    | 'cancelSigning'
    | 'copyForResign'
    | 'downloadSignedFile'
    | 'providerCallback'
    | 'signingLog'
    | 'submitSigning',
  extraData: Record<string, unknown> = {},
) {
  try {
    const request = {
      id: simulationContractId.value,
      orgId: simulationOrgId.value || undefined,
      ownerId: simulationOwnerId.value || undefined,
      tenantId: simulationTenantId.value || undefined,
      ...extraData,
    };
    const response =
      action === 'providerCallback'
        ? await electronicContractSimulationService.complete(request)
        : await electronicContractService[action](request);
    const payload: unknown =
      response && typeof response === 'object' && 'data' in response
        ? response.data
        : response;
    const data =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as ContractSimulationData)
        : {};
    if (data?.status?.trim()) {
      simulationStatus.value = data.status.trim();
    }
    if (action === 'signingLog') {
      simulationMessage.value = `签署日志读取成功，共 ${Array.isArray(payload) ? payload.length : 0} 条。`;
    } else if (action === 'downloadSignedFile') {
      simulationMessage.value = `已签文件下载地址：${data?.url || '模拟文件已就绪'}`;
    } else {
      simulationMessage.value = `模拟${action}成功，当前状态：${data?.status || '已更新'}。`;
    }
    if (action === 'copyForResign' && data?.id) {
      simulationContractId.value = data.id;
      simulationStatus.value = data.status?.trim() || 'Draft';
      simulationMessage.value += ` 已自动切换到重签草稿：${data.id}。`;
    }
    simulationMessageType.value = 'success';
  } catch (error) {
    const technicalCallback =
      action === 'providerCallback' && extraData.status === 'Failed';
    if (technicalCallback) {
      simulationMessage.value =
        '供应商技术异常，合同保持签署中，可稍后重试或撤销。';
    } else if (error instanceof Error && error.message) {
      simulationMessage.value = error.message;
    } else {
      simulationMessage.value = '模拟流程执行失败';
    }
    simulationMessageType.value = 'warning';
  }
}
</script>

<template>
  <div class="electronic-contract-page">
    <!-- 两方模板出约先产生冻结文件，人工确认后再发起签署。 -->
    <Card title="按模板创建两方合同" size="small">
      <div class="electronic-contract-page__inputs">
        <Button @click="loadDraftOptions">加载可用模板和签约主体</Button>
        <Select
          v-model:value="draftForm.templateId"
          :disabled="!!draftContract?.id"
          :options="templateOptions"
          placeholder="选择已上线模板"
          show-search
          option-filter-prop="label"
        />
        <Button @click="loadMoreTemplates">加载更多模板</Button>
        <Input
          v-model:value="draftForm.contractNo"
          :disabled="!!draftContract?.id"
          placeholder="合同号"
        />
        <Input v-model:value="draftForm.name" placeholder="合同名称" />
        <Select
          v-model:value="draftForm.partyALegalSubjectId"
          :options="subjectOptions"
          placeholder="甲方：本方法律主体"
          show-search
          option-filter-prop="label"
        />
        <Button @click="loadMoreSubjects">加载更多本方法律主体</Button>
        <Select
          v-model:value="draftForm.counterpartyKind"
          :options="[
            { label: '客户', value: 'Customer' },
            { label: '供应伙伴', value: 'SupplierPartner' },
            { label: '渠道伙伴', value: 'ChannelPartner' },
          ]"
          @change="loadCounterparties"
        />
        <Select
          v-model:value="draftForm.counterpartyId"
          :options="counterpartyOptions"
          placeholder="乙方：客户或伙伴"
          show-search
          option-filter-prop="label"
        />
        <Button @click="loadMoreCounterparties">加载更多乙方</Button>
        <Input
          v-model:value="draftForm.providerCode"
          placeholder="电子签服务商代码（可选）"
        />
        <label v-for="field in templateFields" :key="field.key">
          {{ field.title }}{{ field.required ? ' *' : '' }}
          <Input
            v-model:value="draftForm.templateValues[field.key]"
            :placeholder="`填写 ${field.title}`"
          />
        </label>
        <Button
          v-if="!draftContract?.id"
          type="primary"
          :loading="draftBusy"
          @click="createTemplateDraft"
        >
          生成合同文件
        </Button>
        <Button
          v-else-if="draftContract.status === 'Draft'"
          :loading="draftBusy"
          @click="regenerateTemplateDraft"
        >
          重新生成待签文件
        </Button>
        <Alert v-if="draftError" :message="draftError" type="error" show-icon />
        <Alert
          v-if="draftMessage"
          :message="draftMessage"
          type="success"
          show-icon
        />
      </div>
      <div v-if="draftContract?.id" class="electronic-contract-page__inputs">
        <ContractPreviewPanel :contract="draftContract" />
        <div class="electronic-contract-page__actions">
          <Button
            type="primary"
            :loading="draftBusy"
            :disabled="draftContract.status !== 'Draft'"
            @click="submitTemplateDraft"
          >
            确认文件并提交签署
          </Button>
          <Button
            v-if="canReceiveSigningEntry"
            :disabled="draftContract.status !== 'Signing'"
            @click="getSigningEntry(0)"
          >
            领取甲方签署入口
          </Button>
          <Button
            v-if="canReceiveSigningEntry"
            :disabled="draftContract.status !== 'Signing'"
            @click="getSigningEntry(1)"
          >
            领取乙方签署入口
          </Button>
        </div>
        <Button
          v-if="signingUrl"
          type="link"
          :href="signingUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          打开当前领取的签署入口
        </Button>
      </div>
    </Card>

    <!-- 以下保留既有文档预览和模拟验收入口。 -->
    <Card title="合同文档预览与模拟签章" size="small">
      <div class="electronic-contract-page__inputs">
        <Input
          v-model:value="previewUrl"
          placeholder="输入受控 Word 文件链接后即可预览"
        />
        <Input.TextArea
          v-model:value="previewPositionsText"
          :auto-size="{ minRows: 4, maxRows: 10 }"
          placeholder="输入签章位置 JSON 数组"
        />
      </div>
      <Alert
        v-if="previewError"
        :message="previewError"
        class="electronic-contract-page__alert"
        type="warning"
      />
      <ElectronicContractDocumentPreview
        :document-url="previewUrl"
        :positions="previewPositions"
      />
    </Card>

    <Card title="两方签约模拟流程" size="small">
      <div class="electronic-contract-page__inputs">
        <Input
          v-model:value="simulationContractId"
          placeholder="输入电子合同 ID"
        />
        <Input
          v-model:value="simulationTenantId"
          placeholder="归属租户 ID（超管必填）"
        />
        <Button @click="loadSimulationContract">加载合同状态</Button>
        <Alert
          :message="`当前合同状态：${simulationStatus}`"
          type="info"
          show-icon
        />
        <div class="electronic-contract-page__actions">
          <Button
            type="primary"
            :disabled="!canSubmitSigning"
            @click="runSimulationAction('submitSigning')"
          >
            提交签署
          </Button>
          <Button
            type="primary"
            :disabled="!canReceiveCallback"
            @click="
              runSimulationAction('providerCallback', {
                eventId: `complete-${simulationContractId}`,
                status: 'Signed',
              })
            "
          >
            模拟签署完成回调
          </Button>
          <Button
            :disabled="!canReceiveCallback"
            @click="
              runSimulationAction('providerCallback', {
                eventId: `reject-${simulationContractId}`,
                status: 'Rejected',
              })
            "
          >
            模拟拒签回调
          </Button>
          <Button
            :disabled="!canReceiveCallback"
            @click="
              runSimulationAction('providerCallback', {
                eventId: `expired-${simulationContractId}`,
                status: 'Expired',
              })
            "
          >
            模拟签署过期
          </Button>
          <Button
            :disabled="!canReceiveCallback"
            @click="
              runSimulationAction('providerCallback', {
                eventId: `technical-${simulationContractId}`,
                status: 'Failed',
              })
            "
          >
            模拟供应商技术异常
          </Button>
          <Button
            v-if="canReceiveSigningEntry"
            :disabled="!canReceiveCallback"
            @click="getSigningEntry(0, simulationContractId)"
          >
            领取甲方签署入口
          </Button>
          <Button
            v-if="canReceiveSigningEntry"
            :disabled="!canReceiveCallback"
            @click="getSigningEntry(1, simulationContractId)"
          >
            领取乙方签署入口
          </Button>
          <Button
            :disabled="!canReplayCompletedCallback"
            @click="
              runSimulationAction('providerCallback', {
                eventId: `complete-${simulationContractId}`,
                status: 'Signed',
              })
            "
          >
            重复完成回调
          </Button>
          <Button @click="runSimulationAction('signingLog')">
            查看签署日志
          </Button>
          <Button
            :disabled="!canDownloadSignedFile"
            @click="runSimulationAction('downloadSignedFile')"
          >
            下载已签文件
          </Button>
          <Button
            :disabled="!canCopyForResign"
            @click="runSimulationAction('copyForResign')"
          >
            复制重签
          </Button>
          <Button
            danger
            :disabled="!canCancelSigning"
            @click="runSimulationAction('cancelSigning')"
          >
            撤销签署
          </Button>
          <Button
            :disabled="!canArchive"
            @click="runSimulationAction('archive')"
          >
            归档合同
          </Button>
        </div>
        <Alert
          :message="simulationMessage"
          :type="simulationMessageType"
          show-icon
        />
        <Button
          v-if="signingUrl"
          type="link"
          :href="signingUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          打开当前领取的签署入口
        </Button>
      </div>
    </Card>

    <CrudPage :config="electronicContractPageCrudConfig" />
  </div>
</template>

<style scoped>
.electronic-contract-page {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr);
}

.electronic-contract-page__inputs {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
}

.electronic-contract-page__alert {
  margin-bottom: 12px;
}

.electronic-contract-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
</style>
