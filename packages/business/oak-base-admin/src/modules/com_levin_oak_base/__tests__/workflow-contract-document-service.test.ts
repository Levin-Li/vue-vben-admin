import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ElectronicContractService } from '../api/electronic-contract-service';

const calls = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@levin/admin-framework', () => ({
  CRUD: { ListTable: () => () => {}, Op: () => () => {} },
  ResAuthorize: () => () => {},
  Service: () => () => {},
  rbacService: {},
  RequestService: class {
    get = calls.get;
  },
}));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: {} }),
}));

// 业务拒绝可能以HTTP200 JSON返回，必须在转换成预览URL前拒绝。
describe('合同文档认证接口', () => {
  beforeEach(() => vi.clearAllMocks());
  it('同租户读取保留合同种类与修订，省略受保护租户字段', async () => {
    const service = new ElectronicContractService(() => ({
      tenantId: 'tenant-a',
    }));
    calls.get.mockResolvedValue(
      new Blob(['%PDF'], { type: 'application/pdf' }),
    );
    await service.document({
      id: 'contract-1',
      kind: 'signed',
      representation: 'pdf',
      revision: 2,
      tenantId: 'tenant-a',
      orgId: 'org-a',
    });
    expect(calls.get).toHaveBeenCalledWith('use/document', {
      params: {
        id: 'contract-1',
        kind: 'signed',
        representation: 'pdf',
        revision: 2,
        orgId: 'org-a',
      },
      responseType: 'blob',
    });
  });
  it('跨租户引用拒绝而非静默移除后读取', async () => {
    const service = new ElectronicContractService(() => ({
      tenantId: 'tenant-b',
    }));
    await expect(
      service.document({
        id: 'contract-1',
        kind: 'original',
        representation: 'original',
        revision: 1,
        tenantId: 'tenant-a',
      }),
    ).rejects.toThrow('不属于当前会话租户');
    expect(calls.get).not.toHaveBeenCalled();
  });
  it.each(['application/json', 'text/html'])(
    '拒绝%s错误体伪装的文件',
    async (type) => {
      const service = new ElectronicContractService();
      calls.get.mockResolvedValue(new Blob(['error'], { type }));
      await expect(
        service.document({
          id: 'contract-1',
          kind: 'original',
          representation: 'original',
          revision: 1,
        }),
      ).rejects.toThrow('文档读取失败');
    },
  );
  it('分页按标准JSON读取，不带representation或客户端文件定位参数', async () => {
    const service = new ElectronicContractService(() => ({
      tenantId: 'tenant-a',
    }));
    const result = {
      pageNo: 2,
      pageCount: 2,
      mimeType: 'image/png',
      contentBase64: 'png',
    };
    calls.get.mockResolvedValue(result);
    expect(
      await service.documentPage({
        id: 'contract-1',
        kind: 'signed',
        revision: 3,
        page: 2,
        tenantId: 'tenant-a',
        orgId: 'org-a',
      }),
    ).toBe(result);
    expect(calls.get).toHaveBeenCalledWith('use/document-page', {
      params: {
        id: 'contract-1',
        kind: 'signed',
        revision: 3,
        page: 2,
        orgId: 'org-a',
      },
    });
  });
  it('分页读取不允许跨租户，修订错误保留正式接口错误', async () => {
    const service = new ElectronicContractService(() => ({
      tenantId: 'tenant-b',
    }));
    await expect(
      service.documentPage({
        id: 'contract-1',
        kind: 'original',
        revision: 3,
        page: 1,
        tenantId: 'tenant-a',
      }),
    ).rejects.toThrow('不属于当前会话租户');
    expect(calls.get).not.toHaveBeenCalled();
    calls.get.mockRejectedValue(new Error('合同修订已变化'));
    await expect(
      service.documentPage({
        id: 'contract-1',
        kind: 'original',
        revision: 3,
        page: 1,
      }),
    ).rejects.toThrow('合同修订已变化');
  });
  it('审批引用使用最小接口并投影丢弃额外URL和FileRes字段', async () => {
    const service = new ElectronicContractService(() => ({
      tenantId: 'tenant-a',
    }));
    calls.get.mockResolvedValue({
      id: 'contract-1',
      name: '线上合同',
      optimisticLock: 3,
      status: 'Draft',
      hasOriginal: true,
      hasSigned: false,
      fileName: '合同.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileUrl: 'https://files.example.test/file?signature=fixture-private',
      fileResId: 'resource-not-for-ui',
      signedFileUrl: 'https://files.example.test/signed?signature=private',
    });
    const reference = await service.documentReference({
      id: 'contract-1',
      tenantId: 'tenant-a',
      orgId: 'org-a',
    });
    expect(calls.get).toHaveBeenCalledWith('use/document-reference', {
      params: { id: 'contract-1', orgId: 'org-a' },
    });
    expect(reference).toMatchObject({
      id: 'contract-1',
      optimisticLock: 3,
      hasOriginal: true,
    });
    expect(reference).not.toHaveProperty('fileUrl');
    expect(reference).not.toHaveProperty('fileResId');
    expect(reference).not.toHaveProperty('signedFileUrl');
  });
  it('无效引用或错误目标不能挂载审批正文', async () => {
    const service = new ElectronicContractService();
    calls.get.mockResolvedValue({
      id: 'other',
      optimisticLock: 1,
      hasOriginal: true,
      hasSigned: false,
    });
    await expect(
      service.documentReference({ id: 'contract-1' }),
    ).rejects.toThrow('文档引用无效');
  });
});
