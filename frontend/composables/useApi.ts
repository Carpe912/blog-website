function getBaseUrl() {
  // useRuntimeConfig 在 composable 中可用
  try {
    return useRuntimeConfig().public.apiBase as string
  } catch {
    return 'http://localhost:3001/api'
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await $fetch<{ success: boolean; data: T }>(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return res.data
}

// ---- Posts ----
export const usePostsApi = () => ({
  list: (params?: Record<string, any>) =>
    apiFetch<any>('/posts?' + new URLSearchParams(params).toString()),
  get: (id: number) => apiFetch<any>(`/posts/${id}`),
  getBySlug: (slug: string) => apiFetch<any>(`/posts/slug/${slug}`),
  create: (data: any) => apiFetch<any>('/posts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) =>
    apiFetch<any>(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: number) => apiFetch<void>(`/posts/${id}`, { method: 'DELETE' }),
})

// ---- Tags ----
export const useTagsApi = () => ({
  list: () => apiFetch<any[]>('/tags'),
  get: (id: number) => apiFetch<any>(`/tags/${id}`),
  create: (data: any) => apiFetch<any>('/tags', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) =>
    apiFetch<any>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: number) => apiFetch<void>(`/tags/${id}`, { method: 'DELETE' }),
})
