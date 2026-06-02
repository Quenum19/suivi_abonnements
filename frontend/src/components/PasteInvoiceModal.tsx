import { useState } from 'react';
import type { ParsedInvoice, Session, SubscriptionInput } from '../types';
import { api } from '../api';

interface Props {
  open: boolean;
  session: Session;
  onClose: () => void;
  onParsed: (draft: Partial<SubscriptionInput>) => void;
  onToast: (m: string) => void;
}

export function PasteInvoiceModal({ open, session, onClose, onParsed, onToast }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const inboundUrl = `${location.origin}/api/inbound/${session.organization.inboundToken}`;

  async function analyze() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const d: ParsedInvoice = await api.parseInvoice(text);
      onParsed({
        name: d.name ?? '',
        amount: d.amount,
        currency: d.currency ?? '',
        expiryDate: d.expiryDate ?? '',
        frequency: d.frequency ?? 'yearly',
        category: 'Importé',
      });
      if (!d.expiryDate) {
        onToast('Aucune date détectée — complète-la manuellement.');
      }
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Analyse impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-[520px] overflow-auto rounded-[18px] bg-card p-6 shadow-2xl">
        <h3 className="mb-1 font-display text-2xl font-semibold">Importer une facture</h3>
        <p className="mb-4 text-sm text-muted">
          Colle le texte d'une facture / e-mail de renouvellement. On en extrait
          le montant, la date et la périodicité — tu valides ensuite.
        </p>

        <textarea
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex. Votre facture Canva Pro — Montant : 59,88 € — renouvellement le 29/05/2027 (annuel)."
          className="w-full rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
        />

        <div className="mt-4 flex gap-2.5">
          <button
            className="flex-1 rounded-xl border border-line bg-paper p-3 font-semibold transition hover:bg-line"
            onClick={onClose}
          >
            Fermer
          </button>
          <button
            className="flex-1 rounded-xl bg-brand p-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            onClick={analyze}
            disabled={busy}
          >
            {busy ? '…' : 'Analyser'}
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-line bg-paper p-3">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            Ou : import automatique par e-mail / webhook
          </div>
          <p className="mt-1 text-[12.5px] text-muted">
            Fais transférer tes factures (via ton fournisseur d'e-mail entrant ou
            un nœud n8n) en POST JSON vers cette URL — un abonnement est créé
            automatiquement :
          </p>
          <code className="mt-2 block break-all rounded bg-card px-2 py-1.5 text-[11.5px] text-ink">
            POST {inboundUrl}
          </code>
        </div>
      </div>
    </div>
  );
}
