export type Status = 'safe' | 'soon' | 'urgent';

export interface Subscription {
  id: string;
  name: string;
  category: string;
  startDate: string | null;
  expiryDate: string; // AAAA-MM-JJ
  amount: number | null;
  currency: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Champs calculés renvoyés par le serveur :
  daysLeft: number;
  status: Status;
  statusLabel: string;
  progress: number;
}

export interface SubscriptionInput {
  name: string;
  category: string;
  startDate: string | null;
  expiryDate: string;
  amount: number | null;
  currency: string | null;
  notes: string | null;
}

export interface ReminderConfig {
  channels: ('email' | 'n8n')[];
  thresholds: number[];
  cron: string;
  schedulerEnabled: boolean;
  timezone: string;
}
