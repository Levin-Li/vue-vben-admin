import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  readMp4JsonMetadataFromBlob,
  readMp4JsonMetadataFromUrl,
  writeMp4JsonMetadataFromUrl,
  writeMp4JsonMetadataToBlob,
} from '../mp4-json-metadata';

const uuid = Uint8Array.from([
  152, 107, 151, 226, 75, 55, 74, 68, 156, 208, 253, 126, 246, 129, 93, 180,
]);
const encoder = new TextEncoder();

// 按 Java 写入格式构造真实的顶层 MP4 box 字节。
function box(type: string, payload: Uint8Array = new Uint8Array()): Uint8Array {
  const bytes = new Uint8Array(8 + payload.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.length);
  bytes.set(encoder.encode(type), 4);
  bytes.set(payload, 8);
  return bytes;
}

function join(...parts: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let position = 0;
  for (const part of parts) {
    bytes.set(part, position);
    position += part.length;
  }
  return bytes;
}

function mp4(metadata?: string): Uint8Array {
  const marker =
    metadata === undefined
      ? []
      : [
          box(
            'uuid',
            join(
              uuid,
              encoder.encode('OAKMP4J1'),
              Uint8Array.from([
                (encoder.encode(metadata).length >>> 24) & 255,
                (encoder.encode(metadata).length >>> 16) & 255,
                (encoder.encode(metadata).length >>> 8) & 255,
                encoder.encode(metadata).length & 255,
              ]),
              encoder.encode(metadata),
            ),
          ),
        ];
  return join(
    box('ftyp'),
    box('moov'),
    box('mdat', new Uint8Array(100_000)),
    ...marker,
  );
}

function blob(bytes: Uint8Array): Blob {
  return new Blob([Uint8Array.from(bytes)]);
}

afterEach(() => vi.unstubAllGlobals());

describe('视频 MP4 JSON 元数据读写', () => {
  it('读取本地 MP4 末尾标记并跳过媒体数据', async () => {
    await expect(
      readMp4JsonMetadataFromBlob(blob(mp4('{"author":"甲","id":42}'))),
    ).resolves.toEqual({ author: '甲', id: 42 });
  });

  it('未写入标记时返回 null，损坏与重复标记会报错', async () => {
    await expect(readMp4JsonMetadataFromBlob(blob(mp4()))).resolves.toBeNull();
    await expect(readMp4JsonMetadataFromBlob(blob(mp4('[]')))).rejects.toThrow(
      'JSON 对象',
    );
    const duplicate = join(
      mp4('{}'),
      box('uuid', join(uuid, encoder.encode('OAKMP4J1'), new Uint8Array(4))),
    );
    await expect(readMp4JsonMetadataFromBlob(blob(duplicate))).rejects.toThrow(
      '多个本服务标记',
    );
  });

  it('本地写入与再次写入均能读回最新对象，且不修改原 Blob', async () => {
    const original = blob(mp4());
    const first = await writeMp4JsonMetadataToBlob(original, {
      author: '甲',
      id: 'a',
    });
    const second = await writeMp4JsonMetadataToBlob(first, {
      author: '乙',
      id: 'b',
    });
    await expect(readMp4JsonMetadataFromBlob(original)).resolves.toBeNull();
    await expect(readMp4JsonMetadataFromBlob(first)).resolves.toEqual({
      author: '甲',
      id: 'a',
    });
    await expect(readMp4JsonMetadataFromBlob(second)).resolves.toEqual({
      author: '乙',
      id: 'b',
    });
    expect(second.size).toBe(first.size);
  });

  it('拒绝超大 JSON 与末尾开放长度的 MP4', async () => {
    await expect(
      writeMp4JsonMetadataToBlob(blob(mp4()), { id: 'x'.repeat(65_536) }),
    ).rejects.toThrow('64 KiB');
    const bytes = mp4();
    const openEnded = Uint8Array.from(bytes);
    new DataView(openEnded.buffer).setUint32(16, 0); // mdat box 的 size 字段
    await expect(
      writeMp4JsonMetadataToBlob(blob(openEnded), { id: 1 }),
    ).rejects.toThrow('开放长度');
  });

  it('分段下载仅获取需要的字节', async () => {
    const bytes = mp4('{"id":"video-1"}');
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      const range = /^bytes=(\d+)-(\d+)$/.exec(
        String((options.headers as Record<string, string>).Range),
      );
      if (!range) throw new Error('缺少 Range');
      const start = Number(range[1]);
      const end = Number(range[2]);
      return new Response(bytes.slice(start, end + 1), {
        status: 206,
        headers: { 'Content-Range': `bytes ${start}-${end}/${bytes.length}` },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      readMp4JsonMetadataFromUrl('https://example.com/video.mp4'),
    ).resolves.toEqual({ id: 'video-1' });
    expect(fetchMock.mock.calls.length).toBeLessThan(20);
    expect(
      fetchMock.mock.calls.every(
        ([, options]) => options.credentials === 'omit',
      ),
    ).toBe(true);
  });

  it('拒绝忽略 Range 的服务器及响应长度不匹配', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('whole file', { status: 200 })),
    );
    await expect(
      readMp4JsonMetadataFromUrl('https://example.com/video.mp4'),
    ).rejects.toThrow('不支持 HTTP Range');

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('12345678', {
            status: 206,
            headers: { 'Content-Range': 'bytes 1-8/100' },
          }),
      ),
    );
    await expect(
      readMp4JsonMetadataFromUrl('https://example.com/video.mp4'),
    ).rejects.toThrow('区间无效');
  });

  it('未暴露分段范围响应头时使用 HEAD 总长度', async () => {
    const bytes = mp4('{"id":"cors-video"}');
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      if (options.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: { 'Content-Length': String(bytes.length) },
        });
      }
      const range = /^bytes=(\d+)-(\d+)$/.exec(
        String((options.headers as Record<string, string>).Range),
      );
      if (!range) throw new Error('缺少 Range');
      return new Response(bytes.slice(Number(range[1]), Number(range[2]) + 1), {
        status: 206,
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      readMp4JsonMetadataFromUrl('https://example.com/video.mp4'),
    ).resolves.toEqual({ id: 'cors-video' });
    expect(
      fetchMock.mock.calls.filter(([, options]) => options.method === 'HEAD'),
    ).toHaveLength(1);
  });

  it('远程写入获取完整视频并返回带标记的新 Blob', async () => {
    const source = mp4();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(blob(source), { status: 200 })),
    );
    const result = await writeMp4JsonMetadataFromUrl(
      'https://example.com/video.mp4',
      { id: 'remote' },
    );
    await expect(readMp4JsonMetadataFromBlob(result)).resolves.toEqual({
      id: 'remote',
    });
    expect(result.size).toBeGreaterThan(source.length);
  });

  it('远程写入拒绝超过上限的视频', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(null, {
            status: 200,
            headers: { 'Content-Length': String(513 * 1024 * 1024) },
          }),
      ),
    );
    await expect(
      writeMp4JsonMetadataFromUrl('https://example.com/video.mp4', {
        id: 'too-big',
      }),
    ).rejects.toThrow('512 MiB');
  });
});
