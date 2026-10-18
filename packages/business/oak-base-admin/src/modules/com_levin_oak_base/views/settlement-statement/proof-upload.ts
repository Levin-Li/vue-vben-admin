import { uploadFileByFileStorageController } from '@levin/admin-framework/framework-commons/app/api/file-storage-service';

import { fileResService } from '../../api/file-res-service';

// 上传 URL 只用于文件资源登记，结算动作只能接收服务器生成的资源 ID。
export async function uploadSettlementProof(
  file: File,
  scope: { id: string; orgId?: string; tenantId?: string },
): Promise<{ id: string; url: string }> {
  if (!scope.orgId?.trim()) throw new Error('结算单缺少管理组织，不能登记凭证');
  const url = await uploadFileByFileStorageController(file);
  if (typeof url !== 'string' || !url.trim())
    throw new Error('上传未返回文件地址');
  const id = await fileResService.create({
    bizType: 'SettlementStatementPaymentProof',
    bizObjId: scope.id,
    orgId: scope.orgId,
    name: file.name,
    mimeType: file.type,
    paths: [url],
    type: file.type.startsWith('image/') ? 'Image' : 'Document',
    publishable: false,
    tenantShared: false,
    orgShared: false,
    enable: true,
    editable: true,
  });
  if (typeof id !== 'string' || !id.trim() || id.length > 64 || /[/:]/.test(id))
    throw new Error('文件资源登记未返回有效资源 ID，请在资源库核对后重试');
  return { id, url };
}
