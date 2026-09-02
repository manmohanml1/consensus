export function parseDisposableRecoveryTarget(
  connectionString: string | undefined,
  enabled: boolean,
): { sourceUrl: URL; sourceDatabase: string };
