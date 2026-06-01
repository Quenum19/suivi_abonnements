import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env.js';
import { formatAmount } from '../lib/currency.js';

/** Charge utile envoyée au webhook n8n (format imposé par le cahier des charges). */
export interface ReminderPayload {
  name: string;
  category: string;
  expiry: string; // ISO (AAAA-MM-JJ)
  daysLeft: number;
  amount: number | null;
  currency: string | null;
}

export type Channel = 'email' | 'n8n';

let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!env.EMAIL_ENABLED) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/** Canaux activés par la configuration. */
export function enabledChannels(): Channel[] {
  const c: Channel[] = [];
  if (env.EMAIL_ENABLED) c.push('email');
  if (env.N8N_ENABLED) c.push('n8n');
  return c;
}

async function sendEmail(p: ReminderPayload): Promise<void> {
  const t = getTransporter();
  if (!t) throw new Error('Canal email désactivé ou SMTP non configuré.');
  const amountTxt = p.amount != null ? formatAmount(p.amount, p.currency ?? 'EUR') : '—';
  const when =
    p.daysLeft < 0 ? `dépassée depuis ${Math.abs(p.daysLeft)} j` : `dans ${p.daysLeft} j`;
  await t.sendMail({
    from: env.EMAIL_FROM,
    to: env.EMAIL_TO,
    subject: `⏰ Échéance abonnement : ${p.name} (${when})`,
    text: `L'abonnement « ${p.name} » (${p.category}) arrive à échéance le ${p.expiry} — ${when}.\nMontant : ${amountTxt}.`,
    html: `<p>L'abonnement <b>${p.name}</b> (${p.category}) arrive à échéance le <b>${p.expiry}</b> — ${when}.</p><p>Montant : ${amountTxt}.</p>`,
  });
}

async function sendN8n(p: ReminderPayload): Promise<void> {
  if (!env.N8N_ENABLED || !env.N8N_WEBHOOK_URL) {
    throw new Error('Canal n8n désactivé ou N8N_WEBHOOK_URL non configurée.');
  }
  const res = await fetch(env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: p.name,
      category: p.category,
      expiry: p.expiry,
      daysLeft: p.daysLeft,
      amount: p.amount,
    }),
  });
  if (!res.ok) {
    throw new Error(`Webhook n8n a répondu ${res.status} ${res.statusText}`);
  }
}

/** Envoie un rappel sur un canal donné. Lance une erreur en cas d'échec. */
export async function notify(channel: Channel, payload: ReminderPayload): Promise<void> {
  if (channel === 'email') return sendEmail(payload);
  return sendN8n(payload);
}

/** Charge utile de démonstration pour tester un canal. */
export function samplePayload(): ReminderPayload {
  return {
    name: 'Abonnement de test',
    category: 'Test',
    expiry: new Date().toISOString().slice(0, 10),
    daysLeft: 7,
    amount: 9.99,
    currency: 'EUR',
  };
}
