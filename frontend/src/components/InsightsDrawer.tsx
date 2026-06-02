import { useEffect, useState } from 'react';
import type { Insights } from '../types';
import { api } from '../api';
import { formatAmount } from '../lib/currency';

interface Props {
  open: boolean;
  onClose: () => void;
  onToast: (m: string) => void;
}

export function InsightsDrawer({ open, onClose, onToast }: Props) {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .insights()
      .then(setData)
      .catch((e) => onToast(e instanceof Error ? e.message : 'Erreur insights.'))
      .finally(() => setLoading(false));
  }, [open, onToast]);

  if (!open) return null;

  const savings = data ? Object.entries(data.potentialAnnualSavings) : [];
  const hasSavings = savings.some(([, v]) => v > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside className="flex h-full w-full max-w-[460px] flex-col bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="font-display text-xl font-semibold">💡 Économies</h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:bg-paper hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          {loading || !data ? (
            <div className="py-10 text-center text-muted">Analyse en cours…</div>
          ) : (
            <>
              {/* Économies potentielles */}
              <div className="rounded-2xl border border-line bg-paper p-4">
                <div className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">
                  Économies potentielles / an
                </div>
                {hasSavings ? (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {savings
                      .filter(([, v]) => v > 0)
                      .map(([cur, v]) => (
                        <div key={cur} className="font-display text-3xl font-semibold text-safe">
                          {formatAmount(v, cur)}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-muted">
                    Rien à couper pour l'instant 👍 Marque des abos « inutilisé » pour les détecter.
                  </div>
                )}
              </div>

              {/* Consolidation dans la devise de référence */}
              {data.baseCurrency && data.consolidated && (
                <div className="mt-4 rounded-2xl border border-brand/30 bg-brand-soft p-4">
                  <div className="text-[12.5px] font-semibold uppercase tracking-wide text-brand">
                    Coût total consolidé ({data.baseCurrency})
                  </div>
                  <div className="mt-1 font-display text-2xl font-semibold text-brand">
                    {formatAmount(data.consolidated.yearly, data.baseCurrency)}/an
                  </div>
                  <div className="text-[13px] text-muted">
                    {formatAmount(data.consolidated.monthly, data.baseCurrency)}/mois ·{' '}
                    économies possibles {formatAmount(data.consolidated.savings, data.baseCurrency)}/an
                  </div>
                  {data.unconvertible > 0 && (
                    <div className="mt-1 text-[12px] text-soon">
                      {data.unconvertible} abonnement(s) sans taux de change défini.
                    </div>
                  )}
                </div>
              )}

              {/* Coût total */}
              <div className="mt-4">
                <SectionTitle>Coût total suivi</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.totalsByCurrency).map(([cur, t]) => (
                    <span
                      key={cur}
                      className="rounded-full border border-line bg-paper px-3 py-1.5 text-[13px] text-muted"
                    >
                      <b className="text-ink">{cur}</b> · {formatAmount(t.monthly, cur)}/mois ·{' '}
                      {formatAmount(t.yearly, cur)}/an
                    </span>
                  ))}
                  {Object.keys(data.totalsByCurrency).length === 0 && (
                    <span className="text-sm text-muted">Aucun montant renseigné.</span>
                  )}
                </div>
              </div>

              {/* À couper */}
              <div className="mt-5">
                <SectionTitle>À revoir ({data.cutCandidates.length})</SectionTitle>
                {data.cutCandidates.length === 0 ? (
                  <div className="text-sm text-muted">Aucun candidat.</div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.cutCandidates.map((c) => (
                      <li
                        key={`${c.id}-${c.reason}`}
                        className="flex items-center justify-between rounded-xl border border-line bg-paper px-3 py-2.5"
                      >
                        <div>
                          <div className="text-sm font-semibold">{c.name}</div>
                          <div className="text-[12px] text-muted">
                            {c.reason === 'unused' ? 'Inutilisé' : 'Doublon'}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-safe">
                          −{formatAmount(c.annualSaving, c.currency)}/an
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Doublons */}
              {data.duplicates.length > 0 && (
                <div className="mt-5">
                  <SectionTitle>Doublons détectés</SectionTitle>
                  <ul className="flex flex-col gap-2">
                    {data.duplicates.map((g) => (
                      <li key={g.key} className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm">
                        <b>{g.items.length}×</b> {g.items.map((i) => i.name).join(', ')}
                        <span className="text-muted"> · {g.category}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Renouvellements coûteux à venir */}
              {data.upcomingExpensive.length > 0 && (
                <div className="mt-5">
                  <SectionTitle>Renouvellements coûteux (≤ 60 j)</SectionTitle>
                  <ul className="flex flex-col gap-2">
                    {data.upcomingExpensive.slice(0, 5).map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center justify-between rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
                      >
                        <span className="font-semibold">{u.name}</span>
                        <span className="text-muted">
                          {formatAmount(u.amount, u.currency)} · dans {u.daysLeft} j
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-muted">
      {children}
    </div>
  );
}
