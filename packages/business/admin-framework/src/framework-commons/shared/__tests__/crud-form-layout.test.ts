import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  estimateFormVisualRows,
  getContainerColumnCount,
  getFormFieldColumnSpan,
  getFormFieldVisualAffinityKey,
  resolveFormColumnCount,
  resolveSearchCollapsedCount,
  sortFormLayoutFields,
} from '../crud-form-layout';
import type { CrudFieldConfig } from '../types';

describe('crud form layout', () => {
  const textField = (key: string): CrudFieldConfig => ({
    key,
    label: key,
    type: 'text',
  });

  it('lets explicit positive span override tag field defaults', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/shared/crud-page.vue',
      'utf8',
    );
    const spanClassBlock = source.slice(
      source.indexOf("'md:col-span-2'"),
      source.indexOf("'max-w-[480px]'"),
    );

    expect(source).toContain('style.gridColumn');
    expect(source).toContain(
      "'vben-crud-form-item-new-row': field.layoutNewRow",
    );
    expect(source).toContain('grid-column-start: 1 !important');
    expect(spanClassBlock).toContain('shouldFormItemSpanTwoColumns(field)');
    expect(spanClassBlock).not.toContain("field.type !== 'tags'");
    expect(spanClassBlock).not.toContain("field.type !== 'string-array'");
    expect(spanClassBlock).not.toContain("field.type !== 'textarea'");

    expect(
      getFormFieldColumnSpan(
        { key: 'tags', label: '标签', span: 2, type: 'tags' },
        4,
      ),
    ).toBe(2);
    expect(
      getFormFieldColumnSpan({ key: 'tags', label: '标签', type: 'tags' }, 4),
    ).toBe(4);
  });

  it('keeps json fields compact by default while honoring explicit span config', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/shared/crud-page.vue',
      'utf8',
    );

    expect(source).toContain(
      "'col-span-full': shouldFormItemSpanFullRow(field)",
    );
    expect(source).toContain(
      "'md:col-span-2': shouldFormItemSpanTwoColumns(field)",
    );
    expect(source).toContain(
      "'max-w-[480px]': shouldConstrainFormItemWidth(field)",
    );

    const defaultJsonField: CrudFieldConfig = {
      key: 'exInfo',
      label: '扩展信息',
      type: 'json',
    };
    const explicitWideJsonField: CrudFieldConfig = {
      fullRow: true,
      key: 'exInfo',
      label: '扩展信息',
      span: -1,
      type: 'json',
    };

    expect(getFormFieldColumnSpan(defaultJsonField, 4)).toBe(1);
    expect(getFormFieldColumnSpan(explicitWideJsonField, 4)).toBe(4);
    expect(getFormFieldVisualAffinityKey(defaultJsonField)).toBe(
      getFormFieldVisualAffinityKey({
        key: 'name',
        label: '名称',
        type: 'text',
      }),
    );
  });

  it('allows four form columns on desktop-width modals', () => {
    expect(
      resolveFormColumnCount({
        fields: Array.from({ length: 24 }, (_, index) =>
          textField(`field${index}`),
        ),
        modalAvailableWidth: 1280,
        viewportHeight: 900,
        viewportWidth: 1440,
      }),
    ).toBe(4);
  });

  it('allows pages to cap create and edit form columns explicitly', () => {
    expect(
      resolveFormColumnCount({
        configuredMaxColumns: 3,
        fields: Array.from({ length: 40 }, (_, index) =>
          textField(`field${index}`),
        ),
        modalAvailableWidth: 1280,
        viewportHeight: 900,
        viewportWidth: 2560,
      }),
    ).toBe(3);
  });

  it('keeps compact create and edit forms at three visual rows where possible', () => {
    expect(
      resolveFormColumnCount({
        fields: Array.from({ length: 8 }, (_, index) =>
          textField(`field${index}`),
        ),
        modalAvailableWidth: 960,
        viewportHeight: 900,
        viewportWidth: 1440,
      }),
    ).toBe(2);
    expect(
      estimateFormVisualRows(
        Array.from({ length: 8 }, (_, index) => textField(`field${index}`)),
        2,
      ),
    ).toBe(4);
  });

  it('calculates query columns from the search panel width', () => {
    expect(getContainerColumnCount(279)).toBe(1);
    expect(getContainerColumnCount(280)).toBe(1);
    expect(getContainerColumnCount(576)).toBe(2);
    expect(getContainerColumnCount(872)).toBe(3);
    expect(getContainerColumnCount(2400)).toBe(7);
  });

  it('fills collapsed query fields before the action column', () => {
    expect(resolveSearchCollapsedCount(12, 4, 3)).toBe(3);
    expect(resolveSearchCollapsedCount(12, 4, 4)).toBe(7);
    expect(resolveSearchCollapsedCount(12, 4, 5)).toBe(7);
    expect(resolveSearchCollapsedCount(12, 7, 3)).toBe(6);
  });

  it('shows all query fields when there are not enough fields to fill the action row', () => {
    expect(resolveSearchCollapsedCount(5, 4, 4)).toBe(5);
    expect(resolveSearchCollapsedCount(2, 4, 4)).toBe(2);
    expect(resolveSearchCollapsedCount(8, 1, 4)).toBe(4);
  });

  it('groups visually similar flexible fields inside the same form layout group', () => {
    const fields: CrudFieldConfig[] = [
      { key: 'name', label: '名称', layoutGroup: 'basic', type: 'text' },
      {
        key: 'enabled',
        label: '是否启用',
        layoutGroup: 'basic',
        type: 'switch',
      },
      { key: 'code', label: '编码', layoutGroup: 'basic', type: 'text' },
      {
        key: 'editable',
        label: '是否可编辑',
        layoutGroup: 'basic',
        type: 'switch',
      },
    ];

    expect(sortFormLayoutFields(fields).map((field) => field.key)).toEqual([
      'name',
      'code',
      'enabled',
      'editable',
    ]);
    expect(getFormFieldVisualAffinityKey(fields[0]!)).toBe(
      getFormFieldVisualAffinityKey(fields[2]!),
    );
  });

  it('keeps explicit layout controls as barriers while grouping flexible fields', () => {
    const fields: CrudFieldConfig[] = [
      { key: 'name', label: '名称', layoutGroup: 'basic', type: 'text' },
      {
        key: 'enabled',
        label: '是否启用',
        layoutGroup: 'basic',
        layoutNewRow: true,
        type: 'switch',
      },
      { key: 'code', label: '编码', layoutGroup: 'basic', type: 'text' },
      {
        key: 'editable',
        label: '是否可编辑',
        layoutGroup: 'basic',
        type: 'switch',
      },
      {
        key: 'ownerId',
        label: '所有者',
        layoutGroup: 'ownership',
        type: 'select',
      },
    ];

    expect(sortFormLayoutFields(fields).map((field) => field.key)).toEqual([
      'ownerId',
      'name',
      'enabled',
      'code',
      'editable',
    ]);
  });
});
