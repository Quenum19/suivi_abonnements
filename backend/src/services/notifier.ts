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
  // Enrichissements (non-breaking) pour le routage des rappels dans n8n :
  responsible?: string | null; // nom / e-mail / n° WhatsApp à relancer
  frequency?: string;
}

export type Channel = 'email' | 'n8n';

let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!env.EMAIL_ENABLED) return null;
  if (!env.SMTP_HOST) throw new Error('SMTP_HOST manquant : configure le serveur SMTP dans .env.');
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // secure=true pour le port 465 ; sinon STARTTLS (587).
      secure: env.SMTP_SECURE || env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      pool: true,
      maxConnections: 3,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

/** Liste des destinataires (EMAIL_TO peut contenir plusieurs adresses séparées par des virgules). */
function recipients(): string[] {
  return env.EMAIL_TO.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Vérifie la connexion SMTP (handshake + auth) sans envoyer d'e-mail.
 * Utilisé au démarrage et par l'endpoint de test pour un diagnostic clair.
 */
export async function verifyEmail(): Promise<void> {
  const t = getTransporter();
  if (!t) throw new Error('Canal email désactivé (EMAIL_ENABLED=false).');
  if (recipients().length === 0) throw new Error('EMAIL_TO manquant : aucun destinataire configuré.');
  await t.verify();
}

/** Canaux activés par la configuration. */
export function enabledChannels(): Channel[] {
  const c: Channel[] = [];
  if (env.EMAIL_ENABLED) c.push('email');
  if (env.N8N_ENABLED) c.push('n8n');
  return c;
}

function emailHtml(p: ReminderPayload, amountTxt: string, when: string): string {
  const color = p.daysLeft < 0 || p.daysLeft <= 30 ? '#B23A2E' : p.daysLeft <= 60 ? '#B5791C' : '#2E7D52';
  const dayBig = p.daysLeft < 0 ? `+${Math.abs(p.daysLeft)}` : String(p.daysLeft);
  const unit = p.daysLeft < 0 ? 'jours de retard' : 'jours restants';
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#F7F3EC;padding:24px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E5DDCF;border-left:5px solid ${color};border-radius:14px;padding:24px">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#1F4D46;font-weight:700">Rappel d'échéance</div>
      <h1 style="margin:6px 0 2px;font-size:22px;color:#1B1A17">${p.name}</h1>
      <div style="color:#6E685D;font-size:14px">${p.category}</div>
      <div style="margin:18px 0;font-size:40px;font-weight:700;color:${color};line-height:1">
        ${dayBig} <span style="font-size:14px;color:#6E685D;font-weight:600">${unit}</span>
      </div>
      <table style="width:100%;font-size:14px;color:#1B1A17;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#6E685D">Échéance</td><td style="text-align:right;font-weight:600">${p.expiry} (${when})</td></tr>
        <tr><td style="padding:4px 0;color:#6E685D">Montant</td><td style="text-align:right;font-weight:600">${amountTxt}</td></tr>
      </table>
      <p style="margin-top:20px;font-size:12px;color:#6E685D">Envoyé automatiquement par ton suivi d'abonnements.</p>
    </div>
  </div>`;
}

async function sendEmail(p: ReminderPayload, override?: string): Promise<void> {
  const t = getTransporter();
  if (!t) throw new Error('Canal email désactivé ou SMTP non configuré.');
  // Destinataire = adresse propre du compte (override) sinon EMAIL_TO global.
  const to = override ? [override] : recipients();
  if (to.length === 0) throw new Error('Aucun destinataire e-mail (adresse du compte manquante).');
  const amountTxt = p.amount != null ? formatAmount(p.amount, p.currency ?? 'EUR') : '—';
  const when =
    p.daysLeft < 0 ? `dépassée depuis ${Math.abs(p.daysLeft)} j` : `dans ${p.daysLeft} j`;
  await t.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: `⏰ Échéance : ${p.name} (${when})`,
    text: `L'abonnement « ${p.name} » (${p.category}) arrive à échéance le ${p.expiry} — ${when}.\nMontant : ${amountTxt}.`,
    html: emailHtml(p, amountTxt, when),
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
      // Format historique (ne pas casser les scénarios n8n existants) :
      name: p.name,
      category: p.category,
      expiry: p.expiry,
      daysLeft: p.daysLeft,
      amount: p.amount,
      // Enrichissements pour router vers WhatsApp / email / agenda dans n8n :
      currency: p.currency,
      frequency: p.frequency ?? null,
      responsible: p.responsible ?? null,
      whatsappTo: env.WHATSAPP_TO || null,
    }),
  });
  if (!res.ok) {
    throw new Error(`Webhook n8n a répondu ${res.status} ${res.statusText}`);
  }
}

/**
 * Envoie un rappel sur un canal donné. Lance une erreur en cas d'échec.
 * `emailTo` cible l'adresse propre de l'organisation (multi-tenant).
 */
export async function notify(
  channel: Channel,
  payload: ReminderPayload,
  emailTo?: string,
): Promise<void> {
  if (channel === 'email') return sendEmail(payload, emailTo);
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
