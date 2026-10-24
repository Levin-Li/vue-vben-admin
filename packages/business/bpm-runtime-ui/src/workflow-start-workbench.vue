<script setup lang="ts">
import type {
  WorkflowInstanceView,
  WorkflowManualStart,
  WorkflowStartPage,
  WorkflowStartRecord,
} from './types';
import type { WorkflowRuntimeService } from './workflow-runtime-service';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import CrudLayout from '@levin/admin-framework/framework-commons/shared/crud-layout.vue';
// 发起页明确使用本包组件，宿主只提供实际 API 权限和授权连接器。
import {
  Alert as AAlert,
  Button as AButton,
  Empty as AEmpty,
  Space as ASpace,
  Table as ATable,
} from 'ant-design-vue';

import WorkflowBusinessPanel from './workflow-business-panel.vue';

const props = defineProps<{
  canReadCatalog: boolean;
  canReadEligibility: boolean;
  canReadRecords: boolean;
  canStart: boolean;
  service: WorkflowRuntimeService;
  /** 来自宿主已授权范围选择，不能由文本框或 URL 随意传入。 */
  tenantId?: string;
}>();
const emit = defineEmits<{
  error: [error: unknown];
  started: [instance: WorkflowInstanceView];
}>();

// 每页固定有界读取；列表不拼接全量数据，也不自行推断业务记录或定义。
const catalog = ref<WorkflowStartPage<WorkflowManualStart>>({
  items: [],
  pageIndex: 1,
  hasMore: false,
});
const records = ref<WorkflowStartPage<WorkflowStartRecord>>({
  items: [],
  pageIndex: 1,
  hasMore: false,
});
// 分页说明只反映当前页，API没有授权总数时不推算总页数。
const catalogPageSummary = computed(
  () =>
    `第 ${catalog.value.pageIndex} 页 · 本页 ${catalog.value.items.length} 条`,
);
const recordsPageSummary = computed(
  () =>
    `第 ${records.value.pageIndex} 页 · 本页 ${records.value.items.length} 条`,
);
const selectedPurpose = ref<WorkflowManualStart>();
const selectedRecord = ref<WorkflowStartRecord>();
// 展示标题不属于启动载荷，命令只提交明确的业务引用和范围。
const selectedReference = computed(() => {
  const record = selectedRecord.value;
  return record
    ? {
        businessId: record.businessId,
        businessType: record.businessType,
        contractVersion: selectedPurpose.value?.contractVersion,
        tenantId: record.tenantId,
        orgId: record.orgId,
      }
    : undefined;
});
const catalogLoading = ref(false);
const recordsLoading = ref(false);
const catalogError = ref(false);
const recordsError = ref(false);
let catalogGeneration = 0;
let recordsGeneration = 0;

// 对象/用途切换和撤权立即清除旧引用，迟到响应无法恢复已撤销的选择。
function clearRecords() {
  recordsGeneration++;
  records.value = { items: [], pageIndex: 1, hasMore: false };
  selectedRecord.value = undefined;
  recordsLoading.value = false;
  recordsError.value = false;
}
async function loadCatalog(pageIndex = 1) {
  const generation = ++catalogGeneration;
  clearRecords();
  selectedPurpose.value = undefined;
  catalog.value = { items: [], pageIndex, hasMore: false };
  catalogError.value = false;
  catalogLoading.value = false;
  if (!props.canReadCatalog || !props.canStart) return;
  catalogLoading.value = true;
  try {
    const result = await props.service.manualStarts({
      tenantId: props.tenantId,
      pageIndex,
      pageSize: 20,
    });
    if (generation !== catalogGeneration) return;
    catalog.value = result;
  } catch (error) {
    if (generation !== catalogGeneration) return;
    catalogError.value = true;
    emit('error', error);
  } finally {
    if (generation === catalogGeneration) catalogLoading.value = false;
  }
}
async function loadRecords(pageIndex = 1) {
  const purpose = selectedPurpose.value;
  clearRecords();
  const generation = recordsGeneration;
  records.value.pageIndex = pageIndex;
  if (
    !purpose ||
    !props.canReadCatalog ||
    !props.canReadRecords ||
    !props.canStart
  )
    return;
  recordsLoading.value = true;
  try {
    const result = await props.service.businessRecords({
      tenantId: props.tenantId,
      businessType: purpose.businessType,
      contractVersion: purpose.contractVersion,
      ...(purpose.contractVersion === 'state-graph-v4'
        ? { purposeKey: purpose.purposeKey }
        : {}),
      pageIndex,
      pageSize: 20,
    });
    if (generation !== recordsGeneration) return;
    // 只接受所选受控业务类型的引用，绝不根据任意主键补读对象。
    records.value = {
      ...result,
      items: result.items.filter(
        (item) => item.businessType === purpose.businessType,
      ),
    };
  } catch (error) {
    if (generation !== recordsGeneration) return;
    recordsError.value = true;
    emit('error', error);
  } finally {
    if (generation === recordsGeneration) recordsLoading.value = false;
  }
}
function selectPurpose(item: WorkflowManualStart) {
  if (
    !props.canReadCatalog ||
    !props.canStart ||
    !catalog.value.items.includes(item)
  )
    return;
  selectedPurpose.value = item;
  void loadRecords();
}
function selectRecord(item: WorkflowStartRecord) {
  if (
    !props.canReadCatalog ||
    !props.canReadRecords ||
    !props.canReadEligibility ||
    !props.canStart ||
    !records.value.items.includes(item)
  )
    return;
  selectedRecord.value = item;
}

// 权限和宿主范围变化重新读取第一页，旧页和对象详情不保留。
watch(
  () => [
    props.tenantId,
    props.service,
    props.canReadCatalog,
    props.canReadRecords,
    props.canReadEligibility,
    props.canStart,
  ],
  () => {
    void loadCatalog();
  },
  { immediate: true, flush: 'sync' },
);
onBeforeUnmount(() => {
  catalogGeneration++;
  recordsGeneration++;
});
</script>

<template>
  <div class="levin-workflow-start-workbench space-y-4">
    <!-- 当前权限逐项约束目录、记录、资格及启动；菜单权限不替代 API 权限。 -->
    <AAlert
      v-if="!canReadCatalog || !canStart"
      type="info"
      message="当前没有查询手动流程目录或发起流程的权限。"
    />
    <!-- 选择流程仍是专用操作，列表复用标准CRUD分区与表格样式。 -->
    <CrudLayout
      v-else
      form-id="workflow-start-catalog"
      form-name="选择手动流程"
    >
      <template #toolbar>
        <h2 class="mr-auto font-medium">1. 选择手动流程</h2>
        <AButton :loading="catalogLoading" @click="loadCatalog()">
          刷新流程
        </AButton>
      </template>
      <ATable
        :data-source="catalog.items"
        :loading="catalogLoading"
        :pagination="false"
        :scroll="{ x: 600 }"
        :row-key="
          (item: WorkflowManualStart) =>
            `${item.businessType}:${item.contractVersion}:${item.purposeKey}`
        "
      >
        <ATable.Column
          title="流程名称"
          data-index="definitionName"
          key="definitionName"
        />
        <ATable.Column
          title="办理事项"
          data-index="purposeName"
          key="purposeName"
        />
        <ATable.Column title="操作" key="actions" fixed="right" :width="120">
          <template #default="{ record: item }">
            <AButton
              :aria-label="`选择流程${item.purposeName}`"
              :type="selectedPurpose === item ? 'primary' : 'link'"
              @click="selectPurpose(item)"
            >
              选择
            </AButton>
          </template>
        </ATable.Column>
        <template #emptyText>
          <AEmpty
            :description="
              catalogError
                ? '流程加载失败，请刷新重试。'
                : '当前没有有权发起的手动流程。'
            "
          >
            <AButton v-if="catalogError" size="small" @click="loadCatalog()">
              重试
            </AButton>
          </AEmpty>
        </template>
      </ATable>
      <!-- API只有页码和继续信号，不展示未经授权计算的总数。 -->
      <template #footer>
        <ASpace wrap>
          <AButton
            :disabled="catalogLoading || catalog.pageIndex <= 1"
            @click="loadCatalog(catalog.pageIndex - 1)"
          >
            上一页流程
          </AButton>
          <span>{{ catalogPageSummary }}</span>
          <AButton
            :disabled="catalogLoading || !catalog.hasMore"
            @click="loadCatalog(catalog.pageIndex + 1)"
          >
            下一页流程
          </AButton>
        </ASpace>
      </template>
    </CrudLayout>

    <!-- 业务记录沿原授权选择接口分页，选择后才加载发起资格。 -->
    <CrudLayout
      v-if="selectedPurpose"
      form-id="workflow-start-records"
      form-name="选择业务记录"
    >
      <template #toolbar>
        <h2 class="mr-auto font-medium">2. 选择业务记录</h2>
        <AButton
          v-if="canReadRecords"
          :loading="recordsLoading"
          @click="loadRecords()"
        >
          刷新记录
        </AButton>
      </template>
      <AAlert
        v-if="!canReadRecords"
        type="info"
        message="当前没有查询流程业务记录的权限。"
      />
      <template v-else>
        <ATable
          :data-source="records.items"
          :loading="recordsLoading"
          :pagination="false"
          :scroll="{ x: 500 }"
          :row-key="
            (item: WorkflowStartRecord) =>
              `${item.businessType}:${item.businessId}`
          "
        >
          <ATable.Column title="业务记录" key="businessTitle">
            <template #default="{ record: item }">
              {{ item.businessTitle || '未命名业务记录' }}
            </template>
          </ATable.Column>
          <ATable.Column title="操作" key="actions" fixed="right" :width="160">
            <template #default="{ record: item }">
              <AButton
                :aria-label="`选择记录${item.businessTitle || '未命名业务记录'}`"
                :disabled="!canReadEligibility"
                :type="selectedRecord === item ? 'primary' : 'link'"
                @click="selectRecord(item)"
              >
                查看发起资格
              </AButton>
            </template>
          </ATable.Column>
          <template #emptyText>
            <AEmpty
              :description="
                recordsError
                  ? '业务记录加载失败，请刷新重试。'
                  : '当前页没有有权查看的业务记录。'
              "
            >
              <AButton v-if="recordsError" size="small" @click="loadRecords()">
                重试
              </AButton>
            </AEmpty>
          </template>
        </ATable>
        <AAlert
          v-if="!canReadEligibility"
          class="mt-3"
          type="info"
          message="当前没有查询发起资格的权限。"
        />
      </template>
      <template v-if="canReadRecords" #footer>
        <ASpace wrap>
          <AButton
            :disabled="recordsLoading || records.pageIndex <= 1"
            @click="loadRecords(records.pageIndex - 1)"
          >
            上一页记录
          </AButton>
          <span>{{ recordsPageSummary }}</span>
          <AButton
            :disabled="recordsLoading || !records.hasMore"
            @click="loadRecords(records.pageIndex + 1)"
          >
            下一页记录
          </AButton>
        </ASpace>
      </template>
    </CrudLayout>

    <!-- 复用业务对象入口的资格与幂等启动命令，自动用途不会产生手动按钮。 -->
    <WorkflowBusinessPanel
      v-if="
        selectedReference && selectedPurpose && canReadEligibility && canStart
      "
      :business-reference="selectedReference"
      :purpose-key="selectedPurpose.purposeKey"
      :can-start="canStart"
      :service="service"
      :show-history="false"
      @error="emit('error', $event)"
      @started="emit('started', $event)"
    />
  </div>
</template>
