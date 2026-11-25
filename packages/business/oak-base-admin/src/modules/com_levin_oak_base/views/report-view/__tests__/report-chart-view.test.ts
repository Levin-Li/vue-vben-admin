import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import ReportChart from '../report-chart.vue';

const chart = vi.hoisted(() => ({
  renderEcharts: vi.fn(),
  clearEcharts: vi.fn(),
}));
vi.mock('@vben/runtime/plugins/echarts', () => ({
  EchartsUI: { name: 'EchartsUI', template: '<div data-chart></div>' },
  useEcharts: () => chart,
}));

describe('报表图表', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chart.renderEcharts.mockResolvedValue(null);
  });

  it('使用项目图表控件并禁用 HTML 提示', async () => {
    const wrapper = mount(ReportChart, {
      props: { type: 'BAR', columns: ['分类', '数值'], rows: [['甲', 12]] },
    });
    await flushPromises();
    expect(wrapper.find('[data-chart]').exists()).toBe(true);
    expect(chart.renderEcharts).toHaveBeenCalledWith(
      expect.objectContaining({
        tooltip: expect.objectContaining({ renderMode: 'richText' }),
        xAxis: expect.objectContaining({ data: ['甲'] }),
        series: [expect.objectContaining({ type: 'bar', data: [12] })],
      }),
    );
    const option = chart.renderEcharts.mock.calls.at(-1)?.[0];
    expect(
      option?.tooltip?.formatter([
        {
          dataIndex: 0,
          seriesIndex: 0,
          axisValueLabel: '甲',
          seriesName: '数值',
        },
      ]),
    ).toContain('数值: 12');
    await wrapper.setProps({ type: 'PIE', rows: [['乙', 8]] });
    await flushPromises();
    expect(chart.renderEcharts).toHaveBeenLastCalledWith(
      expect.objectContaining({
        series: [
          expect.objectContaining({
            type: 'pie',
            data: [{ name: '乙', value: 8 }],
          }),
        ],
      }),
    );
    wrapper.unmount();
  });

  it('脱敏值不能绘图，且数据变化时清除旧图', async () => {
    const wrapper = mount(ReportChart, {
      props: { type: 'BAR', columns: ['分类', '数值'], rows: [['甲', 12]] },
    });
    await flushPromises();
    await wrapper.setProps({ rows: [['甲', '***']] });
    await flushPromises();
    expect(wrapper.text()).toContain('数值缺失或不适合绘制图表');
    expect(wrapper.find('[data-chart]').exists()).toBe(false);
    expect(chart.clearEcharts).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('环形图显示安全的分类与占比标签', async () => {
    const wrapper = mount(ReportChart, {
      props: { type: 'PIE', columns: ['分类', '数量'], rows: [['甲', 12]] },
    });
    await flushPromises();
    const option = chart.renderEcharts.mock.calls.at(-1)?.[0];
    const label = option?.series?.[0]?.label;
    expect(label?.show).toBe(true);
    expect(label?.position).toBe('outside');
    expect(label?.formatter({ name: '甲{恶意|内容}', percent: 29.81 })).toBe('甲 恶意 内容 \n29.81%');
    expect(option?.series?.[0]?.labelLayout?.hideOverlap).toBe(true);
    wrapper.unmount();
  });

  it('悬停使用原始精确金额和中文数量级', async () => {
    const wrapper = mount(ReportChart, {
      props: {
        type: 'LINE',
        columns: ['分类', '收入'],
        formats: [{ kind: 'PLAIN' }, { kind: 'MONEY' }],
        rows: [['甲', '120000123.45']],
      },
    });
    await flushPromises();
    const option = chart.renderEcharts.mock.calls.at(-1)?.[0];
    expect(
      option?.tooltip?.formatter([
        {
          dataIndex: 0,
          seriesIndex: 0,
          axisValueLabel: '甲',
          seriesName: '收入',
        },
      ]),
    ).toContain('收入: 1亿2000万0123.45元');
    expect(option?.yAxis?.axisLabel?.formatter(120_000_123)).toBe(
      '1,2000,0123',
    );
    wrapper.unmount();
  });

  it('图表定位有浮点误差时悬停仍使用服务端原始大金额', async () => {
    const wrapper = mount(ReportChart, {
      props: { type: 'BAR', columns: ['分类', '金额'], formats: [{ kind: 'PLAIN' }, { kind: 'MONEY' }],
        rows: [['甲', '9007199254740993.25']] },
    });
    await flushPromises();
    const option = chart.renderEcharts.mock.calls.at(-1)?.[0];
    expect(option?.series?.[0]?.data[0]).toBe(Number('9007199254740993.25'));
    expect(option?.tooltip?.formatter([{ dataIndex: 0, seriesIndex: 0, axisValueLabel: '甲', seriesName: '金额' }]))
      .toContain('金额: 9007兆1992亿5474万0993.25元');
    wrapper.unmount();
  });

  it('饼图溢出缩放后悬停仍显示原始数据', async () => {
    const wrapper = mount(ReportChart, {
      props: { type: 'PIE', columns: ['分类', '数量'], formats: [{ kind: 'PLAIN' }, { kind: 'QUANTITY' }],
        rows: [['甲', '1e308'], ['乙', '1e308']] },
    });
    await flushPromises();
    const option = chart.renderEcharts.mock.calls.at(-1)?.[0];
    expect(option?.series?.[0]?.data).toEqual([{ name: '甲', value: 1 }, { name: '乙', value: 1 }]);
    expect(option?.tooltip?.formatter({ dataIndex: 0, seriesIndex: 0, name: '甲' })).toContain('数量: 1e308');
    wrapper.unmount();
  });
});
