import { describe, expect, it } from 'vitest';

import { chartData } from '../report-chart';

describe('图表数据', () => {
  it('按首列分类与后续列生成多个数值系列', () => {
    expect(
      chartData(
        'LINE',
        ['月份', '销售', '订单'],
        [
          ['一月', 20, '3'],
          ['二月', -4, 0],
        ],
      ),
    ).toEqual({
      categories: ['一月', '二月'],
      series: [
        [20, -4],
        [3, 0],
      ],
    });
  });
  it('不把空值、脱敏结果或异常数字当成零', () => {
    for (const value of [null, '', '***', '  ', 'Infinity', true, Number.NaN]) {
      expect(
        chartData('BAR', ['组织', '数量'], [['组织甲', value]]),
      ).toHaveProperty('error');
    }
  });
  it('非零数值下溢时提示查看表格，同时允许真实零值', () => {
    for (const value of ['1e-400', '-1e-400', '0.0001e-400']) {
      expect(chartData('LINE', ['日期', '金额'], [['一月', value]])).toHaveProperty('error');
    }
    expect(chartData('LINE', ['日期', '金额'], [['一月', '0e-400'], ['二月', '1e-300']])).toEqual({
      categories: ['一月', '二月'], series: [[0, 1e-300]],
    });
  });
  it('饼图只接受一个非负数值系列', () => {
    expect(
      chartData(
        'PIE',
        ['类别', '金额'],
        [
          ['甲', 0],
          ['乙', 3],
        ],
      ),
    ).not.toHaveProperty('error');
    expect(chartData('PIE', ['类别', '金额'], [['甲', -1]])).toHaveProperty(
      'error',
    );
    expect(
      chartData('PIE', ['类别', '金额', '数量'], [['甲', 1, 2]]),
    ).toHaveProperty('error');
  });
  it('饼图大数总和溢出时等比例缩放，无法保留的非零比例提示查看表格', () => {
    expect(chartData('PIE', ['类别', '金额'], [['甲', '1e308'], ['乙', '1e308']])).toEqual({
      categories: ['甲', '乙'], series: [[1, 1]],
    });
    expect(chartData('PIE', ['类别', '金额'], [['甲', '1e308'], ['乙', '1e308'], ['丙', '1e-100']]))
      .toHaveProperty('error');
  });
});
