/** Java Mp4JsonMetadataService 写入的顶层 uuid 标记。 */
const MARKER_UUID = new Uint8Array([
  152, 107, 151, 226, 75, 55, 74, 68, 156, 208, 253, 126, 246, 129, 93, 180,
]);
const MAGIC = new TextEncoder().encode('OAKMP4J1');
const MAX_JSON_BYTES = 64 * 1024;
const MAX_BOXES = 128;
const MAX_REQUESTS = MAX_BOXES * 3;
const MAX_READ_BYTES = MAX_JSON_BYTES + 32;
const MAX_REMOTE_WRITE_BYTES = 512 * 1024 * 1024;

export type Mp4JsonMetadata = Record<string, unknown>;

interface RangeReader {
  length(): Promise<number>;
  read(offset: number, length: number): Promise<Uint8Array>;
}

interface BoxInfo {
  end: number;
  headerSize: number;
  start: number;
}

interface ScanResult {
  marker: BoxInfo | null;
  openEnded: boolean;
}

/** 只读取 Blob 的指定区间，不解码视频流。 */
class BlobReader implements RangeReader {
  constructor(private readonly blob: Blob) {}

  async length(): Promise<number> {
    return this.blob.size;
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    if (offset < 0 || length < 1 || offset + length > this.blob.size) {
      throw new Error('MP4 读取范围无效');
    }
    return new Uint8Array(
      await this.blob.slice(offset, offset + length).arrayBuffer(),
    );
  }
}

/** 浏览器跨域请求须由视频来源开放 CORS 和 Range 响应头。 */
class HttpRangeReader implements RangeReader {
  private requests = 0;
  private total = -1;

  constructor(private readonly url: string) {}

  async length(): Promise<number> {
    if (this.total < 0) await this.read(0, 8);
    return this.total;
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    if (
      ++this.requests > MAX_REQUESTS ||
      length < 1 ||
      length > MAX_READ_BYTES ||
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(offset + length)
    ) {
      throw new Error('视频 Range 请求超限');
    }

    const response = await fetch(this.url, {
      method: 'GET',
      headers: { Range: `bytes=${offset}-${offset + length - 1}` },
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
    if (response.status !== 206) throw new Error('视频来源不支持 HTTP Range');

    const contentRange = response.headers.get('Content-Range');
    const match =
      contentRange === null
        ? null
        : /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange);
    if (contentRange !== null && !match) throw new Error('视频 Range 响应无效');
    // Content-Range 未通过 CORS 暴露时，HEAD 的 Content-Length 可用于定位 MP4 box。
    let total = this.total;
    if (match) total = Number(match[3]);
    else if (total < 0) total = await this.totalFromHead();
    if (
      !Number.isSafeInteger(total) ||
      total < offset + length ||
      (match &&
        (Number(match[1]) !== offset ||
          Number(match[2]) !== offset + length - 1)) ||
      (this.total >= 0 && this.total !== total)
    ) {
      throw new Error('视频 Range 总长度或区间无效');
    }
    const encoding = response.headers.get('Content-Encoding');
    if (encoding && encoding.toLowerCase() !== 'identity')
      throw new Error('视频 Range 响应编码无效');
    const declaredLength = response.headers.get('Content-Length');
    if (declaredLength !== null && Number(declaredLength) !== length) {
      throw new Error('视频 Range 响应长度无效');
    }

    // 先检查响应大小，再读取缓冲区，避免忽略 Range 的服务端送来整部视频。
    if (!response.body) throw new Error('视频 Range 响应没有内容');
    const stream = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    try {
      while (true) {
        const { done, value } = await stream.read();
        if (done) break;
        received += value.byteLength;
        if (received > length) throw new Error('视频 Range 响应长度无效');
        chunks.push(value);
      }
    } catch (error) {
      await stream.cancel().catch(() => undefined);
      throw error;
    } finally {
      stream.releaseLock();
    }
    if (received !== length) throw new Error('视频 Range 响应长度无效');
    const bytes = new Uint8Array(length);
    let cursor = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, cursor);
      cursor += chunk.byteLength;
    }
    this.total = total;
    return bytes;
  }

  private async totalFromHead(): Promise<number> {
    if (++this.requests > MAX_REQUESTS) throw new Error('视频 Range 请求超限');
    const response = await fetch(this.url, {
      method: 'HEAD',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new Error('视频来源无法提供文件总长度');
    const size = Number(response.headers.get('Content-Length'));
    if (!Number.isSafeInteger(size) || size < 8)
      throw new Error('视频文件总长度无效');
    return size;
  }
}

/** 扫描顶层 box，跳过视频数据；重复或损坏的标记直接拒绝。 */
async function scanBoxes(reader: RangeReader): Promise<ScanResult> {
  const total = await reader.length();
  if (!Number.isSafeInteger(total) || total < 8)
    throw new Error('MP4 box 结构无效');
  let offset = 0;
  let marker: BoxInfo | null = null;
  let openEnded = false;
  let hasMoov = false;
  let hasMdat = false;

  for (let count = 0; offset < total; count++) {
    if (count >= MAX_BOXES || total - offset < 8)
      throw new Error('MP4 box 结构无效');
    const header = await reader.read(offset, 8);
    const view = new DataView(
      header.buffer,
      header.byteOffset,
      header.byteLength,
    );
    let size = view.getUint32(0);
    const type = String.fromCodePoint(...header.subarray(4, 8));
    if (offset === 0 && type !== 'ftyp') throw new Error('不是 MP4 文件');
    let headerSize = 8;
    if (size === 1) {
      if (total - offset < 16) throw new Error('MP4 box 结构无效');
      const extended = await reader.read(offset + 8, 8);
      const extendedView = new DataView(
        extended.buffer,
        extended.byteOffset,
        extended.byteLength,
      );
      size = Number(extendedView.getBigUint64(0));
      headerSize = 16;
    } else if (size === 0) {
      size = total - offset;
      openEnded = true;
    }
    if (
      !Number.isSafeInteger(size) ||
      size < headerSize ||
      size > total - offset
    ) {
      throw new Error('MP4 box 结构无效');
    }
    if (type === 'moov') hasMoov = true;
    if (type === 'mdat') hasMdat = true;
    if (type === 'uuid' && size >= headerSize + MARKER_UUID.length) {
      const uuid = await reader.read(offset + headerSize, MARKER_UUID.length);
      if (uuid.every((value, index) => value === MARKER_UUID[index])) {
        if (marker) throw new Error('MP4 中存在多个本服务标记');
        marker = { start: offset, end: offset + size, headerSize };
      }
    }
    offset += size;
  }
  if (!hasMoov || !hasMdat) throw new Error('MP4 缺少音视频结构块');
  return { marker, openEnded };
}

/** 读取 MP4 顶层 box，跳过视频数据；只识别本服务的 JSON 标记。 */
async function readMetadata(
  reader: RangeReader,
): Promise<Mp4JsonMetadata | null> {
  const { marker } = await scanBoxes(reader);
  if (!marker) return null;

  // 标记体为 8 字节版本标识、4 字节大端长度、UTF-8 JSON 对象。
  const payloadStart = marker.start + marker.headerSize + MARKER_UUID.length;
  const payloadLength = marker.end - payloadStart;
  if (
    payloadLength < MAGIC.length + 4 ||
    payloadLength > MAX_JSON_BYTES + MAGIC.length + 4
  ) {
    throw new Error('MP4 元数据长度无效');
  }
  const payload = await reader.read(payloadStart, payloadLength);
  if (!MAGIC.every((value, index) => value === payload[index]))
    throw new Error('MP4 元数据版本无效');
  const data = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  );
  const jsonLength = data.getUint32(MAGIC.length);
  if (jsonLength !== payloadLength - MAGIC.length - 4)
    throw new Error('MP4 元数据长度无效');
  try {
    const value: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        payload.subarray(MAGIC.length + 4),
      ),
    );
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('JSON 顶层值不是对象');
    return value as Mp4JsonMetadata;
  } catch {
    throw new Error('MP4 元数据不是 JSON 对象');
  }
}

/** 写入返回新 Blob；原文件字节保持不变，重复写入会替换末尾旧标记。 */
export async function writeMp4JsonMetadataToBlob(
  blob: Blob,
  metadata: Mp4JsonMetadata,
): Promise<Blob> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('MP4 元数据必须是 JSON 对象');
  }
  const jsonText = JSON.stringify(metadata);
  if (typeof jsonText !== 'string')
    throw new Error('MP4 元数据必须是 JSON 对象');
  const json = new TextEncoder().encode(jsonText);
  if (json.length > MAX_JSON_BYTES)
    throw new Error('MP4 元数据不能超过 64 KiB');
  const { marker, openEnded } = await scanBoxes(new BlobReader(blob));
  if (openEnded) throw new Error('末尾开放长度 MP4 box 不能安全追加数据');
  if (marker && marker.end !== blob.size)
    throw new Error('已有标记后还有数据，不能安全覆盖');

  const payload = new Uint8Array(
    8 + MARKER_UUID.length + MAGIC.length + 4 + json.length,
  );
  const view = new DataView(payload.buffer);
  view.setUint32(0, payload.length);
  payload.set(new TextEncoder().encode('uuid'), 4);
  payload.set(MARKER_UUID, 8);
  payload.set(MAGIC, 8 + MARKER_UUID.length);
  view.setUint32(8 + MARKER_UUID.length + MAGIC.length, json.length);
  payload.set(json, 8 + MARKER_UUID.length + MAGIC.length + 4);
  return new Blob([blob.slice(0, marker?.start ?? blob.size), payload], {
    type: blob.type || 'video/mp4',
  });
}

/** URL 写入需获取完整视频，返回新的 Blob；不会修改远端文件。 */
export async function writeMp4JsonMetadataFromUrl(
  url: string,
  metadata: Mp4JsonMetadata,
): Promise<Blob> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    throw new Error('视频链接无效');
  const response = await fetch(parsed.href, {
    method: 'GET',
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
  });
  if (response.status !== 200)
    throw new Error(`视频下载失败：HTTP ${response.status}`);
  const declaredLength = response.headers.get('Content-Length');
  if (
    declaredLength !== null &&
    (!Number.isSafeInteger(Number(declaredLength)) ||
      Number(declaredLength) > MAX_REMOTE_WRITE_BYTES)
  ) {
    throw new Error('远程 MP4 超过 512 MiB 上限');
  }
  if (!response.body) throw new Error('视频下载没有内容');
  const stream = response.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await stream.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_REMOTE_WRITE_BYTES)
        throw new Error('远程 MP4 超过 512 MiB 上限');
      chunks.push(Uint8Array.from(value));
    }
  } catch (error) {
    await stream.cancel().catch(() => undefined);
    throw error;
  } finally {
    stream.releaseLock();
  }
  if (declaredLength !== null && Number(declaredLength) !== received) {
    throw new Error('视频下载长度无效');
  }
  return writeMp4JsonMetadataToBlob(
    new Blob(chunks, { type: 'video/mp4' }),
    metadata,
  );
}

/** 从浏览器 File 或 Blob 中读取 Java 服务写入的 JSON。缺少标记时返回 null。 */
export async function readMp4JsonMetadataFromBlob(
  blob: Blob,
): Promise<Mp4JsonMetadata | null> {
  return readMetadata(new BlobReader(blob));
}

/** 从可访问的 HTTP(S) 视频按需读取 JSON；来源必须支持 CORS 和 206。 */
export async function readMp4JsonMetadataFromUrl(
  url: string,
): Promise<Mp4JsonMetadata | null> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    throw new Error('视频链接无效');
  return readMetadata(new HttpRangeReader(parsed.href));
}
