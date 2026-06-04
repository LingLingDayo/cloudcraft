/**
 * 将数值限制在 [min, max] 区间内
 */
export const clamp = (val: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, val));
};
