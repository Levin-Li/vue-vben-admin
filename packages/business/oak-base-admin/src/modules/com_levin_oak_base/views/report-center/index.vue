<script setup lang="ts">
import type { UserOrgSelectorModelValue } from '@levin/admin-framework';
import type {
  ReportManagementInfo,
  ReportManagementSummary,
  ReportPageDesign,
  ReportSourceCatalog,
  ReportVersion,
} from '../../api/report-definition-management-service';
import type { ReportRuntimePage } from '../report-view/report-runtime';

import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue';
import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/runtime/stores';
import { UserOrgSelector } from '@levin/admin-framework';
import { notifyApiErrorOnce } from '@levin/admin-framework/framework-commons/app/api';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  isPlatformUser,
  isSuperAdminUser,
} from '@levin/admin-framework/framework-commons/shared/user-identity';
import {
  Alert,
  Button,
  Input,
  message,
  Modal,
  Pagination,
  Popconfirm,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import { ReportDefinitionManagementService } from '../../api/report-definition-management-service';
import { isReportRateLimited } from '../../api/report-rate-limit';
import { menuService } from '../../api/menu-service';
import { ReportMenuService } from '../../api/report-menu-service';
import { ReportPreviewService } from '../../api/report-preview-service';
import ReportRuntimeView from '../report-view/report-runtime-view.vue';
import ReportDesignEditor from './report-design-editor.vue';
import { newReportDesign, validateReportDesign } from './report-design';

const service = new ReportDefinitionManagementService(true);
const reportMenuService = new ReportMenuService(true);
const reportPreviewService = new ReportPreviewService(true);

// 每个操作使用对应 API 的权限声明，后端仍会重新验证权限及归属。
const { hasPermission } = useRbacAccess();
const allowed = (method: string) =>
  hasPermission(buildApiMethodPermissions(service, method));
const user = useUserStore();
const access = useAccessStore();
// 只有平台主体且没有租户归属时，创建接口才处于全局视角。
const platform = computed(
  () => isPlatformUser(user.userInfo) && !user.userInfo?.tenantId,
);
const context = computed(() =>
  JSON.stringify({ user: user.userInfo, permissions: access.accessCodes }),
);
const rows = ref<ReportManagementSummary[]>([]);
const pageIndex = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(false);
const menuEnabled = ref(false);
const menuCapabilityKnown = ref(false);
const capabilityPending = ref(false);
const writeEnabled = ref(false);
const savedPreviewEnabled = ref(false);
const busyReportId = ref('');
const previewOpen = ref(false);
const previewLoading = ref(false);
const previewPage = ref<ReportRuntimePage>();
const previewVersion = ref<ReportVersion>();
const previewDatasetId = ref<string>();
const error = ref('');
const editorOpen = ref(false);
const logsOpen = ref(false);
const logsLoading = ref(false);
const publicationLogs = ref<NonNullable<ReportManagementInfo['publicationLogs']>>([]);
const editorLoading = ref(false);
const saving = ref(false);
const refreshBlocked = ref(false);
const imagePending = ref(false);
const initialSnapshot = ref('');
const current = ref<ReportManagementInfo>();
const name = ref('');
const orgId = ref<null | string>(null);
const design = ref<ReportPageDesign>(newReportDesign('新报表'));
const catalog = ref<ReportSourceCatalog>({ sources: [], relations: [] });
const canPreviewSaved = computed(() => Boolean(current.value && savedPreviewEnabled.value
  && isSuperAdminUser(user.userInfo) && allowed('getDraft')
  && hasPermission(buildApiMethodPermissions(reportPreviewService, 'page'))));
let listGeneration = 0;
let editorGeneration = 0;
let menuGeneration = 0;
let previewGeneration = 0;
let logsGeneration = 0;
const suspended = ref(false);
let saveSequence = 0;

const columns = [
  { title: '报表名称', dataIndex: 'name', key: 'name' },
  {
    title: '草稿版本',
    dataIndex: 'definitionVersion',
    key: 'definitionVersion',
    width: 110,
  },
  { title: '发布状态', key: 'published', width: 130 },
  { title: '操作', key: 'actions', width: 200 },
];

// 范围或权限变化时清空旧结果，迟到的响应不能恢复过期内容。
async function loadList() {
  const generation = ++listGeneration;
  if (suspended.value) return;
  if (!allowed('list')) {
    rows.value = [];
    menuEnabled.value = false;
    menuCapabilityKnown.value = false;
    capabilityPending.value = false;
    writeEnabled.value = false;
    savedPreviewEnabled.value = false;
    total.value = 0;
    error.value = '当前账号没有报表管理列表权限';
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = '';
  menuEnabled.value = false;
  menuCapabilityKnown.value = false;
  capabilityPending.value = false;
  writeEnabled.value = false;
  savedPreviewEnabled.value = false;
  try {
    const result = await service.list({ pageIndex: pageIndex.value, pageSize: pageSize.value });
    if (generation !== listGeneration) return;
    rows.value = result.items || [];
    total.value = result.totals || 0;
    capabilityPending.value = true;
    void service.capabilities().then((capabilities) => {
      if (generation !== listGeneration || suspended.value) return;
      menuCapabilityKnown.value = typeof capabilities?.menuGenerationEnabled === 'boolean';
      menuEnabled.value = capabilities?.menuGenerationEnabled === true;
      writeEnabled.value = capabilities?.writeEnabled === true;
      savedPreviewEnabled.value = capabilities?.savedPreviewEnabled === true;
    }).catch(() => { /* 能力未知时保持操作关闭，列表仍可读取。 */ }).finally(() => {
      if (generation === listGeneration && !suspended.value) capabilityPending.value = false;
    });
  } catch (cause) {
    if (generation !== listGeneration) return;
    rows.value = [];
    menuEnabled.value = false;
    menuCapabilityKnown.value = false;
    capabilityPending.value = false;
    writeEnabled.value = false;
    savedPreviewEnabled.value = false;
    total.value = 0;
    error.value = '报表列表加载失败';
    notifyApiErrorOnce(cause);
  } finally {
    if (generation === listGeneration) loading.value = false;
  }
}

async function openEditor(id?: string) {
  if (!writeEnabled.value) return;
  const generation = ++editorGeneration;
  editorOpen.value = true;
  editorLoading.value = true;
  refreshBlocked.value = false;
  current.value = undefined;
  catalog.value = { sources: [], relations: [] };
  design.value = newReportDesign('新报表');
  name.value = '';
  orgId.value = platform.value
    ? null
    : String(user.userInfo?.orgId || '') || null;
  try {
    const [available, saved] = await Promise.all([
      service.catalog(),
      id ? service.getDraft(id) : Promise.resolve(undefined),
    ]);
    if (generation !== editorGeneration) return;
    catalog.value = available;
    if (saved) {
      current.value = saved;
      name.value = saved.name;
      orgId.value = saved.orgId || null;
      design.value = saved.draft
        ? structuredClone(saved.draft)
        : newReportDesign(saved.name);
    }
    initialSnapshot.value = editorSnapshot();
  } catch (cause) {
    if (generation !== editorGeneration) return;
    editorOpen.value = false;
    notifyApiErrorOnce(cause);
  } finally {
    if (generation === editorGeneration) editorLoading.value = false;
  }
}

// 日志与草稿使用相同的后端详情权限；切换身份或关闭后丢弃迟到响应。
async function openLogs(id: string) {
  const generation = ++logsGeneration;
  logsOpen.value = true;
  logsLoading.value = true;
  publicationLogs.value = [];
  try {
    const detail = await service.getDraft(id);
    if (generation === logsGeneration) publicationLogs.value = detail.publicationLogs || [];
  } catch (cause) {
    if (generation === logsGeneration) { logsOpen.value = false; notifyApiErrorOnce(cause); }
  } finally {
    if (generation === logsGeneration) logsLoading.value = false;
  }
}
function closeLogs() {
  logsGeneration += 1;
  logsOpen.value = false;
  logsLoading.value = false;
  publicationLogs.value = [];
}

// 关闭前比较当前业务值；修改后取消关闭不丢失草稿。
function editorSnapshot() {
  return JSON.stringify({
    name: name.value,
    orgId: orgId.value,
    design: design.value,
  });
}

function closeEditor() {
  editorGeneration += 1;
  editorOpen.value = false;
  saving.value = false;
}

function requestEditorClose() {
  if (saving.value) return;
  if (editorLoading.value || editorSnapshot() === initialSnapshot.value) {
    closeEditor();
    return;
  }
  Modal.confirm({
    title: '放弃未保存的修改？',
    content: '关闭后，本次尚未保存的报表设计将丢失。',
    okText: '放弃修改',
    cancelText: '继续编辑',
    onOk: closeEditor,
  });
}

function setOrganization(value: UserOrgSelectorModelValue) {
  orgId.value = typeof value === 'string' && value ? value : null;
}

async function save(keepEditing = false) {
  if (!writeEnabled.value || saving.value || editorLoading.value || refreshBlocked.value) return;
  if (imagePending.value) return void message.warning('图片仍在处理中，请稍候');
  const issues = validateReportDesign(design.value, catalog.value);
  if (!name.value.trim()) return void message.warning('请填写报表名称');
  if (!platform.value && !orgId.value)
    return void message.warning('请选择所属组织');
  if (issues.length) return void message.warning(issues[0]);
  // 保存完成时只更新发起请求的编辑器，避免身份切换后影响新草稿。
  const generation = editorGeneration;
  const actorContext = context.value;
  const savedSnapshot = editorSnapshot();
  const savedName = name.value.trim();
  const savedDesign = JSON.parse(JSON.stringify(design.value)) as ReportPageDesign;
  const editingId = current.value?.reportId;
  const expectedVersion = current.value?.definitionVersion;
  const expectedLock = current.value?.optimisticLock;
  const saveToken = ++saveSequence;
  let savedReportId = editingId;
  saving.value = true;
  try {
    if (current.value) {
      await service.saveDraft({
        reportId: current.value.reportId,
        expectedLock: current.value.optimisticLock,
        expectedDefinitionVersion: current.value.definitionVersion,
        name: savedName,
        menuId: current.value.menuId || null,
        design: savedDesign,
      });
    } else {
      savedReportId = await service.create({
        name: savedName,
        orgId: orgId.value,
        design: savedDesign,
      });
    }
    if (generation !== editorGeneration || actorContext !== context.value) return;
    message.success('报表草稿已保存');
    if ((keepEditing || editorSnapshot() !== savedSnapshot) && savedReportId) {
      initialSnapshot.value = savedSnapshot;
      try {
        const latest = await service.getDraft(savedReportId);
        if (generation !== editorGeneration || actorContext !== context.value) return;
        if (latest.definitionVersion !== (expectedVersion ?? 0) + 1
          || latest.optimisticLock !== (expectedLock ?? -1) + 1) {
          throw new Error('草稿保存后已被其他操作更改');
        }
        current.value = latest;
        rows.value = rows.value.map((row) => row.reportId === latest.reportId
          ? { ...row, name: latest.name, definitionVersion: latest.definitionVersion,
              menuId: latest.menuId, publishedVersion: latest.publishedVersion }
          : row);
        if (!editingId) void loadList();
      } catch (cause) {
        if (generation === editorGeneration && actorContext === context.value) {
          refreshBlocked.value = true;
          void loadList();
          message.warning('草稿已保存，但版本读取失败，请关闭后重新打开');
          notifyApiErrorOnce(cause);
        }
      }
      return;
    }
    closeEditor();
    await loadList();
  } catch (cause) {
    if (generation === editorGeneration && actorContext === context.value) {
      // 新建请求失败不证明事务未提交；先核对列表，避免本编辑器直接重复创建。
      if (!editingId && !isReportRateLimited(cause)) {
        refreshBlocked.value = true;
        void loadList();
        message.warning('创建结果未确认，请先核对列表后重新打开');
      }
      notifyApiErrorOnce(cause);
    }
  } finally {
    if (saveToken === saveSequence) {
      saving.value = false;
      if (generation !== editorGeneration && !suspended.value && actorContext === context.value) void loadList();
    }
  }
}

async function publish(row: ReportManagementSummary) {
  if (busyReportId.value || !writeEnabled.value || !menuEnabled.value) return;
  const generation = ++menuGeneration;
  const actorContext = context.value;
  busyReportId.value = row.reportId;
  try {
    const latest = await service.getDraft(row.reportId);
    if (generation !== menuGeneration || actorContext !== context.value) return;
    if (!latest.menuId) return void message.warning('请先为报表关联菜单');
    await service.publish({
      reportId: latest.reportId,
      expectedLock: latest.optimisticLock,
      expectedDefinitionVersion: latest.definitionVersion,
    });
    if (generation !== menuGeneration || actorContext !== context.value) return;
    message.success('报表已发布');
    await loadList();
  } catch (cause) {
    if (generation === menuGeneration && actorContext === context.value)
      notifyApiErrorOnce(cause);
  } finally {
    if (generation === menuGeneration) busyReportId.value = '';
  }
}

async function generateMenu(row: ReportManagementSummary) {
  if (busyReportId.value || !writeEnabled.value || !menuEnabled.value) return;
  const generation = ++menuGeneration;
  const actorContext = context.value;
  busyReportId.value = row.reportId;
  try {
    const latest = await service.getDraft(row.reportId);
    if (generation !== menuGeneration || actorContext !== context.value) return;
    if (latest.menuId || latest.publishedVersion) {
      message.warning('报表状态已变化，请刷新后重试');
      await loadList();
      return;
    }
    await reportMenuService.generateMenu({
      reportId: latest.reportId,
      expectedLock: latest.optimisticLock,
      expectedDefinitionVersion: latest.definitionVersion,
    });
    if (generation !== menuGeneration || actorContext !== context.value) return;
    message.success('报表菜单已创建，请在角色权限中分配');
    await loadList();
  } catch (cause) {
    if (generation === menuGeneration && actorContext === context.value)
      notifyApiErrorOnce(cause);
  } finally {
    if (generation === menuGeneration) busyReportId.value = '';
  }
}

function closePreview() {
  previewGeneration += 1;
  previewOpen.value = false;
  previewPage.value = undefined;
  previewVersion.value = undefined;
  previewDatasetId.value = undefined;
  previewLoading.value = false;
}

async function openPreview(row: ReportManagementSummary, datasetId?: string) {
  if (!savedPreviewEnabled.value) return;
  const generation = ++previewGeneration;
  const actorContext = context.value;
  previewOpen.value = true;
  previewLoading.value = true;
  previewPage.value = undefined;
  previewVersion.value = undefined;
  previewDatasetId.value = undefined;
  try {
    const draft = await service.getDraft(row.reportId);
    if (generation !== previewGeneration || actorContext !== context.value)
      return;
    const version: ReportVersion = {
      reportId: draft.reportId,
      expectedLock: draft.optimisticLock,
      expectedDefinitionVersion: draft.definitionVersion,
    };
    const datasetComponents = datasetId
      ? (draft.draft?.components || []).filter((item) => item.dataset === datasetId)
      : undefined;
    if (datasetId && !datasetComponents?.length) {
      const page = await reportPreviewService.datasetPage(version, datasetId);
      if (generation !== previewGeneration || actorContext !== context.value) return;
      previewVersion.value = version;
      previewDatasetId.value = datasetId;
      previewPage.value = page;
      return;
    }
    const page = await reportPreviewService.page(version);
    if (generation !== previewGeneration || actorContext !== context.value)
      return;
    let selectedPage = page;
    if (datasetComponents) {
      const components = datasetComponents;
      const ids = new Set(components.map((item) => item.id));
      const selected = page.components.filter((item) => ids.has(item.id));
      if (!selected.length) {
        closePreview();
        message.warning('已保存草稿中该数据集没有可预览的组件，请先添加组件并保存');
        return;
      }
      const bound = new Set(components.flatMap((item) => Object.values(item.bindings)));
      selectedPage = { ...page, components: selected,
        parameters: page.parameters.filter((item) => item.required || bound.has(item.key)) };
    }
    previewVersion.value = version;
    previewPage.value = selectedPage;
  } catch (cause) {
    if (generation === previewGeneration && actorContext === context.value) {
      closePreview();
      notifyApiErrorOnce(cause);
    }
  } finally {
    if (generation === previewGeneration) previewLoading.value = false;
  }
}

function queryPreview(
  componentId: string,
  parameters: Readonly<Record<string, string>>,
) {
  const version = previewVersion.value;
  if (!version) return Promise.reject(new Error('草稿预览不可用'));
  if (previewDatasetId.value) return reportPreviewService.datasetQuery(version, previewDatasetId.value, parameters);
  return reportPreviewService.query(version, componentId, parameters);
}

function onPageChange(page: number, size: number) {
  pageIndex.value = page;
  pageSize.value = size;
  void loadList();
}

watch(
  context,
  () => {
    editorGeneration += 1;
    saving.value = false;
    menuGeneration += 1;
    busyReportId.value = '';
    closePreview();
    closeLogs();
    editorOpen.value = false;
    current.value = undefined;
    rows.value = [];
    menuEnabled.value = false;
    menuCapabilityKnown.value = false;
    capabilityPending.value = false;
    writeEnabled.value = false;
    savedPreviewEnabled.value = false;
    pageIndex.value = 1;
    if (!suspended.value) void loadList();
  },
  { immediate: true },
);
// 缓存标签隐藏时废弃读取；保存结果不明时保留编辑内容并禁止再次提交。
onDeactivated(() => {
  suspended.value = true;
  listGeneration += 1;
  editorGeneration += 1;
  menuGeneration += 1;
  loading.value = false;
  busyReportId.value = '';
  rows.value = [];
  closePreview();
  closeLogs();
  if (saving.value) refreshBlocked.value = true;
  if (editorLoading.value) {
    editorLoading.value = false;
    editorOpen.value = false;
    current.value = undefined;
  }
});
onActivated(() => {
  if (suspended.value) {
    suspended.value = false;
    void loadList();
  }
});
onBeforeUnmount(() => {
  suspended.value = true;
  listGeneration += 1;
  editorGeneration += 1;
  menuGeneration += 1;
  closePreview();
  closeLogs();
});
</script>

<template>
  <Page title="报表设计" description="设计数据集、共享条件和组合报表页面。">
    <div class="space-y-4 p-4">
      <div class="flex justify-end">
        <Button
          v-if="writeEnabled && allowed('create') && allowed('catalog')"
          type="primary"
          @click="openEditor()"
          >新建报表</Button
        >
      </div>
      <Alert v-if="error" type="warning" show-icon :message="error" />
      <Alert v-if="!loading && !error && !capabilityPending && !writeEnabled" type="info" show-icon message="当前报表写入暂不可用，已保存草稿可按可用能力和权限预览。" />
      <Alert
        v-if="!loading && !error && !capabilityPending && menuCapabilityKnown && !menuEnabled"
        type="info"
        show-icon
        message="当前环境尚未启用报表菜单生成"
      />
      <Alert
        v-if="!loading && !error && !capabilityPending && !menuCapabilityKnown"
        type="warning"
        show-icon
        message="无法获取报表菜单能力状态"
      />
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="reportId"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'published'"
            ><Tag :color="record.publishedVersion ? 'success' : 'default'">{{
              record.publishedVersion
                ? `已发布 v${record.publishedVersion}`
                : '未发布'
            }}</Tag></template
          >
          <template v-else-if="column.key === 'actions'"
            ><Button
              v-if="
                writeEnabled && allowed('getDraft') &&
                allowed('catalog') &&
                allowed('saveDraft')
              "
              type="link"
              @click="openEditor(record.reportId)"
              >编辑</Button
            ><Button v-if="allowed('getDraft')" type="link" @click="openLogs(record.reportId)">发布日志</Button
            ><Button
              v-if="
                savedPreviewEnabled &&
                isSuperAdminUser(user.userInfo) &&
                allowed('getDraft') &&
                hasPermission(
                  buildApiMethodPermissions(reportPreviewService, 'page'),
                )
              "
              type="link"
              @click="openPreview(record as ReportManagementSummary)"
              >预览草稿</Button
            ><Popconfirm
              v-if="
                !record.menuId &&
                !record.publishedVersion &&
                writeEnabled && menuEnabled &&
                allowed('getDraft') &&
                hasPermission(
                  buildApiMethodPermissions(reportMenuService, 'generateMenu'),
                ) &&
                hasPermission(buildApiMethodPermissions(menuService, 'create'))
              "
              title="创建专用报表菜单？创建后请在角色权限中分配。"
              @confirm="generateMenu(record as ReportManagementSummary)"
              ><Button type="link" :loading="busyReportId === record.reportId"
                >生成菜单</Button
              ></Popconfirm
            ><Popconfirm
              v-if="writeEnabled && menuEnabled && allowed('publish') && allowed('getDraft')"
              title="发布当前草稿？"
              @confirm="publish(record as ReportManagementSummary)"
              ><Button type="link" :loading="busyReportId === record.reportId"
                >发布</Button
              ></Popconfirm
            ></template
          >
        </template>
      </Table>
      <Pagination
        :current="pageIndex"
        :page-size="pageSize"
        :total="total"
        show-size-changer
        @change="onPageChange"
      />
    </div>
    <!-- 编辑器只保存声明式配置，后台会重新校验字段、范围和并发版本。 -->
    <Modal
      :open="editorOpen && !suspended"
      :title="current ? '编辑报表草稿' : '新建报表'"
      :footer="null"
      width="min(1600px, 96vw)"
      destroy-on-close
      :mask-closable="false"
      @cancel="requestEditorClose"
    >
      <Spin :spinning="editorLoading || saving">
        <div class="space-y-4">
          <div class="flex flex-wrap items-center gap-3">
            <span>报表名称</span
            ><Input
              v-model:value="name"
              class="w-56"
              :maxlength="128"
              placeholder="请输入报表名称"
            /><template v-if="!current && !platform"
              ><span>所属组织</span
              ><UserOrgSelector
                :model-value="orgId || undefined"
                :selectable-types="['org']"
                :max-select-count="1"
                value-mode="id"
                class="w-56"
                placeholder="请选择组织"
                @update:model-value="setOrganization" /></template
            ><Tag v-if="!current && platform">平台全局</Tag>
          </div>
          <ReportDesignEditor
            v-model="design"
            :catalog="catalog"
            :disabled="!writeEnabled || saving || editorLoading"
            :allow-saved-data-preview="canPreviewSaved"
            @image-pending="imagePending = $event"
            @preview-saved-dataset="(id) => current && openPreview(current, id)"
          />
          <Alert v-if="refreshBlocked" type="warning" show-icon message="保存结果或草稿版本需要重新核对，请关闭后重新打开再保存。" />
          <div class="flex justify-end gap-2">
            <Button
              v-if="canPreviewSaved"
              :disabled="saving || editorLoading"
              @click="current && openPreview(current)"
              >预览已保存草稿</Button
            ><Button :disabled="saving" @click="requestEditorClose">取消</Button
            ><Button v-if="allowed('getDraft')" :disabled="!writeEnabled || imagePending || editorLoading || refreshBlocked" :loading="saving" @click="save(true)">保存并继续</Button
            ><Button
              type="primary"
              :loading="saving"
              :disabled="!writeEnabled || imagePending || refreshBlocked"
              @click="save(false)"
              >保存草稿</Button
            >
          </div>
          <p v-if="canPreviewSaved" class="text-muted-foreground text-xs">
            实际数据预览使用已保存草稿，不包含本次未保存的修改。
          </p>
        </div>
      </Spin>
    </Modal>
    <Modal :open="logsOpen" title="发布日志" :footer="null" @cancel="closeLogs">
      <Spin :spinning="logsLoading">
        <Table :data-source="publicationLogs" :pagination="false" :columns="[
          { title: '时间', dataIndex: 'occurTime', key: 'occurTime' },
          { title: '操作人', dataIndex: 'operator', key: 'operator' },
          { title: '动作', dataIndex: 'action', key: 'action' },
          { title: '备注', dataIndex: 'remark', key: 'remark' },
        ]" />
      </Spin>
    </Modal>
    <Modal
      :open="previewOpen"
      title="已保存草稿预览"
      :footer="null"
      width="1200px"
      destroy-on-close
      @cancel="closePreview"
    >
      <Spin :spinning="previewLoading">
        <ReportRuntimeView
          v-if="previewPage"
          :page="previewPage"
          :query="queryPreview"
          :context-key="context"
        />
      </Spin>
    </Modal>
  </Page>
</template>
