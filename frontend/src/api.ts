import type {
  Insights,
  ParsedInvoice,
  ReminderConfig,
  ReminderHistoryEntry,
  Session,
  Subscription,
  SubscriptionInput,
} from './types';

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

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
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers,
    credentials: 'include', // envoie/reçoit le cookie de session httpOnly
  });
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Erreur ${res.status}`, body?.details);
  }
  return body?.data as T;
}

export const api = {
  // ── Auth ──
  register: (input: { email: string; password: string; organizationName?: string; name?: string }) =>
    request<Session>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) =>
    request<Session>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<Session>('/auth/me'),

  // ── Abonnements ──
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

  insights: () => request<Insights>('/insights'),

  reminderConfig: () => request<ReminderConfig>('/reminders/config'),
  runReminders: (dryRun = false) =>
    request<unknown>('/reminders/run', { method: 'POST', body: JSON.stringify({ dryRun }) }),
  reminderHistory: () => request<ReminderHistoryEntry[]>('/reminders/history'),
  testChannel: (channel: 'email' | 'n8n') =>
    request<{ ok: boolean; channel: string }>('/reminders/test', {
      method: 'POST',
      body: JSON.stringify({ channel }),
    }),

  parseInvoice: (text: string) =>
    request<ParsedInvoice>('/import/parse', { method: 'POST', body: JSON.stringify({ text }) }),

  importJson: (items: SubscriptionInput[], replace: boolean) =>
    request<{ imported: number }>('/import', {
      method: 'POST',
      body: JSON.stringify({ items, replace }),
    }),

  exportUrl: (format: 'json' | 'csv') => `${BASE}/api/export?format=${format}`,
  calendarUrl: (token: string) => `${BASE}/api/calendar/${token}.ics`,
};
