export type Status = 'safe' | 'soon' | 'urgent';
export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one_time';
export type Lifecycle = 'active' | 'unused' | 'cancelled';

export interface Subscription {
  id: string;
  name: string;
  category: string;
  startDate: string | null;
  expiryDate: string; // AAAA-MM-JJ
  amount: number | null;
  currency: string | null;
  notes: string | null;
  frequency: Frequency;
  lifecycle: Lifecycle;
  responsible: string | null;
  createdAt: string;
  updatedAt: string;
  // Champs calculés renvoyés par le serveur :
  daysLeft: number;
  status: Status;
  statusLabel: string;
  progress: number;
  monthlyCost: number | null;
  annualCost: number | null;
}

export interface SubscriptionInput {
  name: string;
  category: string;
  startDate: string | null;
  expiryDate: string;
  amount: number | null;
  currency: string | null;
  notes: string | null;
  frequency: Frequency;
  status: Lifecycle;
  responsible: string | null;
}

export interface Session {
  user: { id: string; email: string; name: string | null; isSuperAdmin: boolean };
  organization: {
    id: string;
    name: string;
    plan: 'free' | 'pro' | 'team';
    calendarToken: string;
    inboundToken: string;
    logoUrl: string | null;
    brandColor: string | null;
    status: 'active' | 'suspended';
  };
  role: string;
}

export interface AdminOverview {
  totals: { organizations: number; users: number; subscriptions: number; remindersSent: number };
  byPlan: Record<string, number>;
  suspended: number;
  mrrEur: number;
  activity: { activeUsers7d: number; activeUsers30d: number; newOrgs30d: number };
}

export interface AdminOrg {
  id: string;
  name: string;
  plan: string;
  status: 'active' | 'suspended';
  ownerEmail: string | null;
  subscriptions: number;
  reminders: number;
  members: number;
  lastLoginAt: string | null;
  loginCount: number;
  createdAt: string;
}

export interface TeamMember {
  userId: string;
  email: string;
  name: string | null;
  role: 'owner' | 'admin' | 'member';
  lastLoginAt: string | null;
  isSelf: boolean;
}

export interface GrowthPoint {
  month: string;
  orgs: number;
  users: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  organization: string | null;
  loginCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface BillingStatus {
  plan: 'free' | 'pro' | 'team';
  label: string;
  used: number;
  max: number | null;
  channels: ('email' | 'n8n')[];
}

export interface PlanCatalogItem {
  id: 'free' | 'pro' | 'team';
  label: string;
  maxSubscriptions: number | null;
  channels: ('email' | 'n8n')[];
  maxMembers: number | null;
}

export interface PlanCatalog {
  billingEnabled: boolean;
  manualEnabled: boolean;
  plans: PlanCatalogItem[];
}

export interface ParsedInvoice {
  name: string | null;
  amount: number | null;
  currency: string | null;
  expiryDate: string | null;
  frequency: Frequency | null;
  confidence: number;
}

export interface Insights {
  counts: { total: number; active: number; unused: number; cancelled: number };
  totalsByCurrency: Record<string, { monthly: number; yearly: number; count: number }>;
  potentialAnnualSavings: Record<string, number>;
  unused: { id: string; name: string; currency: string; annualSaving: number }[];
  duplicates: { key: string; category: string; items: { id: string; name: string }[] }[];
  cutCandidates: {
    id: string;
    name: string;
    reason: 'unused' | 'duplicate';
    currency: string;
    annualSaving: number;
  }[];
  upcomingExpensive: { id: string; name: string; daysLeft: number; amount: number; currency: string }[];
}

export interface ReminderConfig {
  channels: ('email' | 'n8n')[];
  thresholds: number[];
  cron: string;
  schedulerEnabled: boolean;
  timezone: string;
}

export interface ReminderHistoryEntry {
  id: string;
  subscriptionId: string;
  name: string;
  category: string | null;
  thresholdDays: number;
  channel: 'email' | 'n8n';
  sentAt: string;
}
