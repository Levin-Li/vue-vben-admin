import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

function toEditableTarget(value: unknown) {
  if (typeof value !== 'string') return value;
  const separator = value.indexOf(':');
  if (separator <= 0) return value;
  return { endpoint: value.slice(separator + 1), type: value.slice(0, separator) };
}

function normalizeRouteRecord(record: any) {
  if (!record || !Array.isArray(record.targetList)) return record;
  return { ...record, targetList: record.targetList.map(toEditableTarget) };
}

function normalizeRouteResponse(response: any) {
  const payload = response?.data ?? response;
  if (Array.isArray(payload?.items)) {
    payload.items = payload.items.map(normalizeRouteRecord);
  } else if (payload?.targetList) {
    Object.assign(payload, normalizeRouteRecord(payload));
  }
  return response;
}

@Service({
  basePath: '/EmailRelayRoute',
  controllerClass: 'com.levin.oak.base.controller.BizEmailRelayRouteController',
  description: '自定义域名入站邮件中转路由',
  title: '邮件中转路由',
  type: '系统数据-邮件中转路由',
})
export class EmailRelayRouteService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-邮件中转路由', action: '查询列表' })
  @CRUD.ListTable({ refEntityClass: 'com.levin.oak.base.entities.EmailRelayRoute' })
  async list(params?: any, options?: any) {
    return normalizeRouteResponse(await this.get('list', { ...options, params }));
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-邮件中转路由', action: '新增' })
  @CRUD.Op({ opRefTargetType: 'None' })
  async create(data?: any, options?: any) {
    return this.post('create', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-邮件中转路由', action: '更新' })
  @CRUD.Op()
  async update(data?: any, options?: any) {
    return this.put('update', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-邮件中转路由', action: '删除' })
  @CRUD.Op()
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', { ...options, params });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-邮件中转路由', action: '查看详情' })
  @CRUD.Op({ confirmText: 'None' })
  async retrieve(params?: any, options?: any) {
    return normalizeRouteResponse(await this.get('retrieve', { ...options, params }));
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-邮件中转路由', action: '预检' })
  @CRUD.Op({ label: '预检', confirmText: 'None', opRefTargetType: 'None' })
  async preview(data?: any, options?: any) {
    return this.post('preview', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-邮件中转路由', action: '预检DNS' })
  @CRUD.Op({ label: '预检DNS', confirmText: 'None', opRefTargetType: 'None' })
  async previewDns(data?: any, options?: any) {
    return this.post('previewDns', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-邮件中转路由', action: '测试邮件中转配置' })
  @CRUD.Op({ label: '测试配置', confirmText: 'None', opRefTargetType: 'None' })
  async testConfiguration(data?: any, options?: any) {
    return this.post('testConfiguration', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-邮件中转路由', action: '同步或修复邮件中转 DNS' })
  @CRUD.Op({ label: '同步/修复DNS', confirmText: '确认同步或补回 Forward Email 验证记录？系统不会删除 DNS 记录。', opRefTargetType: 'None' })
  async syncDns(data?: any, options?: any) {
    return this.post('syncDns', { ...options, data });
  }


  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-邮件中转路由', action: '同步' })
  @CRUD.Op({ label: '同步', confirmText: '确认将路由同步到邮件提供商？', opRefTargetType: 'None' })
  async sync(data?: any, options?: any) {
    return this.post('sync', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-邮件中转路由', action: '自动配置邮件中转' })
  @CRUD.Op({ label: '自动配置', confirmText: '确认同步中转路由并自动配置 DNS？', opRefTargetType: 'None' })
  async autoConfigure(data?: any, options?: any) {
    return this.post('autoConfigure', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-邮件中转路由', action: '删除提供商资源' })
  @CRUD.Op({ label: '删除提供商资源', confirmText: '确认删除当前路由在邮件提供商中的资源？此操作不会删除本地记录。', opRefTargetType: 'None' })
  async removeProviderResource(data?: any, options?: any) {
    return this.post('removeProviderResource', { ...options, data });
  }
}

export const emailRelayRouteService = new EmailRelayRouteService();
