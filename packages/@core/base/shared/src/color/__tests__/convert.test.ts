import { describe, expect, it } from 'vitest';

import {
  brightenColor,
  convertToHsl,
  convertToHslCssVar,
  convertToRgb,
  isValidColor,
} from '../convert';

describe('color conversion functions', () => {
  it('should correctly convert color to HSL format', () => {
    const color = '#ff0000';
    const expectedHsl = 'hsl(0 100% 50%)';
    expect(convertToHsl(color)).toEqual(expectedHsl);
  });

  it('should correctly convert color with alpha to HSL format', () => {
    const color = 'rgba(255, 0, 0, 0.5)';
    const expectedHsl = 'hsl(0 100% 50%) 0.5';
    expect(convertToHsl(color)).toEqual(expectedHsl);
  });

  it('should correctly convert color to HSL CSS variable format', () => {
    const color = '#ff0000';
    const expectedHsl = '0 100% 50%';
    expect(convertToHslCssVar(color)).toEqual(expectedHsl);
  });

  it('should correctly convert color with alpha to HSL CSS variable format', () => {
    const color = 'rgba(255, 0, 0, 0.5)';
    const expectedHsl = '0 100% 50% / 0.5';
    expect(convertToHslCssVar(color)).toEqual(expectedHsl);
  });

  it('preserves CSS HSL values when converting to a CSS variable', () => {
    expect(convertToHslCssVar('hsl(222 10% 12%)')).toEqual('222 10% 12%');
  });

  it('should correctly convert color to RGB CSS variable format', () => {
    const color = 'hsl(284, 100%, 50%)';
    const expectedRgb = 'rgb(187, 0, 255)';
    expect(convertToRgb(color)).toEqual(expectedRgb);
  });

  it('should correctly convert color with alpha to RGBA CSS variable format', () => {
    const color = 'hsla(284, 100%, 50%, 0.92)';
    const expectedRgba = 'rgba(187, 0, 255, 0.92)';
    expect(convertToRgb(color)).toEqual(expectedRgba);
  });
});

describe('isValidColor', () => {
  it('isValidColor function', () => {
    // 测试有效颜色
    expect(isValidColor('blue')).toBe(true);
    expect(isValidColor('#000000')).toBe(true);

    // 测试无效颜色
    expect(isValidColor('invalid color')).toBe(false);
    expect(isValidColor()).toBe(false);
  });
});

describe('brightenColor', () => {
  it('returns an hsl color with increased lightness', () => {
    expect(brightenColor('hsl(222 10% 12%)', 40)).toBe('hsl(222, 10%, 52%)');
  });
});
