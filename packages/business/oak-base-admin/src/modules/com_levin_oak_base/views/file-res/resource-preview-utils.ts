export type FileResourceType =
  | 'Audio'
  | 'Document'
  | 'Image'
  | 'Other'
  | 'Video'
  | 'Zip';

export interface FileResourceRecord {
  bizObjId?: number | string;
  category?: string;
  coverUrl?: string;
  createTime?: string;
  deleted?: boolean;
  editable?: boolean;
  enable?: boolean;
  id?: number | string;
  lastUpdateTime?: string;
  mimeType?: string;
  name?: string;
  optimisticLock?: number | string;
  paths?: string[] | string;
  publishable?: boolean;
  tagList?: string[] | string;
  type?: FileResourceType | string;
}

export interface ArchiveEntryPlan {
  archivePath: string;
  fileName: string;
  record: FileResourceRecord;
  recordId: string;
  resourceName: string;
  sourceUrl: string;
  type: string;
}

export interface ArchiveEntryResult extends ArchiveEntryPlan {
  error?: string;
  size?: number;
  status: 'failed' | 'success';
}

export interface ZipInputEntry {
  data: Blob | Uint8Array | string;
  path: string;
}

export type ArchiveFetch = (url: string) => Promise<{
  blob: () => Promise<Blob>;
  ok: boolean;
  status: number;
}>;

export interface CreateResourceArchiveOptions {
  fetchFile?: ArchiveFetch;
  onProgress?: (state: {
    current?: ArchiveEntryPlan;
    finished: number;
    total: number;
  }) => void;
  records: FileResourceRecord[];
}

export interface CreateResourceArchiveResult {
  failed: ArchiveEntryResult[];
  manifest: ReturnType<typeof buildArchiveManifest>;
  successCount: number;
  zipBlob: Blob;
}

export const RESOURCE_TYPE_OPTIONS: Array<{
  label: string;
  value: 'all' | FileResourceType;
}> = [
  { label: '全部', value: 'all' },
  { label: '图片', value: 'Image' },
  { label: '视频', value: 'Video' },
  { label: '音频', value: 'Audio' },
  { label: '文档', value: 'Document' },
  { label: '压缩包', value: 'Zip' },
  { label: '其它', value: 'Other' },
];

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  Audio: '音频',
  Document: '文档',
  Image: '图片',
  Other: '其它',
  Video: '视频',
  Zip: '压缩包',
};

const textEncoder = new TextEncoder();

export function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normalizeStringList(parsed);
        }
      } catch {
        // Fall through to treating the value as a single path.
      }
    }

    return [trimmed];
  }

  return [];
}

export function resolveResourceUrl(record: FileResourceRecord): string {
  const paths = normalizeStringList(record.paths);
  const coverUrl = String(record.coverUrl || '').trim();

  if (coverUrl) {
    return coverUrl;
  }

  return paths[0] || '';
}

export function resolveDownloadUrls(record: FileResourceRecord): string[] {
  const paths = normalizeStringList(record.paths);
  if (paths.length > 0) {
    return paths;
  }

  return normalizeStringList(record.coverUrl);
}

export function getResourceTypeLabel(type?: string): string {
  return RESOURCE_TYPE_LABELS[type || ''] || type || '未知';
}

export function isImageResource(record: FileResourceRecord): boolean {
  return record.type === 'Image' || /^image\//i.test(record.mimeType || '');
}

export function isVideoResource(record: FileResourceRecord): boolean {
  return record.type === 'Video' || /^video\//i.test(record.mimeType || '');
}

export function isAudioResource(record: FileResourceRecord): boolean {
  return record.type === 'Audio' || /^audio\//i.test(record.mimeType || '');
}

export function isPdfResource(record: FileResourceRecord): boolean {
  const url = resolveResourceUrl(record).split('?')[0] || '';
  return (
    record.type === 'Document' &&
    (/application\/pdf/i.test(record.mimeType || '') ||
      url.toLowerCase().endsWith('.pdf'))
  );
}

export function inferResourceType(mimeType?: string): FileResourceType {
  if (/^image\//i.test(mimeType || '')) {
    return 'Image';
  }
  if (/^video\//i.test(mimeType || '')) {
    return 'Video';
  }
  if (/^audio\//i.test(mimeType || '')) {
    return 'Audio';
  }
  if (/zip|compressed|archive/i.test(mimeType || '')) {
    return 'Zip';
  }
  if (mimeType) {
    return 'Document';
  }

  return 'Other';
}

export function normalizeTagInput(value: string): string[] {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function sanitizeFileName(value: unknown, fallback = 'file'): string {
  const normalized = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .slice(0, 120);

  return normalized || fallback;
}

export function resolveUrlFileName(url: string, fallback: string): string {
  const cleanUrl = url.split('#')[0]?.split('?')[0] || '';
  const lastSegment = cleanUrl.slice(cleanUrl.lastIndexOf('/') + 1);

  try {
    return sanitizeFileName(decodeURIComponent(lastSegment), fallback);
  } catch {
    return sanitizeFileName(lastSegment, fallback);
  }
}

export function buildArchiveEntryPlans(
  records: FileResourceRecord[],
): ArchiveEntryPlan[] {
  const usedPaths = new Set<string>();
  const plans: ArchiveEntryPlan[] = [];

  for (const record of records) {
    const recordId = sanitizeFileName(record.id, 'unknown');
    const resourceName = sanitizeFileName(record.name, recordId);
    const type = String(record.type || 'Other');
    const typeDir = sanitizeFileName(getResourceTypeLabel(type), '其它');
    const urls = resolveDownloadUrls(record);

    urls.forEach((sourceUrl, index) => {
      const fallbackName = `${resourceName}-${index + 1}`;
      const fileName = resolveUrlFileName(sourceUrl, fallbackName);
      const resourceDir = `${typeDir}/${resourceName}_${recordId}`;
      let archivePath = `${resourceDir}/${String(index + 1).padStart(3, '0')}-${fileName}`;
      let duplicateIndex = 2;

      while (usedPaths.has(archivePath)) {
        archivePath = `${resourceDir}/${String(index + 1).padStart(3, '0')}-${duplicateIndex}-${fileName}`;
        duplicateIndex += 1;
      }

      usedPaths.add(archivePath);
      plans.push({
        archivePath,
        fileName,
        record,
        recordId,
        resourceName,
        sourceUrl,
        type,
      });
    });
  }

  return plans;
}

export function buildArchiveManifest(
  records: FileResourceRecord[],
  results: ArchiveEntryResult[],
) {
  return {
    generatedAt: new Date().toISOString(),
    resourceCount: records.length,
    fileCount: results.length,
    successCount: results.filter((item) => item.status === 'success').length,
    failedCount: results.filter((item) => item.status === 'failed').length,
    resources: records.map((record) => ({
      id: record.id,
      name: record.name,
      type: record.type,
      mimeType: record.mimeType,
      category: record.category,
      tagList: normalizeStringList(record.tagList),
      paths: normalizeStringList(record.paths),
      coverUrl: record.coverUrl,
    })),
    files: results.map((item) => ({
      recordId: item.recordId,
      resourceName: item.resourceName,
      sourceUrl: item.sourceUrl,
      archivePath: item.archivePath,
      status: item.status,
      size: item.size || 0,
      error: item.error,
    })),
  };
}

export async function createResourceArchive({
  fetchFile = fetch,
  onProgress,
  records,
}: CreateResourceArchiveOptions): Promise<CreateResourceArchiveResult> {
  const plans = buildArchiveEntryPlans(records);
  const zipEntries: ZipInputEntry[] = [];
  const results: ArchiveEntryResult[] = [];
  let finished = 0;

  for (const plan of plans) {
    onProgress?.({
      current: plan,
      finished,
      total: plans.length,
    });

    try {
      const response = await fetchFile(plan.sourceUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      zipEntries.push({
        path: plan.archivePath,
        data: blob,
      });
      results.push({
        ...plan,
        size: blob.size,
        status: 'success',
      });
    } catch (error) {
      results.push({
        ...plan,
        error: error instanceof Error ? error.message : String(error),
        status: 'failed',
      });
    } finally {
      finished += 1;
      onProgress?.({
        finished,
        total: plans.length,
      });
    }
  }

  const successCount = results.filter((item) => item.status === 'success').length;
  if (successCount === 0) {
    throw new Error('所有文件都无法下载');
  }

  const manifest = buildArchiveManifest(records, results);
  zipEntries.push({
    path: 'manifest.json',
    data: JSON.stringify(manifest, null, 2),
  });

  return {
    failed: results.filter((item) => item.status === 'failed'),
    manifest,
    successCount,
    zipBlob: await createZipBlob(zipEntries),
  };
}

export async function createZipBlob(entries: ZipInputEntry[]): Promise<Blob> {
  const fileParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const pathBytes = textEncoder.encode(entry.path);
    const dataBytes = await toUint8Array(entry.data);
    const crc = crc32(dataBytes);
    const localHeader = createLocalHeader(pathBytes, dataBytes.length, crc);
    const centralHeader = createCentralHeader(
      pathBytes,
      dataBytes.length,
      crc,
      offset,
    );

    fileParts.push(localHeader, pathBytes, dataBytes);
    centralParts.push(centralHeader, pathBytes);
    offset += localHeader.length + pathBytes.length + dataBytes.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = createEndRecord(entries.length, centralSize, centralOffset);

  const zipBytes = concatUint8Arrays([...fileParts, ...centralParts, endRecord]);
  const zipBuffer = zipBytes.buffer.slice(
    zipBytes.byteOffset,
    zipBytes.byteOffset + zipBytes.byteLength,
  ) as ArrayBuffer;

  return new Blob([zipBuffer], {
    type: 'application/zip',
  });
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

async function toUint8Array(data: Blob | Uint8Array | string) {
  if (data instanceof Uint8Array) {
    return data;
  }

  if (typeof data === 'string') {
    return textEncoder.encode(data);
  }

  return new Uint8Array(await data.arrayBuffer());
}

function createLocalHeader(
  pathBytes: Uint8Array,
  size: number,
  crc: number,
): Uint8Array {
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x0403_4b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, pathBytes.length, true);
  view.setUint16(28, 0, true);

  return header;
}

function createCentralHeader(
  pathBytes: Uint8Array,
  size: number,
  crc: number,
  offset: number,
): Uint8Array {
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x0201_4b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, pathBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);

  return header;
}

function createEndRecord(
  entryCount: number,
  centralSize: number,
  centralOffset: number,
): Uint8Array {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);

  view.setUint32(0, 0x0605_4b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);

  return record;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffff_ffff;

  for (const byte of data) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
  }

  return (crc ^ 0xffff_ffff) >>> 0;
}
