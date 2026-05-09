import { buildModuleRequestPath } from './system';
import { ResAuthorize, Service } from './common/api-authorize';
import { RequestService } from './common/request-service';
import { requestClient } from './request';

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

@Service({
  basePath: '/fss',
  controllerClass:
    'com.levin.oak.base.web.controller.commons.FileStorageController',
  description: '文件存储服务',
  title: '文件存储',
  type: '公共数据-文件存储',
})
export class FileStorageService extends RequestService {
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-文件存储',
    action: '获取OSS的上传凭证',
  })
  async getOssUploadCredential(params?: any, options?: any) {
    return this.get('getOssUploadCredential', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-文件存储',
    action: '上传单个文件',
  })
  async uploadFile(
    file: Blob | File,
    options?: any,
    uploadPath: string = FILE_STORAGE_SINGLE_UPLOAD_PATH,
  ) {
    const result = await requestClient.upload<any>(
      buildModuleRequestPath(uploadPath),
      {
        file,
      },
      {
        baseURL: '',
        ...options,
      },
    );

    return normalizeUploadUrl(result);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-文件存储',
    action: '上传多个文件',
  })
  async uploadFiles(file: Blob | File, options?: any) {
    return this.uploadFile(file, options, FILE_STORAGE_MULTI_UPLOAD_PATH);
  }
}

export const fileStorageService = new FileStorageService();

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
