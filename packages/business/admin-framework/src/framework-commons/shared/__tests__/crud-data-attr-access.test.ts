import type { CrudPageConfig } from '../types';

import { describe, expect, it, vi } from 'vitest';

import { CRUD, ResAuthorize } from '../../api-authorize';
import {
  resolveCrudDataAttrOperationExpression,
  resolveCrudDataAttrPath,
  resolveCrudDataAttrTarget,
} from '../crud-data-attr-access';

function config(overrides: Partial<CrudPageConfig> = {}): CrudPageConfig {
  return {
    apiBase: '/Contract',
    apiModuleBase: '/api/V1',
    title: '合同',
    fields: [],
    ...overrides,
  };
}
describe('crud 的实际接口策略定位', () => {
  it('显式通用路径使用实际方法与模块路径，动态createPath不提前猜目标', () => {
    expect(
      resolveCrudDataAttrTarget(config(), 'update', '/Contract/list'),
    ).toEqual({ method: 'PUT', path: '/api/V1/Contract/update' });
    expect(
      resolveCrudDataAttrTarget(
        config({ createPath: () => '/Special/submit' }),
        'create',
        '/Contract/list',
      ),
    ).toBeUndefined();
    expect(
      resolveCrudDataAttrTarget(
        config({ listPath: '/Special/query' }),
        'list',
        '/Special/query',
      ),
    ).toEqual({ method: 'GET', path: '/api/V1/Special/query' });
  });
  it('服务别名不从方法名构建路径；多处理器可用显式target', () => {
    const apiService = { create: vi.fn() };
    expect(
      resolveCrudDataAttrTarget(
        config({ apiService }),
        'create',
        '/Contract/list',
      ),
    ).toBeUndefined();
    expect(
      resolveCrudDataAttrTarget(
        config({
          apiService,
          dataAttrTargets: {
            create: { method: 'PATCH', path: '/actual/submit' },
          },
        }),
        'create',
        '/Contract/list',
      ),
    ).toEqual({ method: 'PATCH', path: '/actual/submit' });
  });
  it('标准列表服务由公共CRUD定位真实模块接口', () => {
    const list = vi.fn();
    const apiService = {
      list,
      buildRequestPath: (path: string) =>
        `/com.levin.oak.base/V1/api/Contract/${path}`,
    };
    CRUD.ListTable()(apiService, 'list', { value: list });

    expect(
      resolveCrudDataAttrTarget(
        config({ apiService }),
        'list',
        '/Contract/list',
      ),
    ).toEqual({
      method: 'GET',
      path: '/com.levin.oak.base/V1/api/Contract/list',
    });
    expect(
      resolveCrudDataAttrTarget(
        config({ apiService, listPath: '/Contract/exList' }),
        'list',
        '/Contract/exList',
      ),
    ).toEqual({ method: 'GET', path: '/api/V1/Contract/exList' });
    expect(
      resolveCrudDataAttrTarget(
        config({ apiService: { ...apiService, list: vi.fn() } }),
        'list',
        '/Contract/list',
      ),
    ).toBeUndefined();
  });
  it('仅登录豁免不丢失操作身份，ignored声明不误造操作', () => {
    const create = vi.fn();
    const apiService = { create };
    ResAuthorize({
      domain: 'contract',
      type: '合同',
      action: '提交',
      onlyRequireAuthenticated: true,
    })(apiService, 'create', { value: create });
    expect(
      resolveCrudDataAttrOperationExpression(config({ apiService }), 'create'),
    ).toBe('contract:合同::提交');
    ResAuthorize({
      domain: 'contract',
      type: '合同',
      action: '提交',
      ignored: true,
    })(apiService, 'create', { value: create });
    expect(
      resolveCrudDataAttrOperationExpression(config({ apiService }), 'create'),
    ).toBeUndefined();
  });
  it('复杂展示别名还原为实际输入输出路径', () => {
    const options = config({
      complexGroups: [
        {
          key: 'finance',
          submitKey: 'detail.finance',
          title: '财务信息',
          fieldMappings: { flatAmount: 'amount' },
        },
      ],
    });
    expect(
      resolveCrudDataAttrPath(
        { key: 'flatAmount', label: '金额', complexGroupKey: 'finance' },
        options,
      ),
    ).toBe('detail.finance.amount');
    expect(
      resolveCrudDataAttrPath({ key: 'name', label: '名称' }, options),
    ).toBe('name');
  });
});
