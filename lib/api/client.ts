/** Browser-side API client - uses session cookie auth automatically. */

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const json = await res.json();
  if (!json.ok) {
    const msg = json.error?.message ?? `Request failed: ${res.status}`;
    throw Object.assign(new Error(msg), { code: json.error?.code, status: res.status });
  }
  return json.data as T;
}
