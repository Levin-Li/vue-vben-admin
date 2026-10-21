import { buildModuleRequestPath } from '../../api';
import { ResAuthorize, Service } from '../../api-authorize';
import { RequestService } from '../../request-service';
import { requestClient } from './request';

export const FILE_STORAGE_API_MODULE = '/com.levin.oak.base/V1/api';

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
  // 各上传路径统一由控制器 API service 生成，页面无需拼接模块前缀。
  getLocalPermanentUploadPath() {
    return this.buildRequestPath('uploadLocalPermanent');
  }

  getLocalTemporaryUploadPath() {
    return this.buildRequestPath('uploadLocalTemporary');
  }

  getMultiUploadPath() {
    return this.buildRequestPath('uploadFiles');
  }

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

  getSingleUploadPath() {
    return this.buildRequestPath('uploadSingleFile');
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-文件存储',
    action: '上传单个文件',
  })
  async uploadFile(
    file: Blob | File,
    options?: any,
    uploadPath: string = this.getSingleUploadPath(),
  ) {
    const result = await requestClient.upload<any>(
      buildModuleRequestPath(uploadPath, FILE_STORAGE_API_MODULE),
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
    return this.uploadFile(file, options, this.getMultiUploadPath());
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-文件存储',
    action: '上传本地长期文件',
  })
  async uploadLocalPermanent(file: Blob | File, options?: any) {
    // 本地长期文件复用同一 multipart 上传与 URL 解包逻辑。
    return this.uploadFile(file, options, this.getLocalPermanentUploadPath());
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '公共数据-文件存储',
    action: '上传本地临时文件',
  })
  async uploadLocalTemporary(file: Blob | File, options?: any) {
    // 临时上传仅改变后端目标入口，返回值仍是可直接使用的 URL。
    return this.uploadFile(file, options, this.getLocalTemporaryUploadPath());
  }
}

export const fileStorageService = new FileStorageService();
export const FILE_STORAGE_SINGLE_UPLOAD_PATH =
  fileStorageService.getSingleUploadPath();
export const FILE_STORAGE_MULTI_UPLOAD_PATH =
  fileStorageService.getMultiUploadPath();
export const FILE_STORAGE_LOCAL_PERMANENT_UPLOAD_PATH =
  fileStorageService.getLocalPermanentUploadPath();
export const FILE_STORAGE_LOCAL_TEMPORARY_UPLOAD_PATH =
  fileStorageService.getLocalTemporaryUploadPath();

export async function uploadFileByFileStorageController(
  file: Blob | File,
  moduleBase: string = FILE_STORAGE_API_MODULE,
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
