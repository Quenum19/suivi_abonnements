import type { ReminderConfig, Subscription, SubscriptionInput } from './types';

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

/** Mot de passe applicatif mémorisé en session (envoyé en en-tête). */
let appPassword = sessionStorage.getItem('appPassword') ?? '';
export function setAppPassword(pw: string) {
  appPassword = pw;
  sessionStorage.setItem('appPassword', pw);
}
export function getAppPassword() {
  return appPassword;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (appPassword) headers['x-app-password'] = appPassword;

  const res = await fetch(`${BASE}/api${path}`, { ...init, headers });
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Erreur ${res.status}`, body?.details);
  }
  return body?.data as T;
}

export const api = {
  authStatus: () => request<{ authRequired: boolean }>('/auth/status'),

  list: (params?: { search?: string; category?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.category) q.set('category', params.category);
    const qs = q.toString();
    return request<Subscription[]>(`/subscriptions${qs ? `?${qs}` : ''}`);
  },
  create: (input: SubscriptionInput) =>
    request<Subscription>('/subscriptions', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<SubscriptionInput>) =>
    request<Subscription>(`/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/subscriptions/${id}`, { method: 'DELETE' }),

  reminderConfig: () => request<ReminderConfig>('/reminders/config'),
  runReminders: (dryRun = false) =>
    request<unknown>('/reminders/run', { method: 'POST', body: JSON.stringify({ dryRun }) }),

  importJson: (items: SubscriptionInput[], replace: boolean) =>
    request<{ imported: number }>('/import', {
      method: 'POST',
      body: JSON.stringify({ items, replace }),
    }),

  exportUrl: (format: 'json' | 'csv') => `${BASE}/api/export?format=${format}`,
  calendarUrl: () => `${BASE}/api/calendar.ics`,
};
