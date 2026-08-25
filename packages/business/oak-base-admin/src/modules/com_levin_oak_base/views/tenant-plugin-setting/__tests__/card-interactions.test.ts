import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { buildTenantSettingCategories } from '../../setting-for-tenant/setting-for-tenant';

const pagePath =
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/tenant-plugin-setting/index.vue';

describe('租户插件设置卡片交互', () => {
  it('通过权限、开关和独立编辑入口管理配置', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain('const canCreate = computed');
    expect(source).toContain('const canDelete = computed');
    expect(source).toContain('@update:checked=');
    expect(source).toContain('updateEnable(');
    expect(source).toContain('deleteSetting(');
    expect(source).toContain("autoFocusButton: 'cancel'");
    expect(source).toContain("okText: '确认删除'");
    expect(source).toContain('openBasicEditor(');
    expect(source).toContain('openItemEditor(');
    expect(source).toContain('openItemPreview(');
    expect(source).toContain('await loadSettings();');
    expect(source).not.toContain('window.location.reload();');
    expect(source).not.toContain('formatSettingValueInlinePreview');
  });

  it('将新增和刷新操作放在页面标题前方', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source.indexOf('新增配置')).toBeLessThan(
      source.indexOf('租户插件设置({{ settings.length }})'),
    );
    expect(source.indexOf('aria-label="刷新"')).toBeLessThan(
      source.indexOf('租户插件设置({{ settings.length }})'),
    );
  });

  it('保留分组页签，并通过独立查看按钮打开当前单条配置的只读弹窗', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain('v-for="group in category.groups"');
    expect(source).toContain('group.name');
    expect(source).toContain('v-for="item in group.settings"');
    expect(source).toContain('normalizeText(plugin.groupName)');
    expect(source).toContain('loadServicePlugin: true');
    expect(source).toContain('pageSize: 2000');
    expect(source).toContain('{ includeDisabled: true }');
    expect(source).toContain('icon="lucide:eye"');
    expect(source).toContain('查看');
    expect(source).toContain('editValueReadonly.value = true');
    expect(source).toContain(':disabled="editValueReadonly"');
    expect(source).toContain(':footer="editValueReadonly ? null : undefined"');
    expect(source).not.toContain('scheduleSettingPreview');
    expect(source).not.toContain('Popover');
    expect(source).toContain('供应商编码：{{ item.code }}');
    expect(source).toContain('匹配域名：{{');
  });

  it('在租户插件设置中保留禁用的配置记录', () => {
    const categories = buildTenantSettingCategories(
      [
        { categoryName: '短信发送', groupName: '默认', id: 'enabled' },
        {
          categoryName: '短信发送',
          enable: false,
          groupName: '默认',
          id: 'disabled',
        },
      ],
      { includeDisabled: true },
    );

    expect(categories[0]?.groups[0]?.settings.map((item) => item.id)).toEqual([
      'disabled',
      'enabled',
    ]);
  });

  it('允许禁用供应商先录入配置，但禁用插件仍不可编辑配置', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain('editable: plugin.enable !== false');
    expect(source).not.toContain('editable: plugin.enable !== false && !provider.disabled');
  });

  it('在新增配置的插件选项中同时展示名称和插件类型名称', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain('function getPluginOptionLabel');
    expect(source).toContain('`${name}（${pluginTypeName}）`');
    expect(source).toContain('label: getPluginOptionLabel(plugin)');
  });

  it('在新增配置中排除禁用供应商，并提示先启用供应商', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain('.filter((provider) => provider.code && !provider.disabled)');
    expect(source).toContain('const basicProviderPlaceholder = computed');
    expect(source).toContain('暂无可选供应商，请先在服务插件管理中启用');
    expect(source).toContain(':placeholder="basicProviderPlaceholder"');
  });

  it('保留定制页面与路由内容区之间的外层留白', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain(
      'content-class="!bg-card !m-4 !p-4 min-w-0 !overflow-hidden rounded-lg"',
    );
  });
});
