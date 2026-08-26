export type ContractSealPositionSource = 'business-override' | 'provider-default';

export interface ContractSealPosition {
  height: number;
  pageNo: number;
  signerLabel: string;
  source: ContractSealPositionSource;
  width: number;
  x: number;
  y: number;
}

export function getPageSealPositions(
  positions: ContractSealPosition[],
  pageNo: number,
): ContractSealPosition[] {
  return positions.filter((position) => position.pageNo === pageNo);
}

export function hasValidSealPosition(position: ContractSealPosition): boolean {
  return (
    Number.isInteger(position.pageNo) &&
    position.pageNo > 0 &&
    [position.x, position.y, position.width, position.height].every(
      (value) => Number.isFinite(value) && value >= 0 && value <= 1,
    ) &&
    position.width > 0 &&
    position.height > 0 &&
    position.x + position.width <= 1 &&
    position.y + position.height <= 1
  );
}

export function getSealPositionStyle(position: ContractSealPosition) {
  return {
    height: `${position.height * 100}%`,
    left: `${position.x * 100}%`,
    top: `${position.y * 100}%`,
    width: `${position.width * 100}%`,
  };
}

export function getSealSourceLabel(source: ContractSealPositionSource): string {
  return source === 'business-override' ? '业务覆盖' : '供应商默认';
}
