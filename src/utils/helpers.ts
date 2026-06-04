/**
 * 格式化坐标轴数值，保留一位小数
 */
export const formatCoordinate = (val: number): string => {
  return val.toFixed(1);
};
