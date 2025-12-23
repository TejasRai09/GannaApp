export interface ApiOptions extends RequestInit {
  token?: string;
}

export async function apiFetch<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (token) mergedHeaders.Authorization = `Bearer ${token}`;

  const resp = await fetch(path, {
    ...rest,
    headers: mergedHeaders,
  });

  const text = await resp.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text as any;
  }

  if (!resp.ok) {
    const msg = data?.error || data?.message || `Request failed (${resp.status})`;
    throw new Error(msg);
  }
  return data as T;
}
