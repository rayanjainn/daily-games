/**
 * Client-side fetch helper: JSON in/out, CSRF header, typed errors.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

function csrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)(?:__Host-)?ed_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]!) : '';
}

export async function api<T>(
  path: string,
  body?: unknown,
  method: 'POST' | 'PATCH' | 'DELETE' | 'GET' = body === undefined ? 'GET' : 'POST',
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers:
      method === 'GET' ? {} : { 'content-type': 'application/json', 'x-csrf-token': csrfToken() },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    credentials: 'same-origin',
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: { code: string; message: string };
  } & Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.error?.code ?? 'error',
      data.error?.message ?? 'Something went wrong.',
      data.error ?? {},
    );
  }
  return data as T;
}
