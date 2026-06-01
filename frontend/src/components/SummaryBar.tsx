import type { Subscription } from '../types';
import { formatDate } from '../lib/dates';
import { estimateMonthly, formatAmount } from '../lib/currency';

function Stat({ label, big, sub }: { label: string; big: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 px-[18px] shadow-card">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1.5 font-display text-[30px] font-semibold leading-none">{big}</div>
      <div className="mt-1.5 text-[13px] text-muted">{sub}</div>
    </div>
  );
}

export function SummaryBar({ subs }: { subs: Subscription[] }) {
  const categories = new Set(subs.map((s) => s.category)).size;
  const upcoming = subs.filter((s) => s.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft);
  const next = upcoming[0];
  const soonCount = subs.filter((s) => s.daysLeft >= 0 && s.daysLeft <= 60).length;

  // Totaux par devise (mensuel + annuel estimés).
  const totals: Record<string, { monthly: number; yearly: number }> = {};
  for (const s of subs) {
    if (s.amount == null) continue;
    const cur = s.currency || 'EUR';
    const monthly = estimateMonthly(s.amount, s.startDate, s.expiryDate);
    totals[cur] = totals[cur] ?? { monthly: 0, yearly: 0 };
    totals[cur].monthly += monthly;
    totals[cur].yearly += monthly * 12;
  }
  const currencyEntries = Object.entries(totals);

  return (
    <div className="my-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Abonnements suivis"
          big={String(subs.length)}
          sub={`dans ${categories} catégorie(s)`}
        />
        <Stat
          label="Prochaine échéance"
          big={next ? `${next.daysLeft} j` : '—'}
          sub={next ? `${next.name} · ${formatDate(next.expiryDate)}` : 'aucune à venir'}
        />
        <Stat
          label="À surveiller (≤ 60 j)"
          big={String(soonCount)}
          sub={soonCount ? 'à renouveler bientôt' : "rien d'urgent"}
        />
      </div>

      {currencyEntries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {currencyEntries.map(([cur, t]) => (
            <span
              key={cur}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-[13px] text-muted shadow-card"
            >
              <b className="font-semibold text-ink">{cur}</b> · {formatAmount(t.monthly, cur)}/mois ·{' '}
              {formatAmount(t.yearly, cur)}/an
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
