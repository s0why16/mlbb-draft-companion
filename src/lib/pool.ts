export const CORE_POOL_SIZE = 3;
export const MAX_POOL_SIZE = 8;
export const OPTIONAL_POOL_SIZE = MAX_POOL_SIZE - CORE_POOL_SIZE;

export function poolCoreCount(pool: { heroId: string }[]): number {
  return Math.min(CORE_POOL_SIZE, pool.length);
}

export function poolOptionalCount(pool: { heroId: string }[]): number {
  return Math.max(0, pool.length - CORE_POOL_SIZE);
}

export function initialSlotCount(poolLength: number): number {
  return Math.max(CORE_POOL_SIZE, Math.min(MAX_POOL_SIZE, poolLength));
}
