export const MAX_RETENTION_SWEEP_LIMIT = 1_000;

/**
 * @param {number} limit
 * @param {Date} now
 */
export function validateRetentionSweep(limit, now) {
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_RETENTION_SWEEP_LIMIT
  ) {
    throw new TypeError(
      `Retention sweep limit must be between 1 and ${MAX_RETENTION_SWEEP_LIMIT}.`,
    );
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError("Retention sweep timestamp is invalid.");
  }
}

/**
 * @param {{ query: (text: string, values: unknown[]) => Promise<{ rowCount: number | null }> }} queryable
 * @param {number} limit
 * @param {Date} now
 * @returns {Promise<{ deleted: number }>}
 */
export async function deleteDueRoomAggregates(queryable, limit, now) {
  validateRetentionSweep(limit, now);
  const result = await queryable.query(
    `WITH due AS (
       SELECT id
         FROM consensus.rooms
        WHERE deletion_due_at <= $1
        ORDER BY deletion_due_at, id
        FOR UPDATE SKIP LOCKED
        LIMIT $2
     )
     DELETE FROM consensus.rooms AS rooms
     USING due
     WHERE rooms.id = due.id
     RETURNING rooms.id`,
    [now, limit],
  );
  return { deleted: result.rowCount ?? 0 };
}
