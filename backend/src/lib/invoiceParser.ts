/**
 * Parser heuristique de facture / e-mail de renouvellement.
 * Extrait, en best-effort, le fournisseur, le montant, la devise, la date
 * d'échéance et la périodicité depuis un texte brut (objet + corps d'e-mail).
 * Volontairement sans IA : rapide, déterministe et testable. L'utilisateur
 * relit/corrige toujours avant l'enregistrement.
 */

export interface ParsedInvoice {
  name: string | null;
  amount: number | null;
  currency: string | null;
  expiryDate: string | null; // AAAA-MM-JJ
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one_time' | null;
  confidence: number; // 0..1 indicatif
}

const CURRENCY_MAP: Record<string, string> = {
  '€': 'EUR',
  eur: 'EUR',
  euro: 'EUR',
  euros: 'EUR',
  $: 'USD',
  usd: 'USD',
  fcfa: 'XOF',
  cfa: 'XOF',
  xof: 'XOF',
};

function detectCurrency(text: string): string | null {
  const lower = text.toLowerCase();
  for (const key of Object.keys(CURRENCY_MAP)) {
    if (lower.includes(key)) return CURRENCY_MAP[key];
  }
  return null;
}

function normalizeNumber(raw: string): number {
  // Normalise « 1 234,56 » / « 1,234.56 » / « 59.88 » → nombre JS.
  let s = raw.replace(/\s/g, '');
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  return Number(s);
}

function detectAmount(text: string): number | null {
  // N'accepte QUE des nombres adjacents à un marqueur de devise (évite les dates).
  const cur = '€|\\$|eur|usd|fcfa|cfa|xof';
  const num = '\\d[\\d .,]*\\d|\\d';
  const re = new RegExp(`(?:(?:${cur})\\s?(${num}))|(?:(${num})\\s?(?:${cur}))`, 'gi');
  let best: number | null = null;
  for (const m of text.matchAll(re)) {
    const raw = m[1] ?? m[2];
    if (!raw) continue;
    const n = normalizeNumber(raw);
    if (Number.isFinite(n) && n > 0 && (best === null || n > best)) best = n;
  }
  return best;
}

const MONTHS: Record<string, number> = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function detectDate(text: string): string | null {
  const candidates: string[] = [];

  // AAAA-MM-JJ
  for (const m of text.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)) {
    candidates.push(`${m[1]}-${m[2]}-${m[3]}`);
  }
  // JJ/MM/AAAA ou JJ-MM-AAAA ou JJ.MM.AAAA
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g)) {
    const day = Number(m[1]);
    const mon = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12) {
      candidates.push(`${year}-${pad(mon)}-${pad(day)}`);
    }
  }
  // « 29 mai 2027 »
  for (const m of text.matchAll(/\b(\d{1,2})\s+([a-zéûôA-Z]+)\s+(\d{4})\b/g)) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon) candidates.push(`${m[3]}-${pad(mon)}-${pad(Number(m[1]))}`);
  }

  if (candidates.length === 0) return null;
  // Préfère une date future ; sinon la plus tardive.
  const today = new Date().toISOString().slice(0, 10);
  const future = candidates.filter((c) => c >= today).sort();
  return (future[0] ?? candidates.sort().reverse()[0]) || null;
}

function detectFrequency(text: string): ParsedInvoice['frequency'] {
  const t = text.toLowerCase();
  if (/(\/\s?an|annuel|annual|yearly|par an|\/year)/.test(t)) return 'yearly';
  if (/(trimestriel|quarterly|\/\s?trimestre)/.test(t)) return 'quarterly';
  if (/(hebdo|weekly|\/\s?semaine|par semaine)/.test(t)) return 'weekly';
  if (/(\/\s?mois|mensuel|monthly|par mois|\/month)/.test(t)) return 'monthly';
  return null;
}

function detectName(subject: string, body: string): string | null {
  const fromSubject = subject
    .replace(/(facture|invoice|reçu|receipt|renouvellement|renewal|abonnement|subscription|votre|your|#\w+)/gi, '')
    .replace(/[-–:|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (fromSubject.length >= 2) return fromSubject.slice(0, 80);
  const firstLine = body.split(/\r?\n/).find((l) => l.trim().length > 1);
  return firstLine ? firstLine.trim().slice(0, 80) : null;
}

export function parseInvoice(input: { subject?: string; body?: string; text?: string }): ParsedInvoice {
  const subject = (input.subject ?? '').trim();
  const body = (input.body ?? input.text ?? '').trim();
  const all = `${subject}\n${body}`;

  const amount = detectAmount(all);
  const currency = detectCurrency(all);
  const expiryDate = detectDate(all);
  const frequency = detectFrequency(all);
  const name = detectName(subject, body);

  const hits = [amount, currency, expiryDate, frequency, name].filter((v) => v != null).length;
  return { name, amount, currency, expiryDate, frequency, confidence: hits / 5 };
}
