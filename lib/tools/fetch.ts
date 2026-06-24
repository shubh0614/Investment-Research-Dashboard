/**
 * fetchWithRetry - wraps the global fetch with a timeout and one bounded
 * retry on transient (5xx / network) failures, per the constitution §2.4.
 * 4xx errors are not retried (they are not transient).
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  timeoutMs = 10_000,
  maxRetries = 1,
): Promise<Response> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });

      // Transient: retry on 5xx only
      if (res.status >= 500 && attempt < maxRetries) {
        await backoff(attempt);
        continue;
      }

      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await backoff(attempt);
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr ?? new Error("fetchWithRetry: max retries exceeded");
}

function backoff(attempt: number) {
  return new Promise<void>((r) => setTimeout(r, 1_000 * (attempt + 1)));
}
