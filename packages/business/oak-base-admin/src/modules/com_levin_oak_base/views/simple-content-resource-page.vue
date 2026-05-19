<script lang="ts" setup>
import type { RbacModuleNode } from '@levin/admin-framework/framework-commons/shared/data-permission-types';
import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import type {
  SimpleContentEditorMeta,
  SimpleContentResourceKind,
  SimpleContentResourceService,
} from './simple-content-resource';

import { computed, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Button, Input, Modal, Spin, message } from 'ant-design-vue';

import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import CodeEditorField from '@levin/admin-framework/framework-commons/shared/code-editor-field.vue';
import { buildCrudOperationPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { evaluateCrudVisibleOn } from '@levin/admin-framework/framework-commons/shared/crud-visible-on';
import JsonEditorField from '@levin/admin-framework/framework-commons/shared/json-editor-field.vue';
import ResourcePermissionTreeEditor from '@levin/admin-framework/framework-commons/shared/resource-permission-tree-editor.vue';

import CrudPage from './crud-page.vue';
import {
  normalizeSimpleDetailRecord,
  parseSimpleContentValue,
  resolveSimpleContentEditorMeta,
  serializeSimpleContentValue,
  withSimpleManagedSubmit,
} from './simple-content-resource';

type GenericRecord = Record<string, any>;
type ReloadList = () => Promise<any> | void;

const props = defineProps<{
  config: CrudPageConfig;
  resourceKind: SimpleContentResourceKind;
  service: SimpleContentResourceService;
}>();

const userStore = useUserStore();
const { hasPermission } = useRbacAccess();

const managedConfig = computed(() => withSimpleManagedSubmit(props.config));
const contentOpen = ref(false);
const contentLoading = ref(false);
const contentSubmitting = ref(false);
const contentRecord = ref<GenericRecord | null>(null);
const contentEditorMeta = ref<SimpleContentEditorMeta>({
  kind: 'textarea',
  language: 'text',
  title: '文本',
});
const contentValue = ref<any>('');
const contentReload = ref<ReloadList | null>(null);
const permissionModules = ref<RbacModuleNode[]>([]);
const permissionLoading = ref(false);
const permissionOpen = ref(false);
const permissionRecord = ref<GenericRecord | null>(null);
const permissionSelection = ref<string[]>([]);
const permissionSubmitting = ref(false);
const permissionReload = ref<ReloadList | null>(null);
const MENU_PERMISSION_MODULE_ID = '__menus__';

const updatePermissions = computed(
  () =>
    props.config.editPermission ||
    (props.config.updatePath
      ? [
          props.config.updatePath,
          ...buildCrudOperationPermissions(props.config, 'update'),
        ]
      : buildCrudOperationPermissions(props.config, 'update')),
);
const contentModalTitle = computed(() =>
  contentRecord.value
    ? `编辑内容 - ${getRecordTitle(contentRecord.value)}`
    : '编辑内容',
);
const permissionModalTitle = computed(() =>
  permissionRecord.value
    ? `所需权限 - ${getRecordTitle(permissionRecord.value)}`
    : '所需权限',
);

function getRecordTitle(record: GenericRecord) {
  return String(record.name || record.title || record.id || '当前记录').trim();
}

function getRecordId(record: GenericRecord) {
  return record[props.config.recordKey || 'id'] || record.id;
}

function normalizePermissionValues(value: any) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSupportEventsByCurrentStatus(record: GenericRecord) {
  const events = record.supportEventsByCurrentStatus;
  return Array.isArray(events)
    ? events.filter((event): event is string => typeof event === 'string')
    : undefined;
}

function canUseEditStatusEvent(record: GenericRecord) {
  const events = getSupportEventsByCurrentStatus(record);
  return events === undefined || events.includes('编辑');
}

function canShowManagedActions(record: GenericRecord) {
  return (
    props.config.allowEdit !== false &&
    hasPermission(updatePermissions.value) &&
    canUseEditStatusEvent(record) &&
    evaluateCrudVisibleOn(
      props.config.editVisibleOn,
      record,
      userStore.userInfo,
    )
  );
}

async function retrieveFreshRecord(record: GenericRecord) {
  if (!props.service.retrieve || !getRecordId(record)) {
    return record;
  }

  const detail = await props.service.retrieve({
    [props.config.recordKey || 'id']: getRecordId(record),
    id: getRecordId(record),
  });

  return {
    ...record,
    ...normalizeSimpleDetailRecord(detail),
  };
}

async function openContentEditor(record: GenericRecord, reload?: ReloadList) {
  if (!canShowManagedActions(record)) {
    message.warning('当前账号没有编辑权限');
    return;
  }

  contentLoading.value = true;
  contentOpen.value = true;
  contentReload.value = reload || null;

  try {
    const freshRecord = await retrieveFreshRecord(record);
    const meta = resolveSimpleContentEditorMeta(
      props.resourceKind,
      freshRecord,
    );

    contentRecord.value = freshRecord;
    contentEditorMeta.value = meta;
    contentValue.value = parseSimpleContentValue(meta, freshRecord.content);
  } catch (error) {
    contentOpen.value = false;
    console.error(error);
    message.error('加载内容失败');
  } finally {
    contentLoading.value = false;
  }
}

function closeContentEditor() {
  contentOpen.value = false;
  contentRecord.value = null;
  contentValue.value = '';
  contentReload.value = null;
}

async function submitContent() {
  const record = contentRecord.value;

  if (!record?.id || !props.service.update) {
    message.warning('未找到可更新的记录');
    return;
  }

  contentSubmitting.value = true;

  try {
    await props.service.update({
      forceUpdateFields: ['content'],
      id: record.id,
      optimisticLock: record.optimisticLock,
      content: serializeSimpleContentValue(
        contentEditorMeta.value,
        contentValue.value,
      ),
    });
    message.success('内容已更新');
    const reload = contentReload.value;
    closeContentEditor();
    await reload?.();
  } catch (error) {
    console.error(error);
    message.error('内容更新失败');
  } finally {
    contentSubmitting.value = false;
  }
}

async function ensurePermissionModulesLoaded() {
  if (permissionModules.value.length > 0) {
    return;
  }

  permissionLoading.value = true;
  try {
    permissionModules.value = (
      ((await rbacService.fetchAuthorizedResourceModules()) ||
        []) as RbacModuleNode[]
    ).filter((item) => item.id !== MENU_PERMISSION_MODULE_ID);
  } catch (error) {
    console.error(error);
    message.error('加载资源权限列表失败');
  } finally {
    permissionLoading.value = false;
  }
}

async function openPermissionEditor(
  record: GenericRecord,
  reload?: ReloadList,
) {
  if (!canShowManagedActions(record)) {
    message.warning('当前账号没有编辑权限');
    return;
  }

  permissionOpen.value = true;
  permissionLoading.value = true;
  permissionReload.value = reload || null;

  try {
    const freshRecord = await retrieveFreshRecord(record);
    permissionRecord.value = freshRecord;
    permissionSelection.value = normalizePermissionValues(
      freshRecord.requireAuthorizations,
    );
    await ensurePermissionModulesLoaded();
  } catch (error) {
    permissionOpen.value = false;
    console.error(error);
    message.error('加载所需权限失败');
  } finally {
    permissionLoading.value = false;
  }
}

function closePermissionEditor() {
  permissionOpen.value = false;
  permissionRecord.value = null;
  permissionSelection.value = [];
  permissionReload.value = null;
}

async function submitRequireAuthorizations() {
  const record = permissionRecord.value;

  if (!record?.id || !props.service.update) {
    message.warning('未找到可更新的记录');
    return;
  }

  permissionSubmitting.value = true;

  try {
    await props.service.update({
      forceUpdateFields: ['requireAuthorizations'],
      id: record.id,
      optimisticLock: record.optimisticLock,
      requireAuthorizations: [
        ...new Set(
          permissionSelection.value.map((item) => item.trim()).filter(Boolean),
        ),
      ],
    });
    message.success('所需权限已更新');
    const reload = permissionReload.value;
    closePermissionEditor();
    await reload?.();
  } catch (error) {
    console.error(error);
    message.error('所需权限更新失败');
  } finally {
    permissionSubmitting.value = false;
  }
}
</script>

<template>
  <CrudPage :config="managedConfig">
    <template #row-actions="{ record, reload }">
      <Button
        v-if="canShowManagedActions(record)"
        size="small"
        type="link"
        @click="openContentEditor(record, reload)"
      >
        <IconifyIcon class="mr-0.5 size-4" icon="lucide:file-pen-line" />
        编辑内容
      </Button>
      <Button
        v-if="canShowManagedActions(record)"
        size="small"
        type="link"
        @click="openPermissionEditor(record, reload)"
      >
        <IconifyIcon class="mr-0.5 size-4" icon="lucide:shield-check" />
        所需权限
      </Button>
    </template>
  </CrudPage>

  <Modal
    :body-style="{ maxHeight: 'calc(100vh - 220px)', overflow: 'auto' }"
    :confirm-loading="contentSubmitting"
    destroy-on-close
    :open="contentOpen"
    :title="contentModalTitle"
    width="min(86vw, 1480px)"
    @cancel="closeContentEditor"
    @ok="submitContent"
  >
    <Spin :spinning="contentLoading">
      <JsonEditorField
        v-if="contentEditorMeta.kind === 'json'"
        v-model="contentValue"
        inline
        inline-min-height="min(70vh, 760px)"
        :title="contentEditorMeta.title"
      />
      <CodeEditorField
        v-else-if="contentEditorMeta.kind === 'code'"
        v-model="contentValue"
        inline
        :language="contentEditorMeta.language"
        :title="contentEditorMeta.title"
      />
      <Input.TextArea
        v-else
        v-model:value="contentValue"
        :auto-size="{ minRows: 18, maxRows: 28 }"
      />
    </Spin>
  </Modal>

  <Modal
    :confirm-loading="permissionSubmitting"
    destroy-on-close
    :open="permissionOpen"
    :title="permissionModalTitle"
    :width="1080"
    @cancel="closePermissionEditor"
    @ok="submitRequireAuthorizations"
  >
    <div class="max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
      <Spin :spinning="permissionLoading">
        <ResourcePermissionTreeEditor
          v-model:value="permissionSelection"
          :modules="permissionModules"
        />
      </Spin>
    </div>
  </Modal>
</template>
