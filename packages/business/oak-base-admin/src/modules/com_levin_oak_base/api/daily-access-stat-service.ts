import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

export type AccessSide = 'Backend' | 'Frontend';
export type AccessDimensionType = 'Ip' | 'User';

export interface DailyAccessStat {
  accessSide: AccessSide;
  dimensionType: AccessDimensionType;
  dimensionValue: string;
  peakConcurrency: number;
  statDate: string;
  tenantId: string;
  visitCount: number;
}

export interface DailyAccessTop20Query {
  accessSide: AccessSide;
  dimensionType: AccessDimensionType;
  statDate: string;
}

export interface DailyAccessOverviewQuery {
  accessSide: AccessSide;
  statDate: string;
}

export interface SlowUrlStat {
  averageMillis: number;
  maxMillis: number;
  requestPath: string;
  visitCount: number;
}

export interface HostResourceStat {
  averageCpuPercent: null | number;
  averageDiskPercent: null | number;
  averageJvmHeapPercent: null | number;
  averageMemoryPercent: null | number;
  averagePoolActive: null | number;
  averagePoolPending: null | number;
  database: DatabaseHealthStat | null;
  diskFreeBytes: null | number;
  diskTotalBytes: null | number;
  executors: ExecutorStat[] | null;
  fullGcCountToday: null | number;
  fullGcTimeMillisToday: null | number;
  gcCountToday: null | number;
  gcTimeMillisToday: null | number;
  heapMaxBytes: null | number;
  heapUsedBytes: null | number;
  jvmPeakThreadCount: null | number;
  jvmThreadCount: null | number;
  nodeId: string;
  peakJvmHeapPercent: null | number;
  peakPoolActive: null | number;
  peakPoolPending: null | number;
  poolActive: null | number;
  poolIdle: null | number;
  poolMax: null | number;
  poolPending: null | number;
  processCpuPercent: null | number;
  processUptimeMillis: null | number;
}

export interface ExecutorStat {
  active: null | number;
  maxSize: null | number;
  name: string;
  poolSize: null | number;
  queueSize: null | number;
}

export interface DatabaseHealthStat {
  blksHitToday: null | number;
  blksReadToday: null | number;
  cacheHitPercent: null | number;
  deadlocksToday: null | number;
  numBackends: null | number;
  tempBytesToday: null | number;
  xactCommitToday: null | number;
  xactRollbackToday: null | number;
}

export interface DailyAccessOverview {
  collectionIncomplete: boolean;
  hosts: HostResourceStat[];
  peakConcurrency: number;
  slowUrls: SlowUrlStat[];
  totalVisitCount: number;
}

// 对应后端只读统计控制器；页面不提供统计行的增删改接口。
@Service({
  basePath: '/DailyAccessStat',
  controllerClass:
    'com.levin.oak.base.controller.BizDailyAccessMonitorController',
  description: '按租户、入口和日期查询访问量与并发峰值',
  title: '性能监控',
  type: '系统数据-每日访问统计',
})
export class DailyAccessStatService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ label: '查看访问监控概览' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-每日访问统计',
    action: '查询排行榜',
  })
  async overview(
    params: DailyAccessOverviewQuery,
  ): Promise<DailyAccessOverview> {
    return this.get('overview', { params });
  }

  @CRUD.Op({ label: '查询访问排行榜' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-每日访问统计',
    action: '查询排行榜',
  })
  async top20(params: DailyAccessTop20Query): Promise<DailyAccessStat[]> {
    return this.get('top20', { params });
  }
}

export const dailyAccessStatService = new DailyAccessStatService();
