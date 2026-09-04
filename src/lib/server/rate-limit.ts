/**
 * Minimal in-memory throttle for the login endpoint. Enough for a two-user
 * household on a single instance; it deliberately has no external dependency.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function isRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function registerFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;

  // Keep the map from growing without bound.
  if (attempts.size > 500) {
    for (const [key2, value] of attempts) {
      if (now > value.resetAt) attempts.delete(key2);
    }
  }
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}
