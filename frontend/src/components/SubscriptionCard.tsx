import type { Status, Subscription } from '../types';
import { dayCountLabel, formatDate } from '../lib/dates';
import { formatAmount } from '../lib/currency';
import { StatusBadge } from './StatusBadge';

const BORDER: Record<Status, string> = {
  safe: 'border-l-safe',
  soon: 'border-l-soon',
  urgent: 'border-l-urgent',
};
const BAR: Record<Status, string> = { safe: 'bg-safe', soon: 'bg-soon', urgent: 'bg-urgent' };
const NUM: Record<Status, string> = { safe: 'text-safe', soon: 'text-soon', urgent: 'text-urgent' };

export function SubscriptionCard({
  sub,
  onEdit,
  onDelete,
}: {
  sub: Subscription;
  onEdit: (s: Subscription) => void;
  onDelete: (s: Subscription) => void;
}) {
  const { value, unit } = dayCountLabel(sub.daysLeft);
  return (
    <div
      className={`relative grid grid-cols-1 items-center gap-4 rounded-2xl border border-line border-l-4 ${BORDER[sub.status]} bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover sm:grid-cols-[1fr_auto]`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2.5 text-[17px] font-bold">
          {sub.name}
          <StatusBadge status={sub.status} label={sub.statusLabel} />
          {sub.lifecycle === 'unused' && (
            <span className="rounded-full bg-soon-bg px-2 py-0.5 text-[11px] font-bold text-soon">
              Inutilisé
            </span>
          )}
          {sub.lifecycle === 'cancelled' && (
            <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-bold text-muted">
              Annulé
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
          <span>
            Début : <b className="font-semibold text-ink">{formatDate(sub.startDate)}</b>
          </span>
          <span>
            Échéance : <b className="font-semibold text-ink">{formatDate(sub.expiryDate)}</b>
          </span>
          {sub.amount != null && (
            <span>
              Montant :{' '}
              <b className="font-semibold text-ink">{formatAmount(sub.amount, sub.currency)}</b>
            </span>
          )}
        </div>
        {sub.notes && <div className="mt-2 text-[12.5px] italic leading-snug text-muted">{sub.notes}</div>}
        <div className="mt-3 h-[5px] overflow-hidden rounded bg-line">
          <i
            className={`block h-full rounded ${BAR[sub.status]}`}
            style={{ width: `${sub.progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
        <div className="text-right font-display leading-none">
          <span className={`text-[40px] font-semibold ${NUM[sub.status]}`}>{value}</span>
          <span className="mt-0.5 block font-sans text-[13px] font-semibold tracking-wide text-muted">
            {unit}
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            title="Modifier"
            onClick={() => onEdit(sub)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition hover:border-muted hover:bg-paper hover:text-ink"
          >
            ✎
          </button>
          <button
            title="Supprimer"
            onClick={() => onDelete(sub)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition hover:border-muted hover:bg-paper hover:text-ink"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}
