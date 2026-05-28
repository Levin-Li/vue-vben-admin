import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  estimateFormVisualRows,
  getContainerColumnCount,
  getFormFieldColumnSpan,
  getFormGridContentMaxWidth,
  getFormModalRecommendedMaxWidth,
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

  it('uses only static layout config for field spans', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/shared/crud-page.vue',
      'utf8',
    );
    const spanClassBlock = source.slice(
      source.indexOf("'md:col-span-2'"),
      source.indexOf(':style="getFormItemStyle(field)"'),
    );

    expect(source).toContain('style.gridColumn');
    expect(source).toContain(
      "'vben-crud-form-item-new-row': field.layoutNewRow",
    );
    expect(source).toContain('grid-column-start: 1 !important');
    expect(spanClassBlock).toContain('shouldFormItemSpanTwoColumns(field)');
    expect(spanClassBlock).not.toContain('field.type');

    expect(
      getFormFieldColumnSpan(
        { key: 'tags', label: '标签', span: 2, type: 'tags' },
        4,
      ),
    ).toBe(2);
    expect(
      getFormFieldColumnSpan({ key: 'tags', label: '标签', type: 'tags' }, 4),
    ).toBe(1);
    expect(
      getFormFieldColumnSpan(
        { key: 'tags', label: '标签', fullRow: true, type: 'tags' },
        4,
      ),
    ).toBe(4);
  });

  it('keeps fields one column by default while honoring explicit json layout config', () => {
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
    expect(source).not.toContain('shouldConstrainFormItemWidth');
    expect(source).toContain(
      "maxWidth: `${getFormGridContentMaxWidth(formColumnCount.value)}px`",
    );
    expect(source).not.toContain('justify-self-center');
    expect(source).toContain('class="w-full"');
    expect(source).toContain(
      'return `min(80vw, ${resolvedModalMaxWidthPx.value}px)`',
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
    const fullRowJsonField: CrudFieldConfig = {
      fullRow: true,
      key: 'config',
      label: '配置',
      type: 'json',
    };
    const fullRowWithSpanJsonField: CrudFieldConfig = {
      fullRow: true,
      key: 'config',
      label: '配置',
      span: 2,
      type: 'json',
    };

    expect(getFormFieldColumnSpan(defaultJsonField, 4)).toBe(1);
    expect(getFormFieldColumnSpan(explicitWideJsonField, 4)).toBe(4);
    expect(getFormFieldColumnSpan(fullRowJsonField, 4)).toBe(4);
    expect(getFormFieldColumnSpan(fullRowWithSpanJsonField, 4)).toBe(4);
    expect(getFormFieldColumnSpan(textField('name'), 4)).toBe(1);
  });

  it('uses the current content-form modal width cap and full-width controls', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/shared/crud-page.vue',
      'utf8',
    );

    expect(source).toContain(
      "const DEFAULT_CRUD_MODAL_WIDTH = 'min(80vw, 1280px)'",
    );
    expect(source).toContain('viewportWidth.value * 0.8');
    expect(source).toContain('DEFAULT_CONTENT_MODAL_MAX_HEIGHT');
    expect(source).toContain('DEFAULT_CONTENT_MODAL_BODY_STYLE');
    expect(source).toContain(':body-style="modalBodyStyle"');
    expect(source).toContain(':mask-closable="false"');
    expect(source).not.toContain('min(70vw');
    expect(source).not.toContain('max-w-[480px]');
    expect(source).not.toContain('justify-self-center');
    expect(source).toContain('<Input.TextArea');
    expect(source).toContain('class="w-full"');
  });

  it('uses one shared content grid boundary for compact and full-row fields', () => {
    expect(getFormGridContentMaxWidth(1)).toBe(480);
    expect(getFormGridContentMaxWidth(2)).toBe(976);
    expect(getFormGridContentMaxWidth(3)).toBe(1472);
  });

  it('keeps modal width recommendations monotonic by form column count', () => {
    expect(getFormModalRecommendedMaxWidth(1)).toBe(560);
    expect(getFormModalRecommendedMaxWidth(2)).toBe(960);
    expect(getFormModalRecommendedMaxWidth(3)).toBe(1120);
    expect(getFormModalRecommendedMaxWidth(4)).toBe(1280);
    expect(getFormModalRecommendedMaxWidth(5)).toBe(1480);
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

  it('falls back through the recommended width tiers when the modal is too narrow', () => {
    expect(
      resolveFormColumnCount({
        fields: Array.from({ length: 24 }, (_, index) =>
          textField(`field${index}`),
        ),
        modalAvailableWidth: 1008,
        viewportHeight: 900,
        viewportWidth: 1440,
      }),
    ).toBe(2);
    expect(
      resolveFormColumnCount({
        fields: Array.from({ length: 24 }, (_, index) =>
          textField(`field${index}`),
        ),
        modalAvailableWidth: 1120,
        viewportHeight: 900,
        viewportWidth: 1440,
      }),
    ).toBe(3);
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

  it('keeps source order unless static layout group or order config says otherwise', () => {
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
      'enabled',
      'code',
      'editable',
    ]);
  });

  it('uses only static layout group and order config when sorting fields', () => {
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
        layoutOrder: 0.5,
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
      'editable',
      'enabled',
      'code',
    ]);
  });
});
