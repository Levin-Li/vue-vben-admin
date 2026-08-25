import { describe, expect, it, vi } from 'vitest';

const upload = vi.fn();

vi.mock('../request', () => ({
  requestClient: { upload },
}));

describe('file storage upload service', () => {
  it('uses the oak-base API module for direct single-file uploads', async () => {
    upload.mockResolvedValueOnce('/lfs/login-brand.png');
    const { uploadFileByFileStorageController } = await import(
      '../file-storage-service'
    );

    await expect(
      uploadFileByFileStorageController(new Blob(['image']),),
    ).resolves.toBe('/lfs/login-brand.png');
    expect(upload).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/fss/uploadSingleFile',
      { file: expect.any(Blob) },
      { baseURL: '' },
    );
  });
});
