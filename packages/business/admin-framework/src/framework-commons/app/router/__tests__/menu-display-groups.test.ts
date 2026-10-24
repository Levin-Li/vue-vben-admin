import type { MenuRecordRaw, RouteRecordRaw } from '@vben/runtime/types';

import type { AdminBackendRouteMapping } from '../../../module-contract';

import { describe, expect, it } from 'vitest';

import { groupAccessibleMenus } from '../menu-display-groups';

const group = {
  parentPath: '/base',
  path: '/base/workflow',
  title: '工作流',
  icon: 'lucide:workflow',
};
const leaf = (path: string, extra = {}): MenuRecordRaw => ({
  name: path,
  path,
  ...extra,
});
const mapping = (path: string): AdminBackendRouteMapping => ({
  path,
  menuGroup: group,
  description: '',
  icon: '',
  resource: path,
  sourceFilePath: '',
  title: path,
  viewPath: path,
});
const route = (path: string, meta = {}): RouteRecordRaw => ({
  path,
  component: {},
  meta: { title: path, ...meta },
});
const base = (children: MenuRecordRaw[]): MenuRecordRaw => ({
  name: '基础框架',
  path: '/base',
  children,
});

function grouped(
  menus: MenuRecordRaw[],
  paths: string[],
  routes = paths.map((path) => route(path)),
) {
  return groupAccessibleMenus(
    menus,
    paths.map((path) => mapping(path)),
    routes,
  );
}

describe('authorized menu display groups', () => {
  it('moves six existing leaves across groups, preserves their original order and removes emptied directories', () => {
    const paths = [
      '/definition',
      '/instance',
      '/notification',
      '/mine',
      '/sample',
      '/route',
    ];
    const input = [
      base([
        {
          name: '开发',
          path: '/dev',
          children: paths.slice(0, 3).map((path) => leaf(path)),
        },
        {
          name: '个人',
          path: '/personal',
          children: paths.slice(3).map((path) => leaf(path)),
        },
      ]),
    ];
    const output = grouped(input, paths.toReversed());
    expect(output[0]?.children).toHaveLength(1);
    const target = output[0]?.children?.[0];
    expect(target).toMatchObject({
      name: '工作流',
      path: group.path,
      icon: group.icon,
      parent: '/base',
    });
    expect(target?.children?.map((item) => item.path)).toEqual(paths);
    expect(target?.children?.every((item) => item.parent === group.path)).toBe(
      true,
    );
    expect(input[0]?.children).toHaveLength(2);
  });

  it('does not synthesize unauthorized, forbidden, hidden or disabled pages or groups', () => {
    const paths = [
      '/missing',
      '/forbidden',
      '/hidden',
      '/disabled',
      '/ancestor-hidden',
    ];
    const input = [
      base([
        leaf('/forbidden'),
        leaf('/hidden', { show: false }),
        leaf('/disabled', { disabled: true }),
        {
          name: 'hidden',
          path: '/hidden-parent',
          show: false,
          children: [leaf('/ancestor-hidden')],
        },
      ]),
    ];
    const output = grouped(input, paths, [
      route('/forbidden', { menuRouteForbidden: true }),
      ...paths.slice(2).map((path) => route(path)),
    ]);
    expect(output).toEqual(input);
  });

  it('does not widen permission when duplicate URLs include a forbidden route', () => {
    const input = [base([leaf('/same')])];
    expect(
      grouped(
        input,
        ['/same'],
        [route('/same'), route('/same', { menuVisibleWithForbidden: true })],
      ),
    ).toEqual(input);
  });

  it('preserves page parents and exact paths, query payloads, badges and custom metadata without mutating input', () => {
    const item = leaf('/move', {
      query: { orgId: '7' },
      meta: { fixedQuery: { ownerId: 'me' } },
      badge: '2',
      order: 3,
    });
    const input = [
      base([
        {
          name: 'page',
          path: '/page',
          children: [item],
        },
        leaf('/move?orgId=8'),
      ]),
    ];
    const before = JSON.stringify(input);
    const output = grouped(input, ['/move'], [route('/page'), route('/move')]);
    expect(JSON.stringify(input)).toBe(before);
    expect(output[0]?.children?.map((menu) => menu.path)).toEqual([
      '/page',
      '/move?orgId=8',
      group.path,
    ]);
    expect(output[0]?.children?.[2]?.children?.[0]).toMatchObject(item);
  });

  it('deduplicates existing group leaves and stays stable when applied twice', () => {
    const input = [
      base([
        { name: '工作流', path: group.path, children: [leaf('/move')] },
        leaf('/move'),
      ]),
    ];
    const first = grouped(input, ['/move']);
    expect(first[0]?.children?.[0]?.children).toHaveLength(1);
    expect(grouped(first, ['/move'])).toEqual(first);
  });

  it('does not create a parent or put pages into an unavailable parent', () => {
    const item = leaf('/move');
    expect(grouped([item], ['/move'])).toEqual([item]);
    const input = [{ ...base([item]), disabled: true }];
    expect(grouped(input, ['/move'])).toEqual(input);
  });
});
