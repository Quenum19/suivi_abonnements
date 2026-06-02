import { useEffect, useRef, useState } from 'react';
import type { AppNotification } from '../types';
import { api } from '../api';

const DOT: Record<AppNotification['severity'], string> = {
  urgent: 'bg-urgent',
  soon: 'bg-soon',
  info: 'bg-brand',
};

export function NotificationsBell({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function load() {
    api
      .notifications()
      .then((d) => setItems(d.items))
      .catch(() => undefined);
  }

  useEffect(() => load(), [refreshKey]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        title="Notifications"
        className="relative rounded-xl border border-line bg-card px-3 py-3 text-sm text-muted transition hover:border-muted hover:text-ink"
      >
        🔔
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-urgent px-1 text-[11px] font-bold text-white">
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-[60vh] w-[320px] overflow-auto rounded-2xl border border-line bg-card p-2 shadow-card-hover">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted">Rien à signaler 👍</div>
          ) : (
            <ul className="flex flex-col">
              {items.map((n) => (
                <li key={n.id} className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 hover:bg-paper">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[n.severity]}`} />
                  <div>
                    <div className="text-sm font-semibold">{n.title}</div>
                    <div className="text-[12.5px] text-muted">{n.subtitle}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
