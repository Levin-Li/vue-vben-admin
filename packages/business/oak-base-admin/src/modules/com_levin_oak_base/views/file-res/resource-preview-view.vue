<script lang="ts" setup>
import type {
  ArchiveEntryResult,
  FileResourceRecord,
  FileResourceType,
} from './resource-preview-utils';
import type { UploadFile } from 'ant-design-vue';

import { computed, onMounted, reactive, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { uploadFileByFileStorageController } from '@levin/admin-framework/framework-commons/app/api/file-storage-service';
import {
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Progress,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Upload,
  message,
} from 'ant-design-vue';

import { fileResService } from '../../api/file-res-service';
import {
  FILE_STORAGE_MULTI_UPLOAD_PATH,
  FILE_STORAGE_SINGLE_UPLOAD_PATH,
  OAK_BASE_API_MODULE,
} from '../api-module';
import {
  buildArchiveEntryPlans,
  createResourceArchive,
  getResourceTypeLabel,
  inferResourceType,
  isAudioResource,
  isImageResource,
  isPdfResource,
  isVideoResource,
  normalizeTagInput,
  normalizeStringList,
  RESOURCE_TYPE_OPTIONS,
  resolveUrlFileName,
  resolveResourceUrl,
} from './resource-preview-utils';

type TypeFilter = 'all' | FileResourceType;

const ARCHIVE_MAX_RESOURCES = 100;
const ARCHIVE_MAX_FILES = 300;

const loading = ref(false);
const records = ref<FileResourceRecord[]>([]);
const total = ref(0);
const selectedRecordMap = ref(new Map<string, FileResourceRecord>());
const previewOpen = ref(false);
const previewRecord = ref<FileResourceRecord | null>(null);
const archiveOpen = ref(false);
const archiveRunning = ref(false);
const archiveCurrent = ref('');
const archiveFinished = ref(0);
const archiveTotal = ref(0);
const archiveFailed = ref<ArchiveEntryResult[]>([]);
const editorOpen = ref(false);
const editorSaving = ref(false);
const editorMode = ref<'create' | 'edit' | 'reupload'>('create');
const editingRecord = ref<FileResourceRecord | null>(null);
const videoPosterMap = ref(new Map<string, string>());

const query = reactive({
  name: '',
  category: '',
  bizObjId: '',
  tagList: '',
  type: 'all' as TypeFilter,
});

const editorForm = reactive({
  bizObjId: '',
  category: '',
  coverUrl: '',
  id: '' as number | string | '',
  mimeType: '',
  name: '',
  optimisticLock: undefined as number | string | undefined,
  paths: [] as string[],
  tagListInput: '',
  type: 'Image' as FileResourceType,
});

const pagination = reactive({
  pageIndex: 1,
  pageSize: 24,
});

const resourceTypeSelectOptions = computed(() =>
  RESOURCE_TYPE_OPTIONS.filter((option) => option.value !== 'all'),
);
const editorImageFileList = computed<UploadFile[]>(() =>
  editorForm.paths.map((path, index) => ({
    name: resolveUrlFileName(path, `image-${index + 1}`),
    status: 'done' as const,
    uid: path,
    url: path,
  })),
);

const selectedRecords = computed(() =>
  [...selectedRecordMap.value.values()].filter((item) => getRecordId(item)),
);
const selectedCount = computed(() => selectedRecords.value.length);
const archivePercent = computed(() =>
  archiveTotal.value > 0
    ? Math.round((archiveFinished.value / archiveTotal.value) * 100)
    : 0,
);
const previewUrl = computed(() =>
  previewRecord.value ? resolveResourceUrl(previewRecord.value) : '',
);
const pageSelectedCount = computed(
  () => records.value.filter((record) => isRecordSelected(record)).length,
);
const allPageSelected = computed(
  () => records.value.length > 0 && pageSelectedCount.value === records.value.length,
);
const pageSelectionIndeterminate = computed(
  () => pageSelectedCount.value > 0 && pageSelectedCount.value < records.value.length,
);

onMounted(() => {
  void loadRecords();
});

async function loadRecords() {
  loading.value = true;

  try {
    const result = await fileResService.list(buildListParams());
    const items = normalizePagingItems<FileResourceRecord>(result);
    records.value = items;
    total.value = normalizePagingTotal(result, items.length);
    void prepareVideoPosters(items);
  } catch (error) {
    console.error(error);
    message.error('文件资源加载失败');
  } finally {
    loading.value = false;
  }
}

function buildListParams() {
  return {
    pageIndex: pagination.pageIndex,
    pageSize: pagination.pageSize,
    name: query.name || undefined,
    category: query.category || undefined,
    bizObjId: query.bizObjId || undefined,
    tagList: query.tagList || undefined,
    type: query.type === 'all' ? undefined : query.type,
  };
}

function normalizePagingItems<T>(data: any): T[] {
  if (Array.isArray(data)) {
    return data;
  }

  return data?.items || data?.records || data?.list || [];
}

function normalizePagingTotal(data: any, fallback: number) {
  const totalCount = Number(data?.totals ?? data?.total ?? data?.totalCount);
  return Number.isFinite(totalCount) && totalCount >= 0 ? totalCount : fallback;
}

function resetSearch() {
  query.name = '';
  query.category = '';
  query.bizObjId = '';
  query.tagList = '';
  query.type = 'all';
  pagination.pageIndex = 1;
  void loadRecords();
}

function submitSearch() {
  pagination.pageIndex = 1;
  void loadRecords();
}

function onPageChange(pageIndex: number, pageSize: number) {
  pagination.pageIndex = pageIndex;
  pagination.pageSize = pageSize;
  void loadRecords();
}

function getRecordId(record: FileResourceRecord) {
  return String(record.id || '').trim();
}

function getRecordTitle(record: FileResourceRecord) {
  return String(record.name || record.id || '未命名资源').trim();
}

function getRecordTags(record: FileResourceRecord) {
  return normalizeStringList(record.tagList).slice(0, 3);
}

function isRecordSelected(record: FileResourceRecord) {
  const id = getRecordId(record);
  return Boolean(id && selectedRecordMap.value.has(id));
}

function updateSelectedMap(nextMap: Map<string, FileResourceRecord>) {
  selectedRecordMap.value = nextMap;
}

function toggleRecordSelection(record: FileResourceRecord, checked: boolean) {
  const id = getRecordId(record);
  if (!id) {
    return;
  }

  const nextMap = new Map(selectedRecordMap.value);
  if (checked) {
    nextMap.set(id, record);
  } else {
    nextMap.delete(id);
  }
  updateSelectedMap(nextMap);
}

function toggleCurrentPageSelection(checked: boolean) {
  const nextMap = new Map(selectedRecordMap.value);
  for (const record of records.value) {
    const id = getRecordId(record);
    if (!id) {
      continue;
    }
    if (checked) {
      nextMap.set(id, record);
    } else {
      nextMap.delete(id);
    }
  }
  updateSelectedMap(nextMap);
}

function clearSelection() {
  updateSelectedMap(new Map());
}

function openPreview(record: FileResourceRecord) {
  previewRecord.value = record;
  previewOpen.value = true;
}

function closePreview() {
  previewOpen.value = false;
  previewRecord.value = null;
}

function resetEditorForm(record?: FileResourceRecord) {
  editorForm.id = record?.id || '';
  editorForm.optimisticLock = record?.optimisticLock;
  editorForm.name = String(record?.name || '').trim();
  editorForm.type = (record?.type as FileResourceType) || 'Image';
  editorForm.category = String(record?.category || '').trim();
  editorForm.mimeType = String(record?.mimeType || '').trim();
  editorForm.bizObjId = String(record?.bizObjId || '').trim();
  editorForm.coverUrl = String(record?.coverUrl || '').trim();
  editorForm.paths = normalizeStringList(record?.paths);
  editorForm.tagListInput = normalizeStringList(record?.tagList).join(', ');
}

function openCreateEditor() {
  editingRecord.value = null;
  editorMode.value = 'create';
  resetEditorForm({
    enable: true,
    editable: true,
    paths: [],
    tagList: [],
    type: query.type === 'all' ? 'Image' : query.type,
  });
  editorOpen.value = true;
}

function openEditEditor(record: FileResourceRecord) {
  editingRecord.value = record;
  editorMode.value = 'edit';
  resetEditorForm(record);
  editorOpen.value = true;
}

function openReuploadEditor(record: FileResourceRecord) {
  editingRecord.value = record;
  editorMode.value = 'reupload';
  resetEditorForm(record);
  editorOpen.value = true;
}

function closeEditor() {
  if (editorSaving.value) {
    return;
  }

  editorOpen.value = false;
  editingRecord.value = null;
}

function getEditorTitle() {
  if (editorMode.value === 'create') {
    return '新增文件资源';
  }
  if (editorMode.value === 'reupload') {
    return '重新上传文件';
  }

  return '编辑文件资源';
}

function buildEditorPayload() {
  const tagList = normalizeTagInput(editorForm.tagListInput);
  const payload: FileResourceRecord = {
    category: editorForm.category || undefined,
    coverUrl: editorForm.coverUrl || undefined,
    mimeType: editorForm.mimeType || undefined,
    name: editorForm.name.trim(),
    paths: editorForm.paths,
    tagList,
    type: editorForm.type,
  };

  if (editorForm.bizObjId) {
    payload.bizObjId = editorForm.bizObjId;
  }
  if (editorForm.id !== '') {
    payload.id = editorForm.id;
  }
  if (editorForm.optimisticLock !== undefined) {
    payload.optimisticLock = editorForm.optimisticLock;
  }
  if (editorMode.value === 'create') {
    payload.editable = true;
    payload.enable = true;
  }

  return payload;
}

async function submitEditor() {
  if (!editorForm.name.trim()) {
    message.warning('请输入文件名称');
    return;
  }
  if (editorForm.paths.length === 0 && !editorForm.coverUrl) {
    message.warning('请先上传文件或填写封面图');
    return;
  }

  editorSaving.value = true;
  try {
    const payload = buildEditorPayload();
    if (editorMode.value === 'create') {
      await fileResService.create(payload);
      message.success('文件资源已新增');
    } else {
      await fileResService.update(payload);
      message.success(editorMode.value === 'reupload' ? '文件已重新上传' : '文件资源已更新');
    }
    editorOpen.value = false;
    editingRecord.value = null;
    await loadRecords();
  } catch (error) {
    console.error(error);
    message.error(editorMode.value === 'create' ? '新增文件资源失败' : '更新文件资源失败');
  } finally {
    editorSaving.value = false;
  }
}

async function deleteRecord(record: FileResourceRecord) {
  const id = getRecordId(record);
  if (!id) {
    message.warning('资源ID为空，无法删除');
    return;
  }

  try {
    await fileResService.delete({ id });
    const nextMap = new Map(selectedRecordMap.value);
    nextMap.delete(id);
    updateSelectedMap(nextMap);
    message.success('文件资源已删除');
    await loadRecords();
  } catch (error) {
    console.error(error);
    message.error('删除文件资源失败');
  }
}

async function deleteSelectedRecords() {
  const idList = selectedRecords.value.map((record) => getRecordId(record)).filter(Boolean);
  if (idList.length === 0) {
    message.warning('请先选择资源');
    return;
  }

  try {
    await fileResService.batchDelete({ idList });
    clearSelection();
    message.success('已删除选中的文件资源');
    await loadRecords();
  } catch (error) {
    console.error(error);
    message.error('批量删除文件资源失败');
  }
}

async function uploadEditorFile(options: any, target: 'cover' | 'path') {
  try {
    const file = options.file as File;
    const uploadPath =
      target === 'cover' ? FILE_STORAGE_SINGLE_UPLOAD_PATH : FILE_STORAGE_MULTI_UPLOAD_PATH;
    const url = await uploadFileByFileStorageController(
      file,
      OAK_BASE_API_MODULE,
      uploadPath,
    );
    const normalizedUrl = url.trim();

    if (target === 'cover') {
      editorForm.coverUrl = normalizedUrl;
    } else {
      editorForm.paths = editorMode.value === 'reupload'
        ? [normalizedUrl]
        : [...editorForm.paths, normalizedUrl];
      editorForm.mimeType = file.type || editorForm.mimeType;
      editorForm.type = inferResourceType(file.type);
      if (!editorForm.name.trim()) {
        editorForm.name = resolveUrlFileName(file.name, '未命名资源');
      }
      if (editorForm.type === 'Image' && !editorForm.coverUrl) {
        editorForm.coverUrl = normalizedUrl;
      }
    }

    options.onSuccess?.(normalizedUrl);
    message.success(target === 'cover' ? '封面图已上传' : '文件已上传');
  } catch (error) {
    console.error(error);
    options.onError?.(error);
    message.error(target === 'cover' ? '封面图上传失败' : '文件上传失败');
  }
}

function removeEditorPath(path: string) {
  editorForm.paths = editorForm.paths.filter((item) => item !== path);
}

function removeEditorUploadFile(file: any) {
  const path = String(file?.url || file?.uid || '').trim();
  if (path) {
    removeEditorPath(path);
  }

  return true;
}

function previewEditorUploadFile(file: any) {
  openUrl(String(file?.url || file?.uid || '').trim());
}

function getVideoPosterKey(record: FileResourceRecord) {
  return getRecordId(record) || resolveResourceUrl(record);
}

function getVideoPoster(record: FileResourceRecord) {
  return String(record.coverUrl || '').trim() || videoPosterMap.value.get(getVideoPosterKey(record)) || '';
}

async function prepareVideoPosters(items: FileResourceRecord[]) {
  for (const record of items) {
    if (!isVideoResource(record) || record.coverUrl) {
      continue;
    }

    const key = getVideoPosterKey(record);
    const url = resolveResourceUrl(record);
    if (!key || !url || videoPosterMap.value.has(key)) {
      continue;
    }

    try {
      const posterUrl = await captureVideoPoster(url);
      if (!posterUrl) {
        continue;
      }
      const nextMap = new Map(videoPosterMap.value);
      nextMap.set(key, posterUrl);
      videoPosterMap.value = nextMap;
    } catch {
      // Video frame capture is best-effort; unsupported cross-origin videos keep the type icon.
    }
  }
}

function captureVideoPoster(url: string): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };
    const fail = () => {
      cleanup();
      resolve('');
    };

    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;
    video.addEventListener('error', fail, { once: true });
    video.addEventListener(
      'loadeddata',
      () => {
        try {
          video.currentTime = Math.min(0.1, video.duration || 0.1);
        } catch {
          fail();
        }
      },
      { once: true },
    );
    video.addEventListener(
      'seeked',
      () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 480;
          canvas.height = video.videoHeight || 270;
          const context = canvas.getContext('2d');
          if (!context) {
            fail();
            return;
          }
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          cleanup();
          resolve(dataUrl);
        } catch {
          fail();
        }
      },
      { once: true },
    );
    window.setTimeout(fail, 5000);
  });
}

function openUrl(url: string) {
  if (!url) {
    message.warning('资源地址为空');
    return;
  }

  window.open(url, '_blank', 'noopener=yes,noreferrer=yes');
}

async function copyUrl(url: string) {
  if (!url) {
    message.warning('资源地址为空');
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    message.success('资源地址已复制');
  } catch (error) {
    console.error(error);
    message.error('复制资源地址失败');
  }
}

function downloadUrl(url: string, fileName?: string) {
  if (!url) {
    message.warning('资源地址为空');
    return;
  }

  triggerDownload(url, fileName || 'file');
}

async function startArchiveDownload() {
  if (selectedRecords.value.length === 0) {
    message.warning('请先选择资源');
    return;
  }

  if (selectedRecords.value.length > ARCHIVE_MAX_RESOURCES) {
    message.warning(`单次最多打包 ${ARCHIVE_MAX_RESOURCES} 个资源`);
    return;
  }

  const plans = buildArchiveEntryPlans(selectedRecords.value);
  if (plans.length === 0) {
    message.warning('已选资源没有可下载的文件地址');
    return;
  }

  if (plans.length > ARCHIVE_MAX_FILES) {
    message.warning(`单次最多打包 ${ARCHIVE_MAX_FILES} 个文件`);
    return;
  }

  archiveOpen.value = true;
  archiveRunning.value = true;
  archiveCurrent.value = '';
  archiveFinished.value = 0;
  archiveTotal.value = plans.length;
  archiveFailed.value = [];

  try {
    const { failed, successCount, zipBlob } = await createResourceArchive({
      records: selectedRecords.value,
      onProgress: ({ current, finished }) => {
        archiveCurrent.value = current?.fileName || '';
        archiveFinished.value = finished;
      },
    });
    archiveFailed.value = failed;
    triggerDownload(zipBlob, `文件资源库-${formatTimestamp(new Date())}.zip`);

    if (archiveFailed.value.length > 0) {
      message.warning(
        `打包完成，成功 ${successCount} 个文件，失败 ${archiveFailed.value.length} 个文件`,
      );
    } else {
      message.success(`打包完成，共 ${successCount} 个文件`);
      archiveOpen.value = false;
    }
  } catch (error) {
    console.error(error);
    message.error(
      error instanceof Error && error.message
        ? `打包失败，${error.message}`
        : '生成压缩包失败',
    );
  } finally {
    archiveRunning.value = false;
    archiveCurrent.value = '';
  }
}

function triggerDownload(source: Blob | string, fileName: string) {
  const url = source instanceof Blob ? URL.createObjectURL(source) : source;
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();

  if (source instanceof Blob) {
    window.setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

function formatTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function getPreviewIcon(record: FileResourceRecord) {
  if (isVideoResource(record)) {
    return 'lucide:video';
  }
  if (isAudioResource(record)) {
    return 'lucide:audio-lines';
  }
  if (record.type === 'Zip') {
    return 'lucide:archive';
  }
  if (record.type === 'Document') {
    return 'lucide:file-text';
  }
  return 'lucide:file';
}
</script>

<template>
  <div class="file-resource-preview">
    <div class="file-resource-preview__toolbar">
      <div class="file-resource-preview__filters">
        <div class="file-resource-preview__filter-row">
          <Radio.Group v-model:value="query.type" button-style="solid" @change="submitSearch">
            <Radio.Button
              v-for="option in RESOURCE_TYPE_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </Radio.Button>
          </Radio.Group>
        </div>

        <div class="file-resource-preview__filter-row file-resource-preview__filter-row--fields">
          <Input
            v-model:value="query.name"
            allow-clear
            class="file-resource-preview__input"
            placeholder="文件名称"
            @press-enter="submitSearch"
          />
          <Input
            v-model:value="query.category"
            allow-clear
            class="file-resource-preview__input"
            placeholder="类别"
            @press-enter="submitSearch"
          />
          <Input
            v-model:value="query.bizObjId"
            allow-clear
            class="file-resource-preview__input"
            placeholder="业务对象ID"
            @press-enter="submitSearch"
          />
          <Input
            v-model:value="query.tagList"
            allow-clear
            class="file-resource-preview__input"
            placeholder="标签列表"
            @press-enter="submitSearch"
          />

          <Space class="file-resource-preview__query-actions" wrap>
            <Button type="primary" @click="submitSearch">
              <IconifyIcon class="mr-1 size-4" icon="lucide:search" />
              查询
            </Button>
            <Button @click="resetSearch">重置</Button>
            <Button :loading="loading" @click="loadRecords">
              <IconifyIcon class="mr-1 size-4" icon="lucide:refresh-cw" />
              刷新
            </Button>
          </Space>
        </div>
      </div>
    </div>

    <div class="file-resource-preview__batchbar">
      <Button type="primary" @click="openCreateEditor">
        <IconifyIcon class="mr-1 size-4" icon="lucide:plus" />
        新增
      </Button>
      <Checkbox
        :checked="allPageSelected"
        :indeterminate="pageSelectionIndeterminate"
        @change="toggleCurrentPageSelection($event.target.checked)"
      >
        全选当前页
      </Checkbox>
      <span class="text-muted-foreground text-sm">已选 {{ selectedCount }} 个资源</span>
      <Button size="small" @click="clearSelection">清空</Button>
      <Popconfirm
        title="确定删除选中的文件资源？"
        @confirm="deleteSelectedRecords"
      >
        <Button :disabled="selectedCount === 0" danger size="small">
          <IconifyIcon class="mr-1 size-4" icon="lucide:trash-2" />
          删除
        </Button>
      </Popconfirm>
      <Button
        :disabled="selectedCount === 0"
        :loading="archiveRunning"
        size="small"
        type="primary"
        @click="startArchiveDownload"
      >
        <IconifyIcon class="mr-1 size-4" icon="lucide:package-down" />
        打包下载
      </Button>
    </div>

    <Spin :spinning="loading">
      <div v-if="records.length > 0" class="file-resource-preview__grid">
        <article
          v-for="record in records"
          :key="getRecordId(record)"
          class="file-resource-preview__card"
          @click="openPreview(record)"
        >
          <Checkbox
            class="file-resource-preview__checkbox"
            :checked="isRecordSelected(record)"
            @click.stop
            @change="toggleRecordSelection(record, $event.target.checked)"
          />

          <div class="file-resource-preview__thumb">
            <img
              v-if="isImageResource(record) && resolveResourceUrl(record)"
              :alt="getRecordTitle(record)"
              :src="resolveResourceUrl(record)"
            />
            <img
              v-else-if="isVideoResource(record) && getVideoPoster(record)"
              :alt="getRecordTitle(record)"
              :src="getVideoPoster(record)"
            />
            <IconifyIcon v-else :icon="getPreviewIcon(record)" />
            <span v-if="isVideoResource(record)" class="file-resource-preview__play-badge">
              <IconifyIcon icon="lucide:play" />
            </span>
          </div>

          <div class="file-resource-preview__body">
            <div class="file-resource-preview__title" :title="getRecordTitle(record)">
              {{ getRecordTitle(record) }}
            </div>
            <div class="file-resource-preview__meta">
              {{ getResourceTypeLabel(record.type) }}
              <span v-if="record.mimeType"> · {{ record.mimeType }}</span>
            </div>

            <div class="file-resource-preview__tags">
              <Tag>{{ record.category || '未分类' }}</Tag>
              <Tag v-for="tag in getRecordTags(record)" :key="tag">{{ tag }}</Tag>
            </div>

            <div class="file-resource-preview__status">
              <Tag :color="record.enable === false ? 'default' : 'success'">
                {{ record.enable === false ? '禁用' : '启用' }}
              </Tag>
              <Tag v-if="record.publishable" color="blue">公网发布</Tag>
              <Tag v-if="record.deleted" color="red">已删除</Tag>
            </div>
          </div>

          <div class="file-resource-preview__actions" @click.stop>
            <Tooltip title="复制地址">
              <Button
                shape="circle"
                size="small"
                @click="copyUrl(resolveResourceUrl(record))"
              >
                <IconifyIcon class="size-4" icon="lucide:copy" />
              </Button>
            </Tooltip>
            <Tooltip title="下载">
              <Button
                shape="circle"
                size="small"
                @click="downloadUrl(resolveResourceUrl(record), getRecordTitle(record))"
              >
                <IconifyIcon class="size-4" icon="lucide:download" />
              </Button>
            </Tooltip>
            <Tooltip title="新窗口打开">
              <Button
                shape="circle"
                size="small"
                @click="openUrl(resolveResourceUrl(record))"
              >
                <IconifyIcon class="size-4" icon="lucide:external-link" />
              </Button>
            </Tooltip>
            <Tooltip title="编辑">
              <Button shape="circle" size="small" @click="openEditEditor(record)">
                <IconifyIcon class="size-4" icon="lucide:pencil" />
              </Button>
            </Tooltip>
            <Tooltip title="重新上传">
              <Button shape="circle" size="small" @click="openReuploadEditor(record)">
                <IconifyIcon class="size-4" icon="lucide:upload" />
              </Button>
            </Tooltip>
            <Popconfirm title="确定删除该文件资源？" @confirm="deleteRecord(record)">
              <Tooltip title="删除">
                <Button danger shape="circle" size="small">
                  <IconifyIcon class="size-4" icon="lucide:trash-2" />
                </Button>
              </Tooltip>
            </Popconfirm>
          </div>
        </article>
      </div>

      <Empty v-else class="py-20" description="暂无资源" />
    </Spin>

    <div class="file-resource-preview__pagination">
      <Pagination
        :current="pagination.pageIndex"
        :page-size="pagination.pageSize"
        :page-size-options="['12', '24', '48', '96']"
        :show-total="(value) => `共 ${value} 条`"
        :total="total"
        show-less-items
        show-size-changer
        @change="onPageChange"
        @show-size-change="onPageChange"
      />
    </div>

    <Modal
      v-model:open="previewOpen"
      :footer="null"
      :title="previewRecord ? getRecordTitle(previewRecord) : '资源预览'"
      width="min(960px, 88vw)"
      @cancel="closePreview"
    >
      <div v-if="previewRecord" class="file-resource-preview__modal">
        <div class="file-resource-preview__viewer">
          <img
            v-if="isImageResource(previewRecord) && previewUrl"
            :alt="getRecordTitle(previewRecord)"
            :src="previewUrl"
          />
          <video
            v-else-if="isVideoResource(previewRecord) && previewUrl"
            :src="previewUrl"
            controls
          />
          <audio
            v-else-if="isAudioResource(previewRecord) && previewUrl"
            :src="previewUrl"
            controls
          />
          <iframe
            v-else-if="isPdfResource(previewRecord) && previewUrl"
            :src="previewUrl"
          />
          <div v-else class="file-resource-preview__generic">
            <IconifyIcon :icon="getPreviewIcon(previewRecord)" />
            <div>{{ getResourceTypeLabel(previewRecord.type) }}</div>
          </div>
        </div>

        <div class="file-resource-preview__detail">
          <dl>
            <dt>文件ID</dt>
            <dd>{{ previewRecord.id || '-' }}</dd>
            <dt>文件类型</dt>
            <dd>{{ getResourceTypeLabel(previewRecord.type) }}</dd>
            <dt>Mime类型</dt>
            <dd>{{ previewRecord.mimeType || '-' }}</dd>
            <dt>类别</dt>
            <dd>{{ previewRecord.category || '-' }}</dd>
            <dt>文件路径</dt>
            <dd>
              <div
                v-for="path in normalizeStringList(previewRecord.paths)"
                :key="path"
                class="file-resource-preview__path"
                :title="path"
              >
                {{ path }}
              </div>
            </dd>
          </dl>

          <Space wrap>
            <Button @click="copyUrl(previewUrl)">
              <IconifyIcon class="mr-1 size-4" icon="lucide:copy" />
              复制地址
            </Button>
            <Button @click="openUrl(previewUrl)">
              <IconifyIcon class="mr-1 size-4" icon="lucide:external-link" />
              新窗口打开
            </Button>
            <Button type="primary" @click="downloadUrl(previewUrl, getRecordTitle(previewRecord))">
              <IconifyIcon class="mr-1 size-4" icon="lucide:download" />
              下载
            </Button>
          </Space>
        </div>
      </div>
    </Modal>

    <Modal
      v-model:open="editorOpen"
      :confirm-loading="editorSaving"
      :title="getEditorTitle()"
      width="min(960px, 90vw)"
      @cancel="closeEditor"
      @ok="submitEditor"
    >
      <Form layout="vertical" class="file-resource-preview__editor">
        <Form.Item label="文件名称" required>
          <Input
            v-model:value="editorForm.name"
            allow-clear
            placeholder="请输入文件名称"
          />
        </Form.Item>
        <Form.Item label="文件类型">
          <Select
            v-model:value="editorForm.type"
            :options="resourceTypeSelectOptions"
          />
        </Form.Item>
        <Form.Item label="类别">
          <Input
            v-model:value="editorForm.category"
            allow-clear
            placeholder="请输入类别"
          />
        </Form.Item>
        <Form.Item label="业务对象ID">
          <Input
            v-model:value="editorForm.bizObjId"
            allow-clear
            placeholder="请输入业务对象ID"
          />
        </Form.Item>
        <Form.Item label="Mime类型">
          <Input
            v-model:value="editorForm.mimeType"
            allow-clear
            placeholder="上传文件后自动填充，也可手动调整"
          />
        </Form.Item>
        <Form.Item label="标签列表">
          <Input
            v-model:value="editorForm.tagListInput"
            allow-clear
            placeholder="多个标签用逗号分隔"
          />
        </Form.Item>
        <Form.Item label="封面图">
          <div class="file-resource-preview__upload-row">
            <Input
              v-model:value="editorForm.coverUrl"
              allow-clear
              placeholder="封面图地址"
            />
            <Upload
              :custom-request="(options) => uploadEditorFile(options, 'cover')"
              :show-upload-list="false"
              accept="image/*"
            >
              <Button>
                <IconifyIcon class="mr-1 size-4" icon="lucide:image-up" />
                上传封面
              </Button>
            </Upload>
          </div>
        </Form.Item>
        <Form.Item :label="editorMode === 'reupload' ? '重新上传文件' : '文件路径'" required>
          <div class="file-resource-preview__upload-stack">
            <Upload
              v-if="editorForm.type === 'Image'"
              accept="image/*"
              :custom-request="(options) => uploadEditorFile(options, 'path')"
              :file-list="editorImageFileList"
              list-type="picture-card"
              :max-count="editorMode === 'reupload' ? 1 : undefined"
              :multiple="editorMode !== 'reupload'"
              @preview="previewEditorUploadFile"
              @remove="removeEditorUploadFile"
            >
              <div class="file-resource-preview__image-upload-trigger">
                <IconifyIcon class="size-5" icon="lucide:plus" />
              </div>
            </Upload>
            <Upload
              v-else
              :custom-request="(options) => uploadEditorFile(options, 'path')"
              :multiple="editorMode !== 'reupload'"
              :show-upload-list="false"
            >
              <Button type="primary">
                <IconifyIcon class="mr-1 size-4" icon="lucide:upload" />
                {{ editorMode === 'reupload' ? '上传并替换文件' : '上传文件' }}
              </Button>
            </Upload>
            <template v-if="editorForm.type !== 'Image'">
              <div
                v-for="path in editorForm.paths"
                :key="path"
                class="file-resource-preview__path-item"
              >
                <span :title="path">{{ path }}</span>
                <Button danger size="small" type="link" @click="removeEditorPath(path)">
                  删除
                </Button>
              </div>
            </template>
          </div>
        </Form.Item>
      </Form>
    </Modal>

    <Modal
      v-model:open="archiveOpen"
      :closable="!archiveRunning"
      :footer="null"
      title="打包下载"
      width="560px"
    >
      <div class="space-y-4">
        <Progress :percent="archivePercent" />
        <div class="text-muted-foreground text-sm">
          已处理 {{ archiveFinished }} / {{ archiveTotal }} 个文件
          <span v-if="archiveCurrent">，当前：{{ archiveCurrent }}</span>
        </div>
        <div v-if="archiveFailed.length > 0" class="file-resource-preview__failed">
          <div class="font-medium">失败文件</div>
          <div
            v-for="item in archiveFailed"
            :key="item.archivePath"
            class="file-resource-preview__failed-item"
          >
            {{ item.fileName }}：{{ item.error }}
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.file-resource-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-resource-preview__toolbar,
.file-resource-preview__batchbar {
  align-items: center;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  padding: 12px;
}

.file-resource-preview__toolbar {
  align-items: center;
  display: flex;
}

.file-resource-preview__filters {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 8px;
  min-width: 0;
}

.file-resource-preview__filter-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  width: 100%;
}

.file-resource-preview__query-actions {
  align-items: center;
  flex: 0 0 auto;
  justify-content: flex-end;
  margin-left: auto;
  min-width: 0;
}

.file-resource-preview__input {
  max-width: 220px;
  min-width: 180px;
  width: 18vw;
}

.file-resource-preview__grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.file-resource-preview__card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  cursor: pointer;
  min-width: 0;
  overflow: hidden;
  position: relative;
}

.file-resource-preview__card:hover {
  border-color: hsl(var(--primary));
}

.file-resource-preview__checkbox {
  left: 10px;
  position: absolute;
  top: 10px;
  z-index: 2;
}

.file-resource-preview__thumb {
  align-items: center;
  aspect-ratio: 4 / 3;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  display: flex;
  font-size: 42px;
  justify-content: center;
  overflow: hidden;
}

.file-resource-preview__thumb img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.file-resource-preview__play-badge {
  align-items: center;
  background: rgb(0 0 0 / 52%);
  border-radius: 999px;
  color: #fff;
  display: inline-flex;
  height: 40px;
  justify-content: center;
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
}

.file-resource-preview__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.file-resource-preview__title {
  color: hsl(var(--foreground));
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-resource-preview__meta,
.file-resource-preview__path {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-resource-preview__tags,
.file-resource-preview__status,
.file-resource-preview__actions,
.file-resource-preview__pagination {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.file-resource-preview__actions {
  position: absolute;
  right: 10px;
  top: 10px;
}

.file-resource-preview__pagination {
  justify-content: flex-end;
}

.file-resource-preview__editor {
  display: grid;
  gap: 0 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.file-resource-preview__editor :deep(.ant-form-item:nth-last-child(-n + 2)) {
  grid-column: 1 / -1;
}

.file-resource-preview__upload-row {
  align-items: center;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.file-resource-preview__upload-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-resource-preview__image-upload-trigger {
  align-items: center;
  color: hsl(var(--muted-foreground));
  display: flex;
  height: 100%;
  justify-content: center;
  width: 100%;
}

.file-resource-preview__path-item {
  align-items: center;
  background: hsl(var(--muted));
  border-radius: 6px;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 6px 8px;
}

.file-resource-preview__path-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-resource-preview__modal {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) 280px;
}

.file-resource-preview__viewer {
  align-items: center;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  display: flex;
  justify-content: center;
  min-height: 420px;
  overflow: hidden;
}

.file-resource-preview__viewer img,
.file-resource-preview__viewer video,
.file-resource-preview__viewer iframe {
  border: 0;
  max-height: 70vh;
  max-width: 100%;
  width: 100%;
}

.file-resource-preview__viewer iframe {
  height: 70vh;
}

.file-resource-preview__viewer audio {
  width: min(480px, 100%);
}

.file-resource-preview__generic {
  align-items: center;
  color: hsl(var(--muted-foreground));
  display: flex;
  flex-direction: column;
  font-size: 16px;
  gap: 12px;
}

.file-resource-preview__generic svg {
  font-size: 64px;
}

.file-resource-preview__detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.file-resource-preview__detail dl {
  display: grid;
  gap: 8px 12px;
  grid-template-columns: 72px minmax(0, 1fr);
  margin: 0;
}

.file-resource-preview__detail dt {
  color: hsl(var(--muted-foreground));
}

.file-resource-preview__detail dd {
  margin: 0;
  min-width: 0;
}

.file-resource-preview__failed {
  background: hsl(var(--muted));
  border-radius: 8px;
  max-height: 180px;
  overflow: auto;
  padding: 12px;
}

.file-resource-preview__failed-item {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  margin-top: 6px;
  word-break: break-all;
}

@media (max-width: 900px) {
  .file-resource-preview__toolbar {
    grid-template-columns: 1fr;
  }

  .file-resource-preview__query-actions {
    justify-content: flex-start;
    min-width: 0;
  }

  .file-resource-preview__input {
    max-width: none;
    width: 100%;
  }

  .file-resource-preview__editor {
    grid-template-columns: 1fr;
  }

  .file-resource-preview__modal {
    grid-template-columns: 1fr;
  }

  .file-resource-preview__viewer {
    min-height: 300px;
  }
}
</style>
