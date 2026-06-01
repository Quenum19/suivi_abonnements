import type { Status } from '../types';

const MAP: Record<Status, string> = {
  safe: 'bg-safe-bg text-safe',
  soon: 'bg-soon-bg text-soon',
  urgent: 'bg-urgent-bg text-urgent',
};

export function StatusBadge({ status, label }: { status: Status; label: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${MAP[status]}`}>
      {label}
    </span>
  );
}
