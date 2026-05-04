import { requestClient } from '@levin/admin-framework/framework-commons/app/api/request';

import { buildModuleRequestPath } from '../system';

export const FILE_STORAGE_SINGLE_UPLOAD_PATH = '/fss/uploadSingleFile';
export const FILE_STORAGE_MULTI_UPLOAD_PATH = '/fss/uploadFiles';

function normalizeUploadUrl(result: any) {
  if (typeof result === 'string' && result.trim()) {
    return result.trim();
  }

  if (result && typeof result === 'object') {
    const matchedUrl = Object.values(result).find(
      (value) => typeof value === 'string' && value.trim(),
    );

    if (typeof matchedUrl === 'string') {
      return matchedUrl.trim();
    }
  }

  throw new Error('上传接口未返回文件地址');
}

export async function uploadFileByFileStorageController(
  file: Blob | File,
  moduleBase?: string,
  uploadPath: string = FILE_STORAGE_SINGLE_UPLOAD_PATH,
) {
  const result = await requestClient.upload<any>(
    buildModuleRequestPath(uploadPath, moduleBase),
    {
      file,
    },
    {
      baseURL: '',
    },
  );

  return normalizeUploadUrl(result);
}
