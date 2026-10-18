import type {
  DataAttrValuePermission,
  PermissionTreeNode,
} from '../data-permission-types';

import { request as httpRequest } from 'node:http';
import process from 'node:process';

import { enableAutoUnmount, mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  collectKnownPermissionTreeValues,
  splitMappedAndUnmappedPermissions,
} from '../data-permission-transform';
import DataAttrPermissions from '../resource-data-attr-permissions.vue';
import ResourcePermissionTreeEditor from '../resource-permission-tree-editor.vue';

// 只允许显式启动的本机随机端口夹具；环境缺失时明确跳过，由运行脚本拒绝跳过结果。
const baseUrl = process.env.RBAC_ENUM_HTTP_URL;
const suite = baseUrl ? describe : describe.skip;
enableAutoUnmount(afterEach);
interface Partner {
  id: string;
  kind: null | string;
  name: string;
  region: string;
  tenant: string;
}
interface Page {
  items: Partner[];
  total: number;
}
interface State {
  rowCount: number;
  rows: Partner[];
}
async function request<T>(
  path: string,
  method = 'GET',
  data?: unknown,
  actor = 'sales',
): Promise<T> {
  if (!baseUrl) throw new Error('必须由脚本启动真实枚举HTTP夹具');
  const url = new URL(`/enum-fixture${path}`, baseUrl);
  if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:') {
    throw new Error('网络契约测试只能访问本机隔离夹具');
  }

  // 使用Node原生HTTP执行真实网络调用，不拦截或替换后端权限与数据库行为。
  const body = data === undefined ? undefined : JSON.stringify(data);
  return new Promise<T>((resolve, reject) => {
    const outgoing = httpRequest(
      url,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Fixture-User': actor,
        },
        method,
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          text += chunk;
        });
        response.on('end', () => {
          try {
            if (response.statusCode !== 200) {
              throw new Error(`HTTP ${response.statusCode}: ${text}`);
            }
            resolve(JSON.parse(text) as T);
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    outgoing.on('error', reject);
    outgoing.setTimeout(15_000, () => {
      outgoing.destroy(new Error('真实HTTP请求超时'));
    });
    if (body !== undefined) outgoing.write(body);
    outgoing.end();
  });
}
function ids(page: Page) {
  return page.items.map((item) => item.id).toSorted();
}
async function row(id: string) {
  const state = await request<State>('/state');
  const found = state.rows.find((item) => item.id === id);
  expect(found, `隔离H2记录 ${id}`).toBeDefined();
  if (!found) throw new Error(`隔离数据库缺少记录 ${id}`);
  return found;
}

suite('枚举记录范围真实HTTP与数据库契约', () => {
  beforeEach(async () => {
    await request('/reset', 'POST', {});
  });

  it('真实元数据的六段许可可由授权树选择并原样保存，同时保留其它许可', async () => {
    const attributes = await request<DataAttrValuePermission[]>('/permissions');
    expect(attributes).toHaveLength(2);
    const expressions = attributes.flatMap((attribute) =>
      attribute.values.map((value) => value.permissionExpr),
    );
    expect(new Set(expressions).size).toBe(4);
    for (const expression of expressions) {
      expect(expression.split(':')).toHaveLength(6);
      expect(expression).toMatch(/:@value:[\da-f]{64}:/u);
    }
    const customer = attributes
      .find((attribute) => attribute.attribute === 'kind')
      ?.values.find((value) => value.name === 'Customer')?.permissionExpr;
    const east = attributes
      .find((attribute) => attribute.attribute === 'region')
      ?.values.find((value) => value.name === 'East')?.permissionExpr;
    if (!customer || !east) throw new Error('真实元数据缺少客户或华东许可');
    const operation = 'enum-fixture:业务数据:合作伙伴:查询';
    const other = 'unrelated:resource::read';
    const tree: PermissionTreeNode[] = [
      {
        id: 'enum-module',
        name: '隔离枚举测试',
        nodeType: 'Module',
        children: [
          {
            children: [
              {
                id: 'query',
                name: '查询',
                nodeType: 'Action',
                permissionExpr: operation,
              },
            ],
            dataAttrs: attributes,
            id: 'enum-partner',
            name: '合作伙伴',
            nodeType: 'Resource',
          },
        ],
      },
    ];

    // 挂真实授权树，具体许可直接来自后端，不根据标签或枚举名构造表达式。
    const wrapper = mount(ResourcePermissionTreeEditor, {
      props: { permissionTree: tree, value: [operation, other] },
    });
    const control = wrapper.getComponent(DataAttrPermissions);
    control.vm.$emit('toggle', [customer, east], true);
    const saved = wrapper.emitted('update:value')?.at(-1)?.[0] as string[];
    expect(saved).toEqual([operation, other, customer, east]);
    const known = collectKnownPermissionTreeValues(tree);
    for (const expression of expressions)
      expect(known.has(expression)).toBe(true);
    const mapping = splitMappedAndUnmappedPermissions(saved, [], tree);
    expect(mapping.unmapped).toEqual([other]);
    expect(new Set(mapping.mapped)).toEqual(
      new Set([customer, east, operation]),
    );
  });

  it('列表和COUNT同受角色分支约束，并与原有OR、租户和ID条件取交集', async () => {
    const page = await request<Page>('/partners');
    expect(page.total).toBe(2);
    expect(ids(page)).toEqual(['ce', 'ss']);
    const businessOr = await request<Page>('/partners?businessOr=true');
    expect(businessOr.total).toBe(1);
    expect(ids(businessOr)).toEqual(['ce']);
    const hiddenId = await request<Page>('/partners?id=cs');
    expect(hiddenId.total).toBe(0);
    expect(hiddenId.items).toEqual([]);
    const state = await request<State>('/state');
    expect(state.rowCount).toBe(6);
  });

  it('隐藏记录更新和删除均零影响，直接数据库状态保持原值', async () => {
    const before = await row('cs');
    expect(
      await request('/partners/update', 'POST', { id: 'cs', name: 'stolen' }),
    ).toEqual({ affected: 0 });
    expect(await row('cs')).toEqual(before);
    expect(await request('/partners/delete', 'POST', { id: 'cs' })).toEqual({
      affected: 0,
    });
    expect(await row('cs')).toEqual(before);
    const state = await request<State>('/state');
    expect(state.rowCount).toBe(6);
  });

  it('合法更新成功，新值交叉组合被拒，完整的另一授权组合可以保存', async () => {
    expect(
      await request('/partners/update', 'POST', { id: 'ce', name: 'saved' }),
    ).toEqual({ affected: 1 });
    const saved = await row('ce');
    expect(saved.name).toBe('saved');
    expect(
      await request('/partners/update', 'POST', { id: 'ce', kind: 'Supplier' }),
    ).toEqual({ affected: 0 });
    const unchanged = await row('ce');
    expect(unchanged.kind).toBe('Customer');
    expect(
      await request('/partners/update', 'POST', {
        id: 'ce',
        kind: 'Supplier',
        region: 'South',
      }),
    ).toEqual({ affected: 1 });
    expect(await row('ce')).toMatchObject({
      kind: 'Supplier',
      name: 'saved',
      region: 'South',
    });
  });

  it('撤权后下一请求无记录可读，无注解接口继续保持原行为', async () => {
    const before = await request<Page>('/partners');
    expect(before.total).toBe(2);
    await request('/revoke', 'POST', {});
    const revoked = await request<Page>('/partners');
    expect(revoked.total).toBe(0);
    expect(revoked.items).toEqual([]);
    const state = await request<State>('/state');
    expect(state.rowCount).toBe(6);
    expect(await request('/plain', 'GET', undefined, 'guest')).toEqual([
      { id: 'plain', name: 'unchanged' },
    ]);
  });
});
