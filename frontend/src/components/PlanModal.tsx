import { useEffect, useState } from 'react';
import type { BillingStatus, PlanCatalog } from '../types';
import { api } from '../api';

interface Props {
  open: boolean;
  onClose: () => void;
  onToast: (m: string) => void;
  onChanged: () => void; // recharge la session/données après changement de plan
}

export function PlanModal({ open, onClose, onToast, onChanged }: Props) {
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!open) return;
    Promise.all([api.billingPlans(), api.billingStatus()])
      .then(([c, s]) => {
        setCatalog(c);
        setStatus(s);
      })
      .catch((e) => onToast(e instanceof Error ? e.message : 'Erreur facturation.'));
  }, [open, onToast]);

  if (!open) return null;

  async function upgrade(plan: 'pro' | 'team') {
    setBusy(plan);
    try {
      if (catalog?.billingEnabled) {
        const { url } = await api.billingCheckout(plan);
        window.location.href = url; // redirection Stripe Checkout
      } else if (catalog?.manualEnabled) {
        await api.billingActivate(plan);
        onToast(`Plan ${plan} activé.`);
        onChanged();
        onClose();
      } else {
        onToast('Paiement non configuré. Contacte-nous pour activer un plan.');
      }
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setBusy('');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[560px] rounded-[18px] bg-card p-6 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-display text-2xl font-semibold">Votre plan</h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:bg-paper"
          >
            ✕
          </button>
        </div>

        {status && (
          <div className="mb-4 text-sm text-muted">
            Plan actuel : <b className="text-ink">{status.label}</b> · {status.used}
            {status.max != null ? ` / ${status.max}` : ''} abonnement(s)
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {catalog?.plans.map((p) => {
            const current = status?.plan === p.id;
            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-4 ${current ? 'border-brand bg-brand-soft' : 'border-line bg-paper'}`}
              >
                <div className="font-display text-lg font-semibold">{p.label}</div>
                <ul className="mt-2 space-y-1 text-[13px] text-muted">
                  <li>{p.maxSubscriptions == null ? 'Abonnements illimités' : `${p.maxSubscriptions} abonnements`}</li>
                  <li>Canaux : {p.channels.join(' + ')}</li>
                  <li>{p.maxMembers == null ? 'Membres illimités' : `${p.maxMembers} membre(s)`}</li>
                </ul>
                <div className="mt-3">
                  {current ? (
                    <span className="text-[12px] font-semibold text-brand">Plan actuel</span>
                  ) : p.id === 'free' ? (
                    <span className="text-[12px] text-muted">—</span>
                  ) : (
                    <button
                      onClick={() => upgrade(p.id as 'pro' | 'team')}
                      disabled={busy === p.id}
                      className="w-full rounded-xl bg-brand p-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                    >
                      {busy === p.id ? '…' : 'Choisir'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {catalog && !catalog.billingEnabled && (
          <p className="mt-4 text-[12.5px] text-muted">
            {catalog.manualEnabled
              ? 'Paiement par carte non configuré — activation manuelle (Mobile Money / virement) disponible.'
              : 'Le paiement en ligne sera bientôt disponible (Stripe / Mobile Money).'}
          </p>
        )}
      </div>
    </div>
  );
}
