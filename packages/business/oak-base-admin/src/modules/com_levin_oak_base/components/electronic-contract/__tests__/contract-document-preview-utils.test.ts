import { describe, expect, it } from 'vitest';

import {
  getPageSealPositions,
  getSealPositionStyle,
  getSealSourceLabel,
  hasValidSealPosition,
  type ContractSealPosition,
} from '../contract-document-preview-utils';

const defaultPosition: ContractSealPosition = {
  height: 0.12,
  pageNo: 2,
  signerLabel: '甲方盖章',
  source: 'provider-default',
  width: 0.2,
  x: 0.68,
  y: 0.74,
};

describe('合同文档预览位置规则', () => {
  it('只返回当前页的有效模拟签章位置', () => {
    const positions = [
      defaultPosition,
      { ...defaultPosition, pageNo: 1, source: 'business-override' as const },
    ].filter(hasValidSealPosition);

    expect(getPageSealPositions(positions, 2)).toEqual([defaultPosition]);
  });

  it('使用相对坐标生成模拟签章样式和来源文案', () => {
    expect(getSealPositionStyle(defaultPosition)).toEqual({
      height: '12%',
      left: '68%',
      top: '74%',
      width: '20%',
    });
    expect(getSealSourceLabel('business-override')).toBe('业务覆盖');
  });

  it('拒绝超出当前页面的坐标', () => {
    expect(hasValidSealPosition({ ...defaultPosition, x: 0.9 })).toBe(false);
  });
});
