import { describe, expect, it } from 'vitest';

import {
  buildArchiveEntryPlans,
  buildArchiveManifest,
  createResourceArchive,
  createZipBlob,
  inferResourceType,
  normalizeTagInput,
  resolveResourceCoverUrl,
  normalizeStringList,
  resolveResourceUrl,
  sanitizeFileName,
} from '../resource-preview-utils';

describe('file resource preview utils', () => {
  it('normalizes JSON string paths and keeps non-image covers separate from file urls', () => {
    expect(normalizeStringList('["/lfs/a.png","/lfs/b.png"]')).toEqual([
      '/lfs/a.png',
      '/lfs/b.png',
    ]);
    expect(
      resolveResourceUrl({
        type: 'Image',
        coverUrl: '/lfs/cover.png',
        paths: ['/lfs/a.png'],
      }),
    ).toBe('/lfs/cover.png');
    expect(
      resolveResourceUrl({
        type: 'Document',
        coverUrl: '/lfs/cover.png',
        paths: ['/lfs/a.pdf'],
      }),
    ).toBe('/lfs/a.pdf');
    expect(
      resolveResourceCoverUrl({
        type: 'Document',
        coverUrl: '/lfs/cover.png',
        paths: ['/lfs/a.pdf'],
      }),
    ).toBe('/lfs/cover.png');
  });

  it('sanitizes resource names for archive paths', () => {
    expect(sanitizeFileName('../a:b*c?.png')).toBe('_a_b_c_.png');
  });

  it('normalizes comma and newline separated tag input', () => {
    expect(normalizeTagInput('首页, banner，推荐\n活动')).toEqual([
      '首页',
      'banner',
      '推荐',
      '活动',
    ]);
  });

  it('infers resource types from mime types for uploaded files', () => {
    expect(inferResourceType('image/png')).toBe('Image');
    expect(inferResourceType('video/mp4')).toBe('Video');
    expect(inferResourceType('audio/mpeg')).toBe('Audio');
    expect(inferResourceType('application/zip')).toBe('Zip');
    expect(inferResourceType('application/pdf')).toBe('Document');
    expect(inferResourceType('')).toBe('Other');
  });

  it('builds stable archive entry paths for multiple resource files', () => {
    const plans = buildArchiveEntryPlans([
      {
        id: 'res-1',
        name: '封面图',
        type: 'Image',
        paths: ['/lfs/a.png', '/lfs/b.png'],
      },
    ]);

    expect(plans.map((item) => item.archivePath)).toEqual([
      '图片/封面图_res-1/001-a.png',
      '图片/封面图_res-1/002-b.png',
    ]);
  });

  it('records success and failure entries in manifest', () => {
    const record = {
      id: 'res-1',
      name: '合同',
      type: 'Document',
      paths: ['/lfs/a.pdf'],
    };
    const [plan] = buildArchiveEntryPlans([record]);
    const manifest = buildArchiveManifest([record], [
      {
        ...plan!,
        size: 1024,
        status: 'success',
      },
      {
        ...plan!,
        archivePath: '文档/合同_res-1/002-missing.pdf',
        error: 'HTTP 404',
        fileName: 'missing.pdf',
        sourceUrl: '/lfs/missing.pdf',
        status: 'failed',
      },
    ]);

    expect(manifest.successCount).toBe(1);
    expect(manifest.failedCount).toBe(1);
    expect(manifest.files[1]).toMatchObject({
      status: 'failed',
      error: 'HTTP 404',
    });
  });

  it('creates a standard zip end record', async () => {
    const blob = await createZipBlob([
      { path: 'hello.txt', data: 'hello' },
      { path: 'manifest.json', data: '{"ok":true}' },
    ]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const endOffset = bytes.length - 22;
    const view = new DataView(bytes.buffer);

    expect(blob.type).toBe('application/zip');
    expect(view.getUint32(endOffset, true)).toBe(0x0605_4b50);
    expect(view.getUint16(endOffset + 10, true)).toBe(2);
  });

  it('creates an archive with a manifest when file downloads succeed', async () => {
    const progress: Array<{ finished: number; total: number }> = [];
    const result = await createResourceArchive({
      records: [
        {
          id: 'res-1',
          name: '图片',
          paths: ['/lfs/a.png'],
          type: 'Image',
        },
      ],
      fetchFile: async () => ({
        ok: true,
        status: 200,
        blob: async () => new Blob(['image-bytes'], { type: 'image/png' }),
      }),
      onProgress: (state) => progress.push(state),
    });

    expect(result.successCount).toBe(1);
    expect(result.failed).toEqual([]);
    expect(result.manifest.files).toHaveLength(1);
    expect(result.zipBlob.type).toBe('application/zip');
    expect(progress.at(-1)).toMatchObject({
      finished: 1,
      total: 1,
    });
  });

  it('keeps partial failures in the manifest and still creates an archive', async () => {
    const result = await createResourceArchive({
      records: [
        {
          id: 'res-1',
          name: '资料',
          paths: ['/lfs/a.pdf', '/lfs/missing.pdf'],
          type: 'Document',
        },
      ],
      fetchFile: async (url) =>
        url.includes('missing')
          ? {
              ok: false,
              status: 404,
              blob: async () => new Blob([]),
            }
          : {
              ok: true,
              status: 200,
              blob: async () => new Blob(['pdf-bytes']),
            },
    });

    expect(result.successCount).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.manifest.failedCount).toBe(1);
    expect(result.manifest.files[1]).toMatchObject({
      status: 'failed',
      error: 'HTTP 404',
    });
  });

  it('rejects archive creation when all downloads fail', async () => {
    await expect(
      createResourceArchive({
        records: [
          {
            id: 'res-1',
            name: '坏资源',
            paths: ['/lfs/missing.bin'],
            type: 'Other',
          },
        ],
        fetchFile: async () => ({
          ok: false,
          status: 500,
          blob: async () => new Blob([]),
        }),
      }),
    ).rejects.toThrow('所有文件都无法下载');
  });
});
