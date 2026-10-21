import { beforeEach, describe, expect, it, vi } from 'vitest';

const upload = vi.fn();

vi.mock('../request', () => ({
  requestClient: { upload },
}));

describe('file storage upload service', () => {
  beforeEach(() => {
    upload.mockReset();
  });

  it('uses the oak-base API module for direct single-file uploads', async () => {
    upload.mockResolvedValueOnce('/lfs/login-brand.png');
    const { uploadFileByFileStorageController } =
      await import('../file-storage-service');

    await expect(
      uploadFileByFileStorageController(new Blob(['image'])),
    ).resolves.toBe('/lfs/login-brand.png');
    expect(upload).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/fss/uploadSingleFile',
      { file: expect.any(Blob) },
      { baseURL: '' },
    );
  });

  it('sends local permanent and temporary uploads to their controller endpoints', async () => {
    // 两类本地上传都复用文件字段及 URL 解包，但必须选择各自的控制器路径。
    upload.mockResolvedValueOnce('/lfs/local/permanent.pdf');
    upload.mockResolvedValueOnce('/lfs/temp/qr.png');
    const { fileStorageService } = await import('../file-storage-service');
    const file = new File(['image'], 'qr.png', { type: 'image/png' });

    await expect(fileStorageService.uploadLocalPermanent(file)).resolves.toBe(
      '/lfs/local/permanent.pdf',
    );
    await expect(fileStorageService.uploadLocalTemporary(file)).resolves.toBe(
      '/lfs/temp/qr.png',
    );

    expect(upload).toHaveBeenNthCalledWith(
      1,
      '/com.levin.oak.base/V1/api/fss/uploadLocalPermanent',
      { file },
      { baseURL: '' },
    );
    expect(upload).toHaveBeenNthCalledWith(
      2,
      '/com.levin.oak.base/V1/api/fss/uploadLocalTemporary',
      { file },
      { baseURL: '' },
    );
  });
});
