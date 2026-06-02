import type {
  AdminOrg,
  AdminOverview,
  AdminUser,
  AppNotification,
  BillingStatus,
  GrowthPoint,
  Insights,
  ParsedInvoice,
  PlanCatalog,
  PublicBrand,
  ReminderConfig,
  ReminderHistoryEntry,
  Session,
  Subscription,
  SubscriptionInput,
  TeamMember,
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
  // ── Public (login personnalisé) ──
  publicOrg: (slug: string) => request<PublicBrand>(`/public/org/${encodeURIComponent(slug)}`),

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

  updateOrganization: (input: {
    name?: string;
    brandColor?: string | null;
    logoUrl?: string | null;
    baseCurrency?: string | null;
    exchangeRates?: Record<string, number> | null;
  }) =>
    request<{ id: string; name: string; plan: string; brandColor: string | null; logoUrl: string | null }>(
      '/organization',
      { method: 'PUT', body: JSON.stringify(input) },
    ),

  notifications: () => request<{ count: number; items: AppNotification[] }>('/notifications'),

  // ── Équipe ──
  team: () => request<TeamMember[]>('/team'),
  teamInvite: (email: string, role: 'admin' | 'member') =>
    request<{ email: string; role: string; temporaryPassword: string | null; existingAccount: boolean }>(
      '/team/invite',
      { method: 'POST', body: JSON.stringify({ email, role }) },
    ),
  teamSetRole: (userId: string, role: 'admin' | 'member') =>
    request<{ userId: string; role: string }>(`/team/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  teamRemove: (userId: string) => request<void>(`/team/${userId}`, { method: 'DELETE' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('/auth/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // ── Super-admin ──
  adminOverview: () => request<AdminOverview>('/admin/overview'),
  adminGrowth: () => request<GrowthPoint[]>('/admin/growth'),
  adminOrgs: (sort = 'subs') => request<AdminOrg[]>(`/admin/organizations?sort=${sort}`),
  adminUsers: (sort = 'logins') => request<AdminUser[]>(`/admin/users?sort=${sort}`),
  adminPatchOrg: (id: string, input: { plan?: string; status?: string }) =>
    request<{ id: string; plan: string; status: string }>(`/admin/organizations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  adminOrgsCsvUrl: () => `${BASE}/api/admin/organizations.csv`,
  adminOrgsPdfUrl: () => `${BASE}/api/admin/organizations.pdf`,
  reportPdfUrl: () => `${BASE}/api/report`,

  billingPlans: () => request<PlanCatalog>('/billing/plans'),
  billingStatus: () => request<BillingStatus>('/billing/status'),
  billingCheckout: (plan: 'pro' | 'team') =>
    request<{ url: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  billingActivate: (plan: 'free' | 'pro' | 'team') =>
    request<{ plan: string }>('/billing/activate', { method: 'POST', body: JSON.stringify({ plan }) }),

  exportUrl: (format: 'json' | 'csv') => `${BASE}/api/export?format=${format}`,
  calendarUrl: (token: string) => `${BASE}/api/calendar/${token}.ics`,
};
