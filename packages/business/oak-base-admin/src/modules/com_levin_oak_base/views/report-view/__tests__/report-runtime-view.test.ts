import type { ReportRuntimePage, ReportRuntimeQuery } from '../report-runtime';

import { flushPromises, mount } from '@vue/test-utils';
import { message } from 'ant-design-vue';

import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

import ReportRuntimeView from '../report-runtime-view.vue';

const excel = vi.hoisted(() => ({ build: vi.fn((_options: unknown) => new Uint8Array([1])), download: vi.fn() }));
vi.mock('@levin/admin-framework/framework-commons/shared/crud-file-export', () => ({
  buildExcelXlsx: excel.build, downloadExcelXlsx: excel.download,
}));

vi.mock('@levin/admin-framework', () => ({
  UserOrgSelector: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      "<button data-org @click=\"$emit('update:modelValue', 'org-1')\">选择组织</button>",
  },
}));

const page: ReportRuntimePage = {
  title: '组织报表',
  layout: 'GRID',
  background: { color: '#eeeeee' },
  parameters: [
    {
      key: 'org',
      title: '组织',
      type: 'ORGANIZATION',
      required: true,
      requiredForAll: true,
    },
    {
      key: 'start',
      title: '开始时间',
      type: 'DATE',
      required: false,
      requiredForAll: false,
    },
  ],
  components: ['one', 'two'].map((id) => ({
    id,
    title: id,
    type: 'TABLE',
    columns: ['名称'],
    position: { x: 0, y: 0, width: 6, height: 4 },
  })),
};
const stubs = {
  AModal: { props: ['open'], emits: ['ok', 'cancel'], template: '<div v-if="open"><slot /><button data-export-confirm @click="$emit(\'ok\')">确认</button><button data-export-cancel @click="$emit(\'cancel\')">取消</button></div>' },
  ACheckbox: { props: ['checked'], emits: ['update:checked'], template: '<label><input type="checkbox" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)"/><slot /></label>' },
  AButton: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  AnalysisChartCard: {
    props: ['title'],
    template: '<div><h2>{{ title }}</h2><slot /></div>',
  },
  AAlert: { props: ['message'], template: '<div>{{ message }}</div>' },
  ASelect: {
    props: ['value', 'options'], emits: ['change'],
    template: '<select :value="value" @change="$emit(\'change\', $event.target.value)"><option v-for="item in options" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
  },
  ARadioGroup: {
    props: ['value', 'options'], emits: ['change'],
    template: '<select :value="value" @change="$emit(\'change\', { target: { value: $event.target.value } })"><option v-for="item in options" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
  },
  ASpin: { template: '<div><slot /></div>' },
  ATooltip: {
    props: ['title'],
    template: '<span :data-hint="title"><slot /></span>',
  },
  ADatePicker: {
    props: ['value'],
    emits: ['change'],
    template:
      '<input type="date" :value="value" @change="$emit(\'change\', $event.target.value)" />',
  },
  ARangePicker: {
    props: ['value'], emits: ['change'],
    template: '<button data-range @click="$emit(\'change\', [\'2026-01-01\', \'2026-01-31\'])">选择范围</button>',
  },
  ATable: {
    props: ['dataSource'],
    template:
      '<div><div v-for="row in dataSource" :key="row.key">{{ row.c0 }}</div></div>',
  },
};

describe('报表运行页面', () => {
  it('页面和图表分别显示配置的渐变背景', async () => {
    const gradientPage: ReportRuntimePage = { ...page, parameters: [],
      background: { gradient: { from: '#112233', to: '#ddeeff', direction: 'VERTICAL' } },
      components: [{ ...page.components[0]!, background: { gradient: { from: '#223344', to: '#aabbcc', direction: 'HORIZONTAL' } } }] };
    const wrapper = mount(ReportRuntimeView, { props: { page: gradientPage, query: async () => ({ rows: [], hasMore: false }), contextKey: 'test' }, global: { stubs } });
    await flushPromises();
    expect(wrapper.get('.report-runtime').attributes('style')).toContain('linear-gradient(180deg');
    expect(wrapper.get('.report-card').attributes('style')).toContain('linear-gradient(90deg');
    wrapper.unmount();
  });
  it('首次恢复声明的共享条件，身份变化时不复用旧条件', async () => {
    const query = vi.fn<ReportRuntimeQuery>(async () => ({ rows: [], hasMore: false }));
    const wrapper = mount(ReportRuntimeView, { props: { page, query, contextKey: 'old',
      initialContextKey: 'old', initialParameters: { org: 'north', start: '2026-01-01', tenantId: 'forged' } }, global: { stubs } });
    await flushPromises();
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[1]).toEqual({ org: 'north', start: '2026-01-01' });
    expect(wrapper.vm.getParameters()).toEqual({ org: 'north', start: '2026-01-01' });
    await wrapper.setProps({ contextKey: 'new' });
    await flushPromises();
    expect(wrapper.vm.getParameters()).toEqual({});
    expect(query).toHaveBeenCalledTimes(2);
    wrapper.unmount();
    const remounted = mount(ReportRuntimeView, { props: { page, query, contextKey: 'new', initialContextKey: 'old',
      initialParameters: { org: 'north' } }, global: { stubs } });
    await flushPromises();
    expect(remounted.vm.getParameters()).toEqual({});
    expect(query).toHaveBeenCalledTimes(2);
    remounted.unmount();
  });
  it('导出时重新查询并支持选择及调整字段顺序', async () => {
    excel.build.mockClear(); excel.download.mockClear();
    const exportPage: ReportRuntimePage = { ...page, parameters: [], components: [{ ...page.components[0]!, columns: ['名称', '金额'] }] };
    const exportComponent = vi.fn(async () => ({ title: '报表', columns: ['名称', '金额'],
      formats: [{ kind: 'PLAIN' as const }, { kind: 'MONEY' as const }], rows: [['=1+1', '120000123']] }));
    const wrapper = mount(ReportRuntimeView, { props: { page: exportPage, query: async () => ({ rows: [['x', '1']], hasMore: false }),
      exportComponent, contextKey: 'user' }, global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '导出')!.trigger('click');
    await wrapper.get('[aria-label="上移金额"]').trigger('click');
    await wrapper.get('[data-export-confirm]').trigger('click');
    await flushPromises();
    expect(exportComponent).toHaveBeenCalledWith('one', {});
    const options = excel.build.mock.calls[0]![0] as any;
    expect(options.fields.map((field: any) => field.label)).toEqual(['金额', '名称']);
    expect(options.formatCellValue(options.fields[0], options.records[0])).toBe('1,2000,0123元');
    expect(options.formatCellValue(options.fields[1], options.records[0])).toBe('=1+1');
    expect(excel.download).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
  it('隐藏数值显示为缺失值且导出不会变成零', async () => {
    excel.build.mockClear(); excel.download.mockClear();
    const exportPage: ReportRuntimePage = { ...page, parameters: [], components: [{
      ...page.components[0]!, columns: ['金额'], formats: [{ kind: 'MONEY' }],
    }] };
    const exportComponent = vi.fn(async () => ({ title: '报表', columns: ['金额'],
      formats: [{ kind: 'MONEY' as const }], rows: [[null]] }));
    const wrapper = mount(ReportRuntimeView, { props: { page: exportPage,
      query: async () => ({ rows: [[null]], hasMore: false }), exportComponent, contextKey: 'user' }, global: { stubs } });
    await flushPromises();
    expect(wrapper.text()).toContain('—');
    await wrapper.findAll('button').find((button) => button.text() === '导出')!.trigger('click');
    await wrapper.get('[data-export-confirm]').trigger('click');
    await flushPromises();
    const options = excel.build.mock.calls[0]![0] as any;
    expect(options.formatCellValue(options.fields[0], options.records[0])).toBe('—');
    expect(excel.download).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
  it('当前导出失败显示安全提示，不暴露内部异常文本', async () => {
    const errorMessage = vi.spyOn(message, 'error').mockImplementation(() => undefined as never);
    const exportPage: ReportRuntimePage = { ...page, parameters: [], components: [page.components[0]!] };
    const wrapper = mount(ReportRuntimeView, { props: { page: exportPage, contextKey: 'user',
      query: async () => ({ rows: [['数据']], hasMore: false }),
      exportComponent: async () => { throw new Error('内部堆栈和敏感路径'); } }, global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '导出')!.trigger('click');
    await wrapper.get('[data-export-confirm]').trigger('click'); await flushPromises();
    expect(errorMessage).toHaveBeenCalledWith('发生服务器异常');
    wrapper.unmount(); errorMessage.mockRestore();
  });
  it('切换用户上下文后不下载旧导出请求的结果', async () => {
    excel.download.mockClear();
    let finish!: (value: { title: string; columns: string[]; formats: Array<{ kind: 'PLAIN' }>; rows: unknown[][] }) => void;
    const pending = new Promise<Parameters<typeof finish>[0]>((resolve) => { finish = resolve; });
    const exportPage: ReportRuntimePage = { ...page, parameters: [], components: [page.components[0]!] };
    const wrapper = mount(ReportRuntimeView, { props: { page: exportPage, query: async () => ({ rows: [['x']], hasMore: false }),
      exportComponent: () => pending, contextKey: 'old-user' }, global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '导出')!.trigger('click');
    await wrapper.get('[data-export-confirm]').trigger('click');
    await wrapper.setProps({ contextKey: 'new-user' });
    finish({ title: '报表', columns: ['名称'], formats: [{ kind: 'PLAIN' }], rows: [['旧数据']] });
    await flushPromises();
    expect(excel.download).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('条件变化后可重新导出，旧请求结束不会解除新请求的忙碌状态', async () => {
    excel.download.mockClear();
    type Result = { title: string; columns: string[]; formats: Array<{ kind: 'PLAIN' }>; rows: unknown[][] };
    const pending: Array<(value: Result) => void> = [];
    const exportComponent = vi.fn(() => new Promise<Result>((resolve) => pending.push(resolve)));
    const exportPage: ReportRuntimePage = { ...page, components: [page.components[0]!] };
    const wrapper = mount(ReportRuntimeView, { props: { page: exportPage, contextKey: 'user', exportComponent,
      query: async () => ({ rows: [['数据']], hasMore: false }) }, global: { stubs } });
    await wrapper.get('[data-org]').trigger('click'); await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '导出')!.trigger('click');
    await wrapper.get('[data-export-confirm]').trigger('click');
    await wrapper.get('[data-org]').trigger('click'); await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '导出')!.trigger('click');
    await wrapper.get('[data-export-confirm]').trigger('click');
    expect(exportComponent).toHaveBeenCalledTimes(2);
    pending[0]!({ title: '旧', columns: ['名称'], formats: [{ kind: 'PLAIN' }], rows: [['旧数据']] });
    await flushPromises();
    await wrapper.get('[data-export-confirm]').trigger('click');
    expect(exportComponent).toHaveBeenCalledTimes(2);
    expect(excel.download).not.toHaveBeenCalled();
    pending[1]!({ title: '新', columns: ['名称'], formats: [{ kind: 'PLAIN' }], rows: [['新数据']] });
    await flushPromises();
    expect(excel.download).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
  it('取消进行中的导出后不下载旧结果且可以重新导出', async () => {
    excel.download.mockClear();
    type Result = { title: string; columns: string[]; formats: Array<{ kind: 'PLAIN' }>; rows: unknown[][] };
    const pending: Array<(value: Result) => void> = [];
    const exportComponent = vi.fn(() => new Promise<Result>((resolve) => pending.push(resolve)));
    const exportPage: ReportRuntimePage = { ...page, parameters: [], components: [page.components[0]!] };
    const wrapper = mount(ReportRuntimeView, { props: { page: exportPage, contextKey: 'user', exportComponent,
      query: async () => ({ rows: [['数据']], hasMore: false }) }, global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '导出')!.trigger('click');
    await wrapper.get('[data-export-confirm]').trigger('click');
    await wrapper.get('[data-export-cancel]').trigger('click');
    expect(wrapper.find('[data-export-confirm]').exists()).toBe(false);
    await wrapper.findAll('button').find((button) => button.text() === '导出')!.trigger('click');
    await wrapper.get('[data-export-confirm]').trigger('click');
    expect(exportComponent).toHaveBeenCalledTimes(2);
    pending[0]!({ title: '旧', columns: ['名称'], formats: [{ kind: 'PLAIN' }], rows: [['旧数据']] });
    await flushPromises();
    await wrapper.get('[data-export-confirm]').trigger('click');
    expect(exportComponent).toHaveBeenCalledTimes(2);
    expect(excel.download).not.toHaveBeenCalled();
    pending[1]!({ title: '新', columns: ['名称'], formats: [{ kind: 'PLAIN' }], rows: [['新数据']] });
    await flushPromises();
    expect(excel.download).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
  it('筛选条件改变后即使恢复原值也不下载旧导出结果', async () => {
    excel.download.mockClear();
    let finish!: (value: { title: string; columns: string[]; formats: Array<{ kind: 'PLAIN' }>; rows: unknown[][] }) => void;
    const pending = new Promise<Parameters<typeof finish>[0]>((resolve) => { finish = resolve; });
    const exportPage: ReportRuntimePage = { ...page, parameters: [{ key: 'state', title: '状态', type: 'ENUM',
      required: false, requiredForAll: false, choices: [{ value: 'A', label: '甲' }, { value: 'B', label: '乙' }] }],
      components: [page.components[0]!] };
    const wrapper = mount(ReportRuntimeView, { props: { page: exportPage, query: async () => ({ rows: [['x']], hasMore: false }),
      exportComponent: () => pending, contextKey: 'user' }, global: { stubs } });
    await flushPromises();
    await wrapper.get('select[aria-label="状态"]').setValue('A');
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '导出')!.trigger('click');
    await wrapper.get('[data-export-confirm]').trigger('click');
    await wrapper.get('select[aria-label="状态"]').setValue('B');
    await wrapper.get('select[aria-label="状态"]').setValue('A');
    finish({ title: '报表', columns: ['名称'], formats: [{ kind: 'PLAIN' }], rows: [['旧数据']] });
    await flushPromises();
    expect(excel.download).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('手动刷新后不下载之前的导出结果', async () => {
    excel.download.mockClear();
    let finish!: (value: { title: string; columns: string[]; formats: Array<{ kind: 'PLAIN' }>; rows: unknown[][] }) => void;
    const pending = new Promise<Parameters<typeof finish>[0]>((resolve) => { finish = resolve; });
    const exportPage: ReportRuntimePage = { ...page, parameters: [], components: [page.components[0]!] };
    const wrapper = mount(ReportRuntimeView, { props: { page: exportPage, query: async () => ({ rows: [['x']], hasMore: false }),
      exportComponent: () => pending, contextKey: 'user' }, global: { stubs } });
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '导出')!.trigger('click');
    await wrapper.get('[data-export-confirm]').trigger('click');
    await wrapper.findAll('button').find((button) => button.text() === '刷新报表')!.trigger('click');
    finish({ title: '报表', columns: ['名称'], formats: [{ kind: 'PLAIN' }], rows: [['旧数据']] });
    await flushPromises();
    expect(excel.download).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('窄屏纵向顺序依据网格位置而不是组件创建顺序', async () => {
    const arranged: ReportRuntimePage = { ...page, parameters: [], components: page.components.map((item, index) => ({
      ...item, position: { x: index === 0 ? 6 : 0, y: 0, width: 6, height: 4 },
    })) };
    const wrapper = mount(ReportRuntimeView, { props: { page: arranged, query: async () => ({ rows: [], hasMore: false }), contextKey: 'user' }, global: { stubs } });
    await flushPromises();
    const first = wrapper.findAll('h2').find((item) => item.text() === 'one');
    const second = wrapper.findAll('h2').find((item) => item.text() === 'two');
    expect(first?.element.parentElement?.getAttribute('style')).toContain('order: 6');
    expect(second?.element.parentElement?.getAttribute('style')).toContain('order: 0');
    wrapper.unmount();
  });
  it('选择时间范围后以同一条件刷新多个报表', async () => {
    const rangePage: ReportRuntimePage = { ...page, parameters: [{ key: 'window', title: '时间范围', type: 'DATE_RANGE',
      required: true, requiredForAll: true }] };
    const query = vi.fn(async (id: string, params: Readonly<Record<string, string>>) => ({ rows: [[`${id}:${params.window}`]], hasMore: false }));
    const wrapper = mount(ReportRuntimeView, { props: { page: rangePage, query, contextKey: 'user' }, global: { stubs } });
    expect(query).not.toHaveBeenCalled();
    await wrapper.get('[data-range]').trigger('click');
    await flushPromises();
    expect(query).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('one:2026-01-01/2026-01-31');
    expect(wrapper.text()).toContain('two:2026-01-01/2026-01-31');
    wrapper.unmount();
  });
  it('日期时间范围保留时分秒并联动两个报表', async () => {
    const rangePage: ReportRuntimePage = { ...page, parameters: [{ key: 'window', title: '时间范围', type: 'DATETIME_RANGE',
      required: true, requiredForAll: true }] };
    const query = vi.fn(async (id: string, params: Readonly<Record<string, string>>) => ({ rows: [[`${id}:${params.window}`]], hasMore: false }));
    const rangeStub = { props: ['value', 'showTime', 'valueFormat'], emits: ['change'],
      template: '<button data-datetime-range :data-format="valueFormat" :data-show-time="showTime" @click="$emit(\'change\', [\'2026-01-01T08:30:00\', \'2026-01-02T18:45:00\'])">选择时间范围</button>' };
    const wrapper = mount(ReportRuntimeView, { props: { page: rangePage, query, contextKey: 'user' },
      global: { stubs: { ...stubs, ARangePicker: rangeStub } } });
    const picker = wrapper.get('[data-datetime-range]');
    expect(picker.attributes('data-format')).toBe('YYYY-MM-DDTHH:mm:ss');
    expect(picker.attributes('data-show-time')).toBe('true');
    await picker.trigger('click');
    await flushPromises();
    const window = '2026-01-01T08:30:00/2026-01-02T18:45:00';
    expect(query).toHaveBeenCalledWith('one', expect.objectContaining({ window }));
    expect(query).toHaveBeenCalledWith('two', expect.objectContaining({ window }));
    expect(wrapper.text()).toContain(`one:${window}`);
    expect(wrapper.text()).toContain(`two:${window}`);
    wrapper.unmount();
  });
  it('时间粒度默认按日并可切换按月联动组件', async () => {
    const grainPage: ReportRuntimePage = { ...page, parameters: [{ key: 'period', title: '粒度', type: 'TIME_GRAIN', required: true,
      requiredForAll: true, choices: [{ value: 'DAY', label: '按日' }, { value: 'MONTH', label: '按月' }] }] };
    const query = vi.fn(async (id: string, params: Readonly<Record<string, string>>) => ({ rows: [[`${id}:${params.period}`]], hasMore: false }));
    const wrapper = mount(ReportRuntimeView, { props: { page: grainPage, query, contextKey: 'user' }, global: { stubs } });
    await flushPromises();
    expect(wrapper.text()).toContain('one:DAY');
    await wrapper.get('select[aria-label="粒度"]').setValue('MONTH');
    await flushPromises();
    expect(wrapper.text()).toContain('one:MONTH');
    expect(wrapper.text()).toContain('two:MONTH');
    expect(query).toHaveBeenCalledTimes(4);
    expect(query).toHaveBeenCalledWith('one', expect.objectContaining({ period: 'MONTH' }));
    expect(query).toHaveBeenCalledWith('two', expect.objectContaining({ period: 'MONTH' }));
    await wrapper.get('select[aria-label="粒度"]').setValue('DAY');
    await flushPromises();
    expect(wrapper.text()).toContain('one:DAY');
    expect(wrapper.text()).toContain('two:DAY');
    expect(query).toHaveBeenCalledTimes(6);
    wrapper.unmount();
  });
  it('共享枚举选择会刷新全部组件', async () => {
    const enumPage: ReportRuntimePage = { ...page, parameters: [{ key: 'state', title: '状态', type: 'ENUM', required: true,
      requiredForAll: true, choices: [{ value: 'Issued', label: '已开具' }, { value: 'Draft', label: '草稿' }] }] };
    const query = vi.fn(async (id: string, params: Readonly<Record<string, string>>) => ({ rows: [[`${id}:${params.state}`]], hasMore: false }));
    const wrapper = mount(ReportRuntimeView, { props: { page: enumPage, query, contextKey: 'user' }, global: { stubs } });
    expect(query).not.toHaveBeenCalled();
    await wrapper.get('select[aria-label="状态"]').setValue('Issued');
    await flushPromises();
    expect(query).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('one:Issued');
    expect(wrapper.text()).toContain('two:Issued');
    wrapper.unmount();
  });
  it('金额指标使用四位分组及中文数量级提示', async () => {
    const metricPage: ReportRuntimePage = {
      title: '金额',
      layout: 'GRID',
      background: {},
      parameters: [],
      components: [
        {
          id: 'metric',
          title: '收入',
          type: 'METRIC',
          columns: ['收入'],
          formats: [{ kind: 'MONEY' }],
          position: { x: 0, y: 0, width: 6, height: 4 },
        },
      ],
    };
    const wrapper = mount(ReportRuntimeView, {
      props: {
        page: metricPage,
        query: async () => ({ rows: [['120000123.45']], hasMore: false }),
        contextKey: 'user-1',
      },
      global: { stubs },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('1,2000,0123.45元');
    expect(wrapper.get('[data-hint]').attributes('data-hint')).toBe(
      '1亿2000万0123.45元',
    );
    wrapper.unmount();
  });
  it('表格金额与数量保留精度并显示中文数量级', async () => {
    const tablePage: ReportRuntimePage = { ...page, parameters: [], components: [{
      ...page.components[0]!, columns: ['金额', '数量'], formats: [{ kind: 'MONEY' }, { kind: 'QUANTITY', unit: '笔' }],
    }] };
    const tableStub = defineComponent({
      props: ['columns', 'dataSource'],
      setup(props) {
        return () => h('div', props.dataSource.flatMap((row: Record<string, unknown>) =>
          props.columns.map((column: { dataIndex: string; customRender: (value: { text: unknown }) => unknown }) =>
            column.customRender({ text: row[column.dataIndex] }))));
      },
    });
    const wrapper = mount(ReportRuntimeView, { props: { page: tablePage, contextKey: 'user',
      query: async () => ({ rows: [['9007199254740993.25', '100020003']], hasMore: false }) },
      global: { stubs: { ...stubs, ATable: tableStub } } });
    await flushPromises();
    expect(wrapper.text()).toContain('9007,1992,5474,0993.25元');
    expect(wrapper.text()).toContain('1,0002,0003笔');
    expect(wrapper.findAll('[data-hint]').map((item) => item.attributes('data-hint')))
      .toEqual(expect.arrayContaining(['9007兆1992亿5474万0993.25元', '1亿0002万0003笔']));
    wrapper.unmount();
  });
  it('选择组织和时间时刷新多个组件，并在上下文切换时清除结果', async () => {
    const query = vi.fn(
      async (id: string, params: Readonly<Record<string, string>>) => ({
        rows: [[`${id}:${params.org}:${params.start || ''}`]],
        hasMore: false,
      }),
    );
    const wrapper = mount(ReportRuntimeView, {
      props: { page, query, contextKey: 'user-1' },
      global: { stubs },
    });
    expect(wrapper.text()).not.toContain('报表中心');
    expect(wrapper.text()).not.toContain('按条件查看报表');
    expect(wrapper.text()).not.toContain('组织报表');
    expect(query).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('请选择必填条件');
    await wrapper.get('[data-org]').trigger('click');
    await flushPromises();
    expect(query).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('one:org-1:');
    await wrapper.get('input[type="date"]').setValue('2026-01-01');
    await flushPromises();
    expect(query).toHaveBeenCalledTimes(4);
    expect(wrapper.text()).toContain('two:org-1:2026-01-01');
    await wrapper.setProps({ contextKey: 'user-2' });
    expect(wrapper.text()).not.toContain('org-1');
    expect(wrapper.text()).toContain('请选择必填条件');
  });
});
