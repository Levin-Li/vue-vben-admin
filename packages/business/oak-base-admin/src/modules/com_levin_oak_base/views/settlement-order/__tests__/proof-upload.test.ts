import { beforeEach, describe, expect, it, vi } from 'vitest';

import { uploadSettlementProof } from '../proof-upload';

const { upload, create } = vi.hoisted(() => ({
  upload: vi.fn(),
  create: vi.fn(),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/app/api/file-storage-service',
  () => ({ uploadFileByFileStorageController: upload }),
);
vi.mock('../../../api/file-res-service', () => ({
  fileResService: { create },
}));
beforeEach(() => vi.resetAllMocks());
describe('结算凭证上传', () => {
  it('上传 URL 登记文件资源后仅返回真实资源 ID，范围由当前会话注入并关闭共享', async () => {
    upload.mockResolvedValue('/lfs/proof.pdf');
    create.mockResolvedValue('file-1');
    expect(
      await uploadSettlementProof(
        new File(['proof'], 'proof.pdf', { type: 'application/pdf' }),
        { id: 's1', tenantId: 't1', orgId: 'o1' },
      ),
    ).toEqual({ id: 'file-1', url: '/lfs/proof.pdf' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        bizType: 'SettlementStatementPaymentProof',
        paths: ['/lfs/proof.pdf'],
        bizObjId: 's1',
        orgId: 'o1',
        publishable: false,
        tenantShared: false,
        orgShared: false,
      }),
    );
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty('tenantId');
  });
  it('上传失败不登记资源，登记返回 URL 时拒绝把它当作资源 ID', async () => {
    upload.mockRejectedValueOnce(new Error('failed'));
    await expect(
      uploadSettlementProof(new File([], 'a.pdf'), { id: 's1', orgId: 'o1' }),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
    upload.mockResolvedValue('/lfs/a.pdf');
    create.mockResolvedValue('/lfs/a.pdf');
    await expect(
      uploadSettlementProof(new File([], 'a.pdf'), { id: 's1', orgId: 'o1' }),
    ).rejects.toThrow('资源 ID');
  });
  it('无管理组织时不上传孤立凭证', async () => {
    await expect(
      uploadSettlementProof(new File([], 'a.pdf'), { id: 's1' }),
    ).rejects.toThrow('管理组织');
    expect(upload).not.toHaveBeenCalled();
  });
});
