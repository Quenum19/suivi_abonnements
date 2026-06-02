import { describe, it, expect } from 'vitest';
import { parseInvoice } from '../src/lib/invoiceParser.js';

describe('parseInvoice', () => {
  it('extrait montant, devise, date et fréquence d’un e-mail FR', () => {
    const r = parseInvoice({
      subject: 'Votre facture Canva Pro',
      body: 'Merci ! Montant : 59,88 € — prochain renouvellement le 29/05/2027 (abonnement annuel).',
    });
    expect(r.amount).toBeCloseTo(59.88, 2);
    expect(r.currency).toBe('EUR');
    expect(r.expiryDate).toBe('2027-05-29');
    expect(r.frequency).toBe('yearly');
    expect(r.name?.toLowerCase()).toContain('canva');
  });

  it('gère FCFA et format de date AAAA-MM-JJ + mensuel', () => {
    const r = parseInvoice({
      subject: 'Reçu hébergement',
      text: 'Total 15000 FCFA / mois. Expire le 2026-12-01.',
    });
    expect(r.currency).toBe('XOF');
    expect(r.amount).toBe(15000);
    expect(r.expiryDate).toBe('2026-12-01');
    expect(r.frequency).toBe('monthly');
  });

  it('gère une date littérale « 1 juillet 2027 » et le dollar', () => {
    const r = parseInvoice({ subject: 'Invoice', body: 'Amount $12.00, renews 1 juillet 2027' });
    expect(r.currency).toBe('USD');
    expect(r.amount).toBe(12);
    expect(r.expiryDate).toBe('2027-07-01');
  });

  it('renvoie des nulls quand rien n’est détecté', () => {
    const r = parseInvoice({ subject: '', body: 'bonjour' });
    expect(r.expiryDate).toBeNull();
    expect(r.amount).toBeNull();
  });
});
