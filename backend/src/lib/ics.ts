/**
 * AMÉLIORATION — Flux calendrier iCalendar (RFC 5545).
 *
 * Génère un fichier .ics que l'utilisateur peut *importer* ou auquel il peut
 * *s'abonner* (Google Agenda, Apple Calendar, Outlook…). Chaque échéance
 * devient un événement « journée entière » avec un rappel (VALARM) avant la
 * date. C'est un 3ᵉ canal de rappel, zéro configuration, en plus de
 * l'email et du webhook n8n.
 */

import { formatAmount } from './currency.js';

export interface IcsSubscription {
  id: string;
  name: string;
  category: string;
  expiryDate: Date;
  amount: number | null;
  currency: string | null;
  notes: string | null;
}

/** Échappe les caractères spéciaux d'une valeur texte iCalendar. */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Format date « journée entière » : AAAAMMJJ. */
function dateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** Horodatage UTC complet : AAAAMMJJTHHMMSSZ. */
function stamp(d: Date): string {
  return `${dateOnly(d)}T${String(d.getUTCHours()).padStart(2, '0')}${String(
    d.getUTCMinutes(),
  ).padStart(2, '0')}${String(d.getUTCSeconds()).padStart(2, '0')}Z`;
}

/** Plie les lignes à 75 octets (recommandation RFC 5545). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    chunks.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) chunks.push(' ' + rest);
  return chunks.join('\r\n');
}

export function buildIcs(subs: IcsSubscription[], reminderDaysBefore = 7, now = new Date()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Suivi Abonnements//FR//',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Échéances d\'abonnements',
    'X-WR-TIMEZONE:UTC',
  ];

  for (const s of subs) {
    const start = dateOnly(s.expiryDate);
    // DTEND exclusif d'un événement « journée entière » = lendemain.
    const next = new Date(s.expiryDate);
    next.setUTCDate(next.getUTCDate() + 1);
    const end = dateOnly(next);

    const descParts = [`Catégorie : ${s.category}`];
    if (s.amount != null) {
      descParts.push(`Montant : ${formatAmount(s.amount, s.currency ?? 'EUR')}`);
    }
    if (s.notes) descParts.push(s.notes);

    lines.push(
      'BEGIN:VEVENT',
      `UID:sub-${s.id}@suivi-abonnements`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeText(`Échéance — ${s.name}`)}`,
      `DESCRIPTION:${escapeText(descParts.join('\n'))}`,
      `CATEGORIES:${escapeText(s.category)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `TRIGGER:-P${reminderDaysBefore}D`,
      `DESCRIPTION:${escapeText(`Rappel : ${s.name} arrive à échéance`)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
