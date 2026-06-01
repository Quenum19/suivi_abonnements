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
