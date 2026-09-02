import type { Pool, PoolClient } from "pg";

export const MAX_RETENTION_SWEEP_LIMIT: 1000;

export function validateRetentionSweep(limit: number, now: Date): void;

export function deleteDueRoomAggregates(
  queryable: Pool | PoolClient,
  limit: number,
  now: Date,
): Promise<{ deleted: number }>;
