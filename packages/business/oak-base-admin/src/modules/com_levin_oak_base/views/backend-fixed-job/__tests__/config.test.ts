import { describe, expect, it, vi } from 'vitest';

import {
  backendFixedJobPageCrudConfig,
  pageMeta,
  transformBackendFixedJobSubmit,
} from '../config';

vi.mock('../../../api/backend-fixed-job-service', () => ({
  backendFixedJobService: {},
}));
vi.mock('../../api-module', () => ({
  DEFAULT_CRUD_MODAL_WIDTH: '80%',
}));

describe('后端固定定时任务管理页面', () => {
  it('只开放查看和单条编辑，默认一页可容纳七个注册任务', () => {
    expect(pageMeta.name).toBe('BackendFixedJob');
    expect(backendFixedJobPageCrudConfig).toMatchObject({
      apiBase: '/BackendFixedJob',
      allowCreate: false,
      allowDelete: false,
      allowEdit: true,
      allowRetrieve: true,
      defaultQuery: { pageIndex: 1, pageSize: 10 },
    });
    expect(backendFixedJobPageCrudConfig.rowActions ?? []).toEqual([]);
  });

  it('类名和编辑器只读，可写字段与控制器白名单一致', () => {
    const fields = backendFixedJobPageCrudConfig.fields;
    expect(fields.find((field) => field.key === 'id')).toMatchObject({
      disabledOnEdit: true,
    });
    expect(
      fields.find((field) => field.key === 'configDataEditor'),
    ).toMatchObject({
      disabledOnEdit: true,
      omitOnEdit: true,
    });
    expect(
      fields
        .filter((field) => field.form !== false && !field.disabledOnEdit)
        .map((field) => field.key),
    ).toEqual(['name', 'enable', 'remark', 'configData']);
    expect(fields.find((field) => field.key === 'configData')).toMatchObject({
      type: 'json',
      jsonSchemaEditor: true,
      jsonSchema: ':configDataEditor',
      fullRow: true,
      required: true,
    });
  });

  it('更新保留读取时的主键和版本，过滤只读字段并保留关闭状态', () => {
    const record = { id: 'example.Job', optimisticLock: 0 };
    const values = {
      id: 'other.Job',
      optimisticLock: 999,
      name: '访问日志审计',
      remark: '',
      enable: false,
      configData: { batchSize: 100 },
      configDataEditor: 'class:other.Config',
      domainId: 'other',
      editable: true,
      orderCode: 999,
      forceUpdateFields: ['configDataEditor'],
    };
    expect(transformBackendFixedJobSubmit(values, record)).toEqual({
      ...record,
      name: values.name,
      remark: '',
      enable: false,
      configData: { batchSize: 100 },
      forceUpdateFields: ['remark'],
    });
    expect(values.optimisticLock).toBe(999);
  });

  it('局部提交不补回未提交字段，并允许明确清空描述', () => {
    expect(
      transformBackendFixedJobSubmit(
        { remark: null },
        { id: 'example.Job', optimisticLock: 3, name: '已有任务' },
      ),
    ).toEqual({
      id: 'example.Job',
      optimisticLock: 3,
      remark: null,
      forceUpdateFields: ['remark'],
    });
  });

  it('未读取版本时阻止更新，避免伪造版本零覆盖并发修改', () => {
    expect(() => transformBackendFixedJobSubmit({}, null)).toThrow('请刷新');
    expect(() =>
      transformBackendFixedJobSubmit({}, { id: 'example.Job' }),
    ).toThrow('请刷新');
  });
});
