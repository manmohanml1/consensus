const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * @param {string | undefined} connectionString
 * @param {boolean} enabled
 * @returns {{ sourceUrl: URL, sourceDatabase: string }}
 */
export function parseDisposableRecoveryTarget(connectionString, enabled) {
  if (!connectionString || !enabled) {
    throw new Error("Recovery rehearsal is not explicitly enabled.");
  }
  const sourceUrl = new URL(connectionString);
  const sourceDatabase = decodeURIComponent(sourceUrl.pathname.slice(1));
  if (
    !localHosts.has(sourceUrl.hostname) ||
    !/(^|_)test($|_)/.test(sourceDatabase)
  ) {
    throw new Error("Recovery rehearsal target is not a local test database.");
  }
  return { sourceUrl, sourceDatabase };
}
