import type { ReportSourceCatalog } from '../../../api/report-definition-management-service';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import { message, Modal } from 'ant-design-vue';

import { describe, expect, it, vi } from 'vitest';

import { addComponent, addDataset, addParameter, newReportDesign, validateReportDesign } from '../report-design';
import ReportDesignEditor from '../report-design-editor.vue';

const catalog: ReportSourceCatalog = {
  sources: [
    {
      id: 'users',
      title: '用户',
      fields: [{ id: 'name', title: '姓名', type: 'STRING' }],
    },
  ],
  relations: [],
};

// 保留按钮交互，其他控件只验证设计器状态变化。
const button = {
  props: ['disabled'],
  emits: ['click'],
  template:
    '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
};
const stubs = {
  AAlert: { props: ['message'], template: '<div>{{ message }}</div>' },
  AButton: button,
  AInput: { inheritAttrs: false, template: '<input />' },
  AInputNumber: { props: ['value'], emits: ['change'], template: '<input type="number" :value="value" @change="$emit(\'change\', Number($event.target.value))" />' },
  ASelect: {
    props: ['value', 'options', 'filterOption'],
    emits: ['change', 'update:value'],
    template:
      '<select :value="value" @change="$emit(\'change\', $event.target.value)"><option v-for="item in options" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
  },
  ASwitch: { inheritAttrs: false, template: '<span />' },
  ATag: { template: '<span><slot /></span>' },
  APopconfirm: { template: '<span><slot /></span>' },
};

describe('报表可视化设计器', () => {
  it('数据集独立切换编辑步骤并在重用标识时恢复全部配置', async () => {
    const design = reactive(newReportDesign('分步'));
    const first = addDataset(design, 'users');
    const second = addDataset(design, 'users');
    first.fields.push({ source: 'users', name: 'name', aggregation: 'COUNT' });
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog }, global: { stubs } });
    const firstPanel = () => wrapper.get(`[data-report-dataset="${first.id}"]`);
    const secondPanel = () => wrapper.get(`[data-report-dataset="${second.id}"]`);
    await wrapper.get('button[aria-label="数据集 1 1 关联来源"]').trigger('click');
    expect(wrapper.get('button[aria-label="数据集 1 1 关联来源"]').attributes('aria-pressed')).toBe('true');
    expect(firstPanel().get('[data-report-step="relations"]').isVisible()).toBe(true);
    expect(firstPanel().get('[data-report-step="fields"]').attributes('style')).toContain('display: none');
    expect(firstPanel().get('[data-report-step="filters"]').attributes('style')).toContain('display: none');
    expect(secondPanel().get('[data-report-step="fields"]').isVisible()).toBe(true);
    expect(firstPanel().find('[data-dataset-preview]').exists()).toBe(true);
    await wrapper.get('button[aria-label="数据集 1 2 字段与统计"]').trigger('click');
    expect(firstPanel().get('[data-report-step="fields"]').isVisible()).toBe(true);
    expect(first.fields[0]?.aggregation).toBe('COUNT');
    const confirm = firstPanel().findAllComponents(stubs.APopconfirm).find((item: VueWrapper) => item.attributes('title') === '移除数据集及其所有组件？')!;
    confirm.vm.$emit('confirm');
    addDataset(design, 'users');
    await flushPromises();
    expect(firstPanel().get('[data-report-step="relations"]').isVisible()).toBe(true);
    expect(firstPanel().get('[data-report-step="fields"]').isVisible()).toBe(true);
    expect(firstPanel().get('[data-report-step="filters"]').isVisible()).toBe(true);
    wrapper.unmount();
  });

  it('浏览器拦截预览窗口时提示用户', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const warning = vi.spyOn(message, 'warning').mockImplementation(() => undefined as any);
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: reactive(newReportDesign('预览')), catalog }, global: { stubs } });
    await wrapper.findAll('button').find((item) => item.text() === '预览')!.trigger('click');
    expect(warning).toHaveBeenCalledWith('预览窗口被浏览器拦截，请允许弹出窗口后重试');
    wrapper.unmount(); open.mockRestore(); warning.mockRestore();
  });
  it('可在设计器复制数据集及组件，并即时显示副本', async () => {
    const design = reactive(newReportDesign('复制'));
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'NONE' });
    const component = addComponent(design, dataset.id);
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog }, global: { stubs } });
    await wrapper.get('button[aria-label="复制数据集 1"]').trigger('click');
    await wrapper.get('button[aria-label="复制报表 1"]').trigger('click');
    expect(design.datasets).toHaveLength(2);
    expect(design.components).toHaveLength(2);
    expect(design.components[1]?.dataset).toBe(dataset.id);
    expect(wrapper.text()).toContain(`${component.title}（副本）`);
    wrapper.unmount();
  });

  it('仅在允许时提供数据集已保存数据预览入口', async () => {
    const design = reactive(newReportDesign('数据集预览'));
    const dataset = addDataset(design, 'users');
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog, allowSavedDataPreview: true }, global: { stubs } });
    await wrapper.get('button[aria-label="预览数据集 1 的已保存数据"]').trigger('click');
    expect(wrapper.emitted('preview-saved-dataset')?.[0]).toEqual([dataset.id]);
    await wrapper.setProps({ allowSavedDataPreview: false });
    expect(wrapper.find('button[aria-label="预览数据集 1 的已保存数据"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('自定义字段名称立即显示在预览，切换字段时清除旧名称', async () => {
    const design = reactive(newReportDesign('字段名称'));
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'NONE' });
    const component = addComponent(design, dataset.id);
    const choices: ReportSourceCatalog = { relations: [], sources: [{ id: 'users', title: '用户', fields: [
      { id: 'name', title: '姓名', type: 'STRING' }, { id: 'id', title: '标识', type: 'STRING' },
    ] }] };
    const input = { props: ['value'], emits: ['update:value'],
      template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />' };
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog: choices },
      global: { stubs: { ...stubs, AInput: input } } });
    await wrapper.get('input[aria-label="字段显示名称"]').setValue('客户名称');
    expect(wrapper.get(`[data-report-component="${component.id}"] th`).text()).toBe('客户名称');
    await wrapper.get('input[aria-label="字段显示名称"]').setValue('<img src=x onerror=alert(1)>');
    const header = wrapper.get(`[data-report-component="${component.id}"] th`);
    expect(header.text()).toBe('<img src=x onerror=alert(1)>');
    expect(header.find('img').exists()).toBe(false);
    dataset.fields[0]!.title = '非法\n名称';
    expect(validateReportDesign(design, choices)).toContain(`数据集 ${dataset.id} 的字段显示名称无效`);
    await wrapper.get(`[data-report-dataset="${dataset.id}"] select[aria-label="展示字段"]`).setValue('users:id');
    expect(dataset.fields[0]?.title).toBeUndefined();
    expect(wrapper.get(`[data-report-component="${component.id}"] th`).text()).toBe('标识');
    wrapper.unmount();
  });

  it('移除关联时只删除依赖分支并保留独立分支及绑定', async () => {
    const design = reactive(newReportDesign('关联分支'));
    const dataset = addDataset(design, 'org');
    dataset.relations = ['orgUsers', 'orgInvoices', 'userTeam'];
    dataset.fields = [
      { source: 'org', name: 'name', aggregation: 'NONE' },
      { source: 'users', name: 'name', aggregation: 'NONE' },
      { source: 'invoices', name: 'name', aggregation: 'NONE' },
      { source: 'team', name: 'name', aggregation: 'NONE' },
    ];
    dataset.filters = [
      { source: 'users', name: 'name', operator: 'EQ', parameter: 'userFilter' },
      { source: 'invoices', name: 'name', operator: 'EQ', parameter: 'invoiceFilter' },
    ];
    const component = addComponent(design, dataset.id);
    component.bindings = { userFilter: 'user', invoiceFilter: 'invoice' };
    const branchCatalog: ReportSourceCatalog = {
      sources: ['org', 'users', 'invoices', 'team'].map((id) => ({ id, title: id,
        fields: [{ id: 'name', title: `${id}名称`, type: 'STRING' as const }] })),
      relations: [
        { id: 'orgUsers', leftSource: 'org', rightSource: 'users', leftField: 'name', rightField: 'name', multipliesLeft: false },
        { id: 'orgInvoices', leftSource: 'org', rightSource: 'invoices', leftField: 'name', rightField: 'name', multipliesLeft: false },
        { id: 'userTeam', leftSource: 'users', rightSource: 'team', leftField: 'name', rightField: 'name', multipliesLeft: false },
      ],
    };
    const confirm = vi.spyOn(Modal, 'confirm').mockImplementation((options) => {
      options.onOk?.({} as never);
      return { destroy: vi.fn(), update: vi.fn() } as never;
    });
    const tag = { emits: ['close'], template: '<button @click="$emit(\'close\', $event)"><slot /></button>' };
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog: branchCatalog },
      global: { stubs: { ...stubs, ATag: tag } } });
    await wrapper.get('[data-relation-id="orgUsers"]').trigger('click');
    expect(dataset.relations).toEqual(['orgInvoices']);
    expect(dataset.fields.map((field) => field.source)).toEqual(['org', 'invoices']);
    expect(dataset.filters.map((filter) => filter.parameter)).toEqual(['invoiceFilter']);
    expect(component.bindings).toEqual({ invoiceFilter: 'invoice' });
    confirm.mockRestore();
    wrapper.unmount();
  });

  it('移动字段时保留统计与排序配置并更新预览列顺序', async () => {
    const design = reactive(newReportDesign('字段顺序'));
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'NONE', sort: 'ASC' });
    dataset.fields.push({ source: 'users', name: 'count', aggregation: 'SUM', sort: 'DESC', display: 'QUANTITY', unit: '件' });
    const component = addComponent(design, dataset.id);
    const fieldsCatalog: ReportSourceCatalog = { sources: [{ id: 'users', title: '用户', fields: [
      { id: 'name', title: '姓名', type: 'STRING' }, { id: 'count', title: '数量', type: 'INTEGER' },
    ] }], relations: [] };
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog: fieldsCatalog }, global: { stubs } });
    const preview = wrapper.get(`[data-report-component="${component.id}"]`);
    expect(preview.findAll('th').map((cell) => cell.text())).toEqual(['姓名', '数量（求和）']);
    await wrapper.get('button[aria-label="下移字段 1"]').trigger('click');
    expect(dataset.fields[0]).toMatchObject({ name: 'count', aggregation: 'SUM', sort: 'DESC', display: 'QUANTITY', unit: '件' });
    expect(dataset.fields[1]).toMatchObject({ name: 'name', aggregation: 'NONE', sort: 'ASC' });
    expect(preview.findAll('th').map((cell) => cell.text())).toEqual(['数量（求和）', '姓名']);
    wrapper.unmount();
  });

  it('配置变化立即更新并排示例预览', async () => {
    const design = reactive(newReportDesign('实时设计'));
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'NONE' });
    const component = addComponent(design, dataset.id);
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog }, global: { stubs } });
    const preview = wrapper.get(`[data-report-component="${component.id}"]`);
    expect(wrapper.text()).toContain('示例数据，仅用于预览样式');
    expect(preview.text()).toContain('姓名');
    design.components[0]!.title = '实时标题';
    await flushPromises();
    expect(preview.text()).toContain('实时标题');
    expect(preview.text()).toContain('示例甲');
    wrapper.unmount();
  });
  it('页面和图表可分别设置渐变并立即反映到预览', async () => {
    const design = reactive(newReportDesign('背景'));
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'NONE' });
    const component = addComponent(design, dataset.id);
    const switchStub = { props: ['checked'], emits: ['change'],
      template: '<button @click="$emit(\'change\', !checked)"><slot /></button>' };
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog },
      global: { stubs: { ...stubs, ASwitch: switchStub } } });
    await wrapper.get('[aria-label="页面背景渐变"]').trigger('click');
    await wrapper.get('[aria-label="图表背景模式"]').setValue('GRADIENT');
    expect(design.background.gradient?.direction).toBe('DIAGONAL');
    expect(design.components[0]?.background?.gradient?.direction).toBe('DIAGONAL');
    expect(wrapper.get('[data-testid="report-grid-preview"]').attributes('style')).toContain('linear-gradient');
    expect(wrapper.get(`[data-report-component="${component.id}"] .design-preview-card`).attributes('style')).toContain('linear-gradient');
    wrapper.unmount();
  });
  it('连续关联多表时显示连接字段、类型及示例列', () => {
    const sourceCatalog: ReportSourceCatalog = {
      sources: [
        { id: 'orders', title: '订单', fields: [{ id: 'org', title: '组织', type: 'ORGANIZATION' }] },
        { id: 'orgs', title: '组织', fields: [{ id: 'id', title: '标识', type: 'ORGANIZATION' }, { id: 'region', title: '区域', type: 'STRING' }] },
        { id: 'regions', title: '区域', fields: [{ id: 'id', title: '标识', type: 'STRING' }, { id: 'name', title: '区域名称', type: 'STRING' }] },
      ],
      relations: [
        { id: 'orderOrg', leftSource: 'orders', leftField: 'org', rightSource: 'orgs', rightField: 'id', multipliesLeft: false },
        { id: 'orgRegion', leftSource: 'orgs', leftField: 'region', rightSource: 'regions', rightField: 'id', multipliesLeft: false },
      ],
    };
    const design = reactive(newReportDesign('多表'));
    const dataset = addDataset(design, 'orders');
    design.datasets[0]!.relations.push('orderOrg', 'orgRegion');
    design.datasets[0]!.fields.push({ source: 'regions', name: 'name', aggregation: 'NONE' });
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog: sourceCatalog }, global: { stubs } });
    const datasetEditor = wrapper.get(`[data-report-dataset="${dataset.id}"]`);
    expect(datasetEditor.text()).toContain('订单 / 组织 → 组织 / 标识');
    expect(datasetEditor.text()).toContain('组织 / 区域 → 区域 / 标识');
    expect(datasetEditor.text()).toContain('内连接');
    expect(datasetEditor.get(`[data-dataset-preview="${dataset.id}"]`).text()).toContain('区域名称');
    wrapper.unmount();
  });
  it('可为关联切换左连接并在移除关联时清理选择', async () => {
    const choices: ReportSourceCatalog = {
      sources: [
        { id: 'orders', title: '订单', fields: [{ id: 'org', title: '组织', type: 'STRING' }] },
        { id: 'orgs', title: '组织', fields: [{ id: 'id', title: '标识', type: 'STRING' }] },
      ],
      relations: [{ id: 'orderOrg', leftSource: 'orders', leftField: 'org', rightSource: 'orgs', rightField: 'id', multipliesLeft: false }],
    };
    const design = reactive(newReportDesign('左连接'));
    const dataset = addDataset(design, 'orders'); dataset.relations.push('orderOrg');
    const confirm = vi.spyOn(Modal, 'confirm').mockImplementation((options) => {
      options.onOk?.({} as never); return { destroy: vi.fn(), update: vi.fn() } as never;
    });
    const tag = { emits: ['close'], template: '<button @click="$emit(\'close\', $event)"><slot /></button>' };
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog: choices }, global: { stubs: { ...stubs, ATag: tag } } });
    await wrapper.get('select[aria-label="关联 orderOrg 的连接方式"]').setValue('LEFT');
    expect(dataset.leftRelations).toEqual(['orderOrg']);
    expect(wrapper.get('[data-relation-id="orderOrg"]').text()).toContain('左连接');
    await wrapper.get('[data-relation-id="orderOrg"]').trigger('click');
    expect(dataset.leftRelations).toEqual([]);
    confirm.mockRestore(); wrapper.unmount();
  });
  it('多事实来源可切换按事实去重汇总', async () => {
    const choices: ReportSourceCatalog = {
      sources: [
        { id: 'org', title: '组织', fields: [{ id: 'id', title: '标识', type: 'STRING' }, { id: 'name', title: '名称', type: 'STRING' }] },
        { id: 'sales', title: '收入', fields: [{ id: 'orgId', title: '组织', type: 'STRING' }, { id: 'amount', title: '金额', type: 'DECIMAL' }] },
        { id: 'goals', title: '目标', fields: [{ id: 'orgId', title: '组织', type: 'STRING' }, { id: 'amount', title: '金额', type: 'DECIMAL' }] },
      ],
      relations: [
        { id: 'salesByOrg', leftSource: 'org', leftField: 'id', rightSource: 'sales', rightField: 'orgId', multipliesLeft: true, leftPrimaryKey: true },
        { id: 'goalsByOrg', leftSource: 'org', leftField: 'id', rightSource: 'goals', rightField: 'orgId', multipliesLeft: true, leftPrimaryKey: true },
      ],
    };
    const design = reactive(newReportDesign('多事实'));
    const dataset = addDataset(design, 'org');
    dataset.relations = ['salesByOrg', 'goalsByOrg'];
    dataset.fields = [{ source: 'org', name: 'name', aggregation: 'NONE' },
      { source: 'sales', name: 'amount', aggregation: 'SUM' }, { source: 'goals', name: 'amount', aggregation: 'SUM' }];
    addComponent(design, dataset.id);
    expect(validateReportDesign(design, choices)).toContain(`数据集 ${dataset.id} 的关联可能导致重复统计`);
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog: choices }, global: { stubs } });
    await wrapper.get('select[aria-label="数据集 1 的汇总方式"]').setValue('FACT_DISTINCT');
    expect(dataset.aggregationMode).toBe('FACT_DISTINCT');
    expect(validateReportDesign(design, choices)).not.toContain(`数据集 ${dataset.id} 的关联可能导致重复统计`);
    wrapper.unmount();
  });
  it('选择关联时通过两侧字段区分相同来源间的不同关系', () => {
    const choices: ReportSourceCatalog = {
      sources: [
        { id: 'orders', title: '订单', fields: [{ id: 'buyer', title: '购买人', type: 'STRING' }, { id: 'seller', title: '销售人', type: 'STRING' }] },
        { id: 'users', title: '用户', fields: [{ id: 'id', title: '标识', type: 'STRING' }] },
      ],
      relations: [
        { id: 'buyer', leftSource: 'orders', leftField: 'buyer', rightSource: 'users', rightField: 'id', multipliesLeft: false },
        { id: 'seller', leftSource: 'orders', leftField: 'seller', rightSource: 'users', rightField: 'id', multipliesLeft: false },
      ],
    };
    const design = reactive(newReportDesign('关联选择'));
    const dataset = addDataset(design, 'orders');
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog: choices }, global: { stubs } });
    const editor = wrapper.get(`[data-report-dataset="${dataset.id}"]`);
    expect(editor.text()).toContain('订单 / 购买人 → 用户 / 标识');
    expect(editor.text()).toContain('订单 / 销售人 → 用户 / 标识');
    wrapper.unmount();
  });
  it('可批量添加不同来源字段，保留已有聚合并拒绝超限', async () => {
    const choices: ReportSourceCatalog = {
      sources: [
        { id: 'orders', title: '订单', fields: [{ id: 'org', title: '组织', type: 'STRING' }, { id: 'amount', title: '金额', type: 'DECIMAL' }] },
        { id: 'users', title: '用户', fields: [{ id: 'id', title: '标识', type: 'STRING' }, { id: 'name', title: '姓名', type: 'STRING' }] },
      ],
      relations: [{ id: 'owner', leftSource: 'orders', leftField: 'org', rightSource: 'users', rightField: 'id', multipliesLeft: false }],
    };
    const design = reactive(newReportDesign('批量字段'));
    const dataset = addDataset(design, 'orders');
    dataset.relations.push('owner');
    dataset.fields.push({ source: 'orders', name: 'amount', aggregation: 'SUM', sort: 'DESC' });
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog: choices }, global: { stubs } });
    const select = wrapper.findAllComponents(stubs.ASelect).find((item) => item.attributes('aria-label') === '批量选择数据集 1 的字段')!;
    const filter = select.props('filterOption') as (input: string, option: { label: string; value: string }) => boolean;
    expect(filter('yh', { label: '用户 / 姓名', value: 'users:name' })).toBe(true);
    expect(filter('name', { label: '用户 / 姓名', value: 'users:name' })).toBe(true);
    expect(filter('金额', { label: '用户 / 姓名', value: 'users:name' })).toBe(false);
    select.vm.$emit('update:value', ['orders:org', 'users:name']);
    await flushPromises();
    await wrapper.get('button[aria-label="批量添加数据集 1 的字段"]').trigger('click');
    expect(dataset.fields).toEqual([
      { source: 'orders', name: 'amount', aggregation: 'SUM', sort: 'DESC' },
      { source: 'orders', name: 'org', aggregation: 'NONE' },
      { source: 'users', name: 'name', aggregation: 'NONE' },
    ]);
    while (dataset.fields.length < 64) dataset.fields.push({ source: 'orders', name: 'amount', aggregation: 'SUM' });
    select.vm.$emit('update:value', ['users:id']);
    await flushPromises();
    const warning = vi.spyOn(message, 'warning').mockImplementation(() => undefined as never);
    await wrapper.get('button[aria-label="批量添加数据集 1 的字段"]').trigger('click');
    expect(dataset.fields).toHaveLength(64);
    expect(warning).toHaveBeenCalledWith('一个数据集最多可添加 64 个展示字段');
    warning.mockRestore();
    wrapper.unmount();
  });
  it('删除数据集后重用标识不会继承未提交的批量选择', async () => {
    const design = reactive(newReportDesign('批量选择'));
    addDataset(design, 'users');
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog }, global: { stubs } });
    const select = wrapper.findAllComponents(stubs.ASelect).find((item) => item.attributes('aria-label') === '批量选择数据集 1 的字段')!;
    select.vm.$emit('update:value', ['users:name']);
    await flushPromises();
    const confirm = wrapper.findAllComponents(stubs.APopconfirm).find((item) => item.attributes('title') === '移除数据集及其所有组件？')!;
    confirm.vm.$emit('confirm');
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '添加数据集')!.trigger('click');
    expect(design.datasets[0]?.id).toBe('dataset1');
    const replacement = wrapper.findAllComponents(stubs.ASelect).find((item) => item.attributes('aria-label') === '批量选择数据集 1 的字段')!;
    expect(replacement.props('value')).toEqual([]);
    wrapper.unmount();
  });
  it('单独添加待选字段后自动移出批量待选列表', async () => {
    const design = reactive(newReportDesign('批量选择'));
    addDataset(design, 'users');
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog }, global: { stubs } });
    const select = wrapper.findAllComponents(stubs.ASelect).find((item) => item.attributes('aria-label') === '批量选择数据集 1 的字段')!;
    select.vm.$emit('update:value', ['users:name']);
    await flushPromises();
    await wrapper.findAll('button').find((item) => item.text() === '添加字段')!.trigger('click');
    expect(select.props('value')).toEqual([]);
    expect(design.datasets[0]?.fields[0]?.name).toBe('name');
    wrapper.unmount();
  });
  it('数据集名称按文本显示，不执行 HTML', () => {
    const design = reactive(newReportDesign('数据集'));
    const dataset = addDataset(design, 'users');
    dataset.title = '<img src=x onerror=alert(1)>';
    const component = addComponent(design, dataset.id);
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog }, global: { stubs } });
    const preview = wrapper.get(`[data-report-component="${component.id}"]`);
    expect(preview.text()).toContain(dataset.title);
    expect(preview.find('img').exists()).toBe(false);
    expect(preview.html()).toContain('&lt;img');
    wrapper.unmount();
  });
  it('可设置数据集业务名称，清空后回退来源名称', async () => {
    const design = reactive(newReportDesign('数据集'));
    const first = addDataset(design, 'users');
    const second = addDataset(design, 'users');
    const component = addComponent(design, first.id);
    const input = { props: ['value'], emits: ['update:value'],
      template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />' };
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog },
      global: { stubs: { ...stubs, AInput: input } } });
    const name = wrapper.get(`[data-report-dataset="${first.id}"] input[aria-label="数据集名称"]`);
    await name.setValue('本月收入');
    const select = wrapper.get(`[data-report-component-editor="${component.id}"] select[aria-label="组件数据集"]`);
    expect(select.findAll('option').map((item) => item.text())).toEqual(['数据集 1 · 本月收入（用户）', '数据集 2 · 用户']);
    await name.setValue('   ');
    expect(validateReportDesign(design, catalog)).toContain(`数据集 ${first.id} 的名称无效`);
    await name.setValue('');
    expect(first.title).toBeUndefined();
    expect(second.title).toBeUndefined();
    expect(select.findAll('option')[0]!.text()).toBe('数据集 1 · 用户');
    first.title = null;
    expect(validateReportDesign(design, catalog)).not.toContain(`数据集 ${first.id} 的名称无效`);
    wrapper.unmount();
  });
  it('切换已绑定组件的数据集前确认，取消保留原绑定', async () => {
    const design = reactive(newReportDesign('组件'));
    const first = addDataset(design, 'users');
    const second = addDataset(design, 'users');
    const component = addComponent(design, first.id);
    component.bindings.filter1 = 'parameter1';
    const confirm = vi.spyOn(Modal, 'confirm').mockReturnValue({ destroy: vi.fn(), update: vi.fn() } as never);
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog }, global: { stubs } });
    const area = wrapper.get(`[data-report-component-editor="${component.id}"]`);
    await area.get('select[aria-label="组件数据集"]').setValue(second.id);
    expect(component.dataset).toBe(first.id);
    expect(component.bindings).toEqual({ filter1: 'parameter1' });
    expect(confirm).toHaveBeenCalledOnce();
    const options = confirm.mock.calls[0]![0] as { content: string; onOk: () => void };
    expect(options.content).toContain('清除');
    options.onOk();
    expect(component.dataset).toBe(second.id);
    expect(component.bindings).toEqual({});
    confirm.mockRestore(); wrapper.unmount();
  });

  it('未绑定组件的数据集可以直接切换', async () => {
    const design = reactive(newReportDesign('组件'));
    const first = addDataset(design, 'users');
    const second = addDataset(design, 'users');
    const component = addComponent(design, first.id);
    const confirm = vi.spyOn(Modal, 'confirm');
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog }, global: { stubs } });
    const select = wrapper.get(`[data-report-component-editor="${component.id}"] select[aria-label="组件数据集"]`);
    expect(select.findAll('option').map((item) => item.text())).toEqual(['数据集 1 · 用户', '数据集 2 · 用户']);
    await select.setValue(second.id);
    expect(component.dataset).toBe(second.id);
    expect(wrapper.get(`[data-report-component="${component.id}"]`).text()).toContain('数据集 2 · 用户');
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore(); wrapper.unmount();
  });
  it('移除已绑定共享条件时先提示，确认后才解除所有组件绑定', async () => {
    const design = reactive(newReportDesign('共享条件'));
    const parameter = addParameter(design);
    const first = addComponent(design, 'users');
    const second = addComponent(design, 'users');
    first.bindings.filter1 = parameter.key;
    second.bindings.filter2 = parameter.key;
    const confirmation = { props: ['title', 'disabled'], emits: ['confirm'],
      template: '<span :data-title="title"><slot /><button v-if="!disabled" data-confirm @click="$emit(\'confirm\')">确认</button></span>' };
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog },
      global: { stubs: { ...stubs, APopconfirm: confirmation } } });
    const area = wrapper.get(`[data-report-parameter="${parameter.key}"]`);
    expect(area.html()).toContain('解除组件绑定');
    await area.findAll('button').find((item) => item.text() === '移除')!.trigger('click');
    expect(design.parameters).toHaveLength(1);
    expect(first.bindings.filter1).toBe(parameter.key);
    expect(second.bindings.filter2).toBe(parameter.key);
    await area.get('[data-confirm]').trigger('click');
    expect(design.parameters).toHaveLength(0);
    expect(first.bindings).toEqual({});
    expect(second.bindings).toEqual({});
    wrapper.unmount();
  });

  it('未绑定的共享条件可直接移除', async () => {
    const design = reactive(newReportDesign('共享条件'));
    const parameter = addParameter(design);
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog }, global: { stubs } });
    const area = wrapper.get(`[data-report-parameter="${parameter.key}"]`);
    await area.findAll('button').find((item) => item.text() === '移除')!.trigger('click');
    expect(design.parameters).toHaveLength(0);
    wrapper.unmount();
  });
  it('授权组织列表只能用于组织字段，并切回页面条件时恢复等于', async () => {
    const design = reactive(newReportDesign('组织'));
    const dataset = addDataset(design, 'users');
    dataset.filters.push({ source: 'users', name: 'orgId', operator: 'EQ', parameter: 'condition1' });
    const orgCatalog: ReportSourceCatalog = { relations: [], sources: [{ id: 'users', title: '用户', fields: [
      { id: 'orgId', title: '所属组织', type: 'ORGANIZATION' },
    ] }] };
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog: orgCatalog }, global: { stubs } });
    const selector = wrapper.findAll('select').find((item) => item.text().includes('当前授权组织列表'))!;
    await selector.setValue('AUTHORIZED_ORG_IDS');
    expect(dataset.filters[0]).toEqual({ source: 'users', name: 'orgId', operator: 'IN', context: 'AUTHORIZED_ORG_IDS' });
    await selector.setValue('PARAMETER');
    expect(dataset.filters[0]?.operator).toBe('EQ');
    expect(dataset.filters[0]?.context).toBeUndefined();
    wrapper.unmount();
  });
  it('添加展示字段优先选择未使用字段，全部使用后仍允许重复聚合', async () => {
    const design = reactive(newReportDesign('字段'));
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'NONE' });
    const extended: ReportSourceCatalog = { relations: [], sources: [{ id: 'users', title: '用户', fields: [
      { id: 'name', title: '姓名', type: 'STRING' }, { id: 'id', title: '标识', type: 'STRING' },
    ] }] };
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog: extended }, global: { stubs } });
    const add = wrapper.findAll('button').find((item) => item.text() === '添加字段')!;
    await add.trigger('click');
    expect(dataset.fields[1]).toEqual({ source: 'users', name: 'id', aggregation: 'NONE' });
    await add.trigger('click');
    expect(dataset.fields[2]).toEqual({ source: 'users', name: 'name', aggregation: 'NONE' });
    wrapper.unmount();
  });
  it('布局无法转换时提示并保留原布局', async () => {
    const warning = vi.spyOn(message, 'warning').mockReturnValue(undefined as never);
    const design = reactive(newReportDesign('布局'));
    addComponent(design, 'users').position.y = 300;
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog }, global: { stubs } });
    const selector = wrapper.findAll('select').find((item) => item.text().includes('自由画布'))!;
    await selector.setValue('CANVAS');
    expect(design.layout).toBe('GRID');
    expect(warning).toHaveBeenCalledWith('布局超出可转换范围，请先调整组件位置或尺寸');
    warning.mockRestore();
    wrapper.unmount();
  });
  it('拖动网格卡片交换位置而不重排其他组件', async () => {
    const design = reactive(newReportDesign('布局'));
    const first = addComponent(design, 'users');
    const second = addComponent(design, 'users');
    second.position.x = 6; second.position.y = 0;
    const third = addComponent(design, 'users');
    const originalThird = { ...third.position };
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog }, global: { stubs } });
    await wrapper.get(`[data-report-component="${first.id}"]`).trigger('dragstart', { clientX: 20, clientY: 20 });
    await wrapper.get(`[data-report-component="${second.id}"]`).trigger('drop', { clientX: 400, clientY: 20 });
    expect(first.position.x).toBe(6);
    expect(second.position.x).toBe(0);
    expect(third.position).toEqual(originalThird);
    wrapper.unmount();
  });
  it('自由画布拖动保留抓取点并计入滚动距离', async () => {
    const design = reactive(newReportDesign('布局'));
    design.layout = 'CANVAS';
    const component = addComponent(design, 'users');
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog }, global: { stubs } });
    const canvas = wrapper.get('[data-testid="report-canvas-preview"]');
    const card = wrapper.get(`[data-report-component="${component.id}"]`);
    vi.spyOn(canvas.element, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 200 } as DOMRect);
    vi.spyOn(card.element, 'getBoundingClientRect').mockReturnValue({ left: 130, top: 240 } as DOMRect);
    Object.defineProperty(canvas.element, 'scrollLeft', { value: 40, configurable: true });
    Object.defineProperty(canvas.element, 'scrollTop', { value: 60, configurable: true });
    await card.trigger('dragstart', { clientX: 150, clientY: 260 });
    await canvas.trigger('drop', { clientX: 350, clientY: 460 });
    expect(component.position.x).toBe(270);
    expect(component.position.y).toBe(300);
    wrapper.unmount();
  });
  it('时间筛选项可指定范围开始或结束', async () => {
    const design = reactive(newReportDesign('范围'));
    const dataset = addDataset(design, 'events');
    dataset.fields.push({ source: 'events', name: 'time', aggregation: 'NONE' });
    dataset.filters.push({ source: 'events', name: 'time', operator: 'EQ', parameter: 'condition1' });
    const eventCatalog: ReportSourceCatalog = { sources: [{ id: 'events', title: '事件', fields: [
      { id: 'time', title: '时间', type: 'DATETIME' },
    ] }], relations: [] };
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog: eventCatalog }, global: { stubs } });
    const selector = wrapper.get('select[aria-label="时间范围边界"]');
    await selector.setValue('START');
    expect(dataset.filters[0]?.boundary).toBe('START');
    expect(dataset.filters[0]?.operator).toBe('GE');
    await selector.setValue('END');
    expect(dataset.filters[0]?.boundary).toBe('END');
    expect(dataset.filters[0]?.operator).toBe('LE');
    wrapper.unmount();
  });
  it('更换为枚举维度后清除不支持的求和，并仅展示可用聚合', async () => {
    const design = reactive(newReportDesign('状态分析'));
    const dataset = addDataset(design, 'items');
    dataset.fields.push({ source: 'items', name: 'amount', aggregation: 'SUM', display: 'MONEY', unit: '元' });
    const localCatalog: ReportSourceCatalog = { sources: [{ id: 'items', title: '申请', fields: [
      { id: 'amount', title: '金额', type: 'DECIMAL' },
      { id: 'status', title: '状态', type: 'ENUM', choices: [{ value: 'Issued', label: '已开具' }] },
    ] }], relations: [] };
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog: localCatalog }, global: { stubs } });
    const fieldSelect = wrapper.find('select[aria-label="展示字段"]');
    expect(fieldSelect).toBeDefined();
    await fieldSelect!.setValue('items:status');
    expect(dataset.fields[0]).toEqual({ source: 'items', name: 'status', aggregation: 'NONE' });
    const aggregateSelect = wrapper.findAll('select').find((item) => item.text().includes('直接显示 / 分组'));
    expect(aggregateSelect?.text()).toContain('计数');
    expect(aggregateSelect?.text()).not.toContain('求和');
    wrapper.unmount();
  });
  it('日期字段可选择按日或按月分组', async () => {
    const design = reactive(newReportDesign('趋势'));
    const dataset = addDataset(design, 'events');
    dataset.fields.push({ source: 'events', name: 'time', aggregation: 'NONE' });
    dataset.fields.push({ source: 'events', name: 'id', aggregation: 'COUNT' });
    const parameter = addParameter(design); parameter.type = 'TIME_GRAIN'; parameter.required = true; parameter.title = '粒度';
    const component = addComponent(design, dataset.id);
    const eventCatalog: ReportSourceCatalog = { sources: [{ id: 'events', title: '事件', fields: [
      { id: 'time', title: '时间', type: 'DATETIME' }, { id: 'id', title: '标识', type: 'STRING' },
    ] }], relations: [] };
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog: eventCatalog }, global: { stubs } });
    expect(wrapper.text()).toContain('时间分组使用字段本身的本地时间，不自动转换时区。');
    const selector = wrapper.get('select[aria-label="时间分组"]');
    await selector.setValue('MONTH');
    expect(dataset.fields[0]?.grain).toBe('MONTH');
    await selector.setValue('DAY');
    expect(dataset.fields[0]?.grain).toBe('DAY');
    await selector.setValue('PARAMETER');
    const local = dataset.fields[0]?.grainParameter;
    expect(local).toBeDefined();
    const binding = wrapper.findAll('select').find((item) => item.findAll('option').some((option) => option.attributes('value') === parameter.key));
    expect(binding).toBeDefined();
    await binding!.setValue(parameter.key);
    expect(component.bindings[local!]).toBe(parameter.key);
    wrapper.unmount();
  });
  it('枚举筛选显示受信选项并保存固定值', async () => {
    const design = reactive(newReportDesign('发票'));
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'NONE' });
    dataset.filters.push({ source: 'users', name: 'name', operator: 'EQ', parameter: 'condition1' });
    const component = addComponent(design, dataset.id);
    component.bindings.condition1 = 'old';
    const enumCatalog: ReportSourceCatalog = { sources: [{ id: 'users', title: '用户', fields: [
      { id: 'name', title: '姓名', type: 'STRING' },
      { id: 'status', title: '状态', type: 'ENUM', choices: [{ value: 'Draft', label: '草稿' }, { value: 'Issued', label: '已开具' }] },
    ] }], relations: [] };
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog: enumCatalog }, global: { stubs } });
    await wrapper.get('select[aria-label="筛选字段"]').setValue('users:status');
    const valueSelect = wrapper.findAll('select').find((item) => item.text().includes('已开具'));
    expect(valueSelect).toBeDefined();
    await valueSelect!.setValue('LITERAL:Issued');
    expect(dataset.filters[0]).toEqual({ source: 'users', name: 'status', operator: 'EQ', literal: 'Issued' });
    expect(component.bindings).toEqual({});
    await valueSelect!.setValue('PARAMETER');
    expect(dataset.filters[0]?.literal).toBeUndefined();
    expect(dataset.filters[0]?.parameter).toMatch(/^condition\d+$/);
    wrapper.unmount();
  });
  it('可配置和取消展示字段排序', async () => {
    const design = reactive(newReportDesign('趋势'));
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'NONE' });
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog }, global: { stubs } });
    const selector = wrapper.get('select[aria-label="字段排序"]');
    await selector.setValue('ASC');
    expect(dataset.fields[0]?.sort).toBe('ASC');
    await selector.setValue('DESC');
    expect(dataset.fields[0]?.sort).toBe('DESC');
    await wrapper.get('input[aria-label="显示数量"]').setValue('10');
    expect(dataset.limit).toBe(10);
    await selector.setValue('NONE');
    expect(dataset.fields[0]?.sort).toBeUndefined();
    wrapper.unmount();
  });
  it('可将筛选值切换为可信当前用户，清除原页面条件绑定', async () => {
    const design = reactive(newReportDesign('本人用户'));
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name: 'name', aggregation: 'NONE' });
    dataset.filters.push({
      source: 'users',
      name: 'name',
      operator: 'EQ',
      parameter: 'condition1',
    });
    const component = addComponent(design, dataset.id);
    component.bindings.condition1 = 'pageUser';
    const wrapper = mount(ReportDesignEditor, {
      props: { modelValue: design, catalog },
      global: { stubs },
    });
    const selector = wrapper
      .findAll('select')
      .find((item) => item.text().includes('当前用户 ID'));
    expect(selector).toBeDefined();
    if (!selector) throw new Error('找不到身份筛选入口');
    await selector.setValue('CURRENT_USER_ID');
    expect(dataset.filters[0]).toEqual({
      source: 'users',
      name: 'name',
      operator: 'EQ',
      context: 'CURRENT_USER_ID',
    });
    expect(component.bindings).toEqual({});
    wrapper.unmount();
  });
  it.each([
    ['name', 'STRING', 'CURRENT_TENANT_ID', '当前租户 ID'],
    ['org', 'ORGANIZATION', 'CURRENT_ORG_ID', '当前用户组织'],
  ] as const)('可信上下文 %s 只在兼容字段上提供并保存', async (name, type, value, label) => {
    const design = reactive(newReportDesign('可信条件'));
    const dataset = addDataset(design, 'users');
    dataset.fields.push({ source: 'users', name, aggregation: 'NONE' });
    dataset.filters.push({ source: 'users', name, operator: 'EQ', parameter: 'condition1' });
    const component = addComponent(design, dataset.id); component.bindings.condition1 = 'old';
    const contextCatalog: ReportSourceCatalog = { sources: [{ id: 'users', title: '用户', fields: [
      { id: name, title: '字段', type },
    ] }], relations: [] };
    const wrapper = mount(ReportDesignEditor, { props: { modelValue: design, catalog: contextCatalog }, global: { stubs } });
    const selector = wrapper.findAll('select').find((item) => item.text().includes(label));
    expect(selector).toBeDefined();
    await selector!.setValue(value);
    expect(dataset.filters[0]).toMatchObject({ source: 'users', name, operator: 'EQ', context: value });
    expect(component.bindings).toEqual({});
    wrapper.unmount();
  });
  it('通过页面操作添加共享条件、数据集、字段和报表组件', async () => {
    const design = reactive(newReportDesign('用户分析'));
    const wrapper = mount(ReportDesignEditor, {
      props: { modelValue: design, catalog },
      global: { stubs },
    });
    async function click(label: string) {
      const target = wrapper
        .findAll('button')
        .find((item) => item.text() === label);
      expect(target, label).toBeDefined();
      if (!target) throw new Error(`找不到按钮: ${label}`);
      await target.trigger('click');
    }
    await click('添加条件');
    await click('添加数据集');
    await click('添加字段');
    await click('添加报表');
    expect(design.parameters).toHaveLength(1);
    expect(design.datasets[0]?.fields).toEqual([
      { source: 'users', name: 'name', aggregation: 'NONE' },
    ]);
    expect(design.components[0]?.dataset).toBe(design.datasets[0]?.id);
    expect(wrapper.text()).toContain('布局预览');
  });

  it('选择合规背景图片并可移除，处理期间通知父页面禁止保存', async () => {
    class Reader {
      onerror?: () => void;
      onload?: () => void;
      result = 'data:image/png;base64,YWJj';
      readAsDataURL() {
        queueMicrotask(() => this.onload?.());
      }
    }
    class Picture {
      naturalHeight = 800;
      naturalWidth = 1200;
      onerror?: () => void;
      onload?: () => void;
      get src() {
        return this.source;
      }
      set src(value: string) {
        this.source = value;
        queueMicrotask(() => this.onload?.());
      }
      private source = '';
    }
    vi.stubGlobal('FileReader', Reader);
    vi.stubGlobal('Image', Picture);
    try {
      const design = reactive(newReportDesign('用户分析'));
      const wrapper = mount(ReportDesignEditor, {
        props: { modelValue: design, catalog },
        global: { stubs },
      });
      const input = wrapper.get('input[type="file"]');
      Object.defineProperty(input.element, 'files', {
        configurable: true,
        value: [new File(['abc'], 'bg.png', { type: 'image/png' })],
      });
      await input.trigger('change');
      await flushPromises();
      expect(design.background.image).toBe('data:image/png;base64,YWJj');
      expect(wrapper.emitted('image-pending')).toEqual([
        [false],
        [true],
        [false],
      ]);
      await wrapper
        .findAll('button')
        .find((item) => item.text() === '移除图片')
        ?.trigger('click');
      expect(design.background.image).toBeUndefined();
      wrapper.unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
