import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppNotification } from '../types';
import { api } from '../api';

const DOT: Record<AppNotification['severity'], string> = {
  urgent: 'bg-urgent',
  soon: 'bg-soon',
  info: 'bg-brand',
};

const SEEN_KEY = 'subs-notif-seen';
// Signature stable : ne re-notifie que si la gravité change (pas chaque jour).
const sig = (n: AppNotification) => `${n.id}:${n.severity}`;

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}
function saveSeen(s: Set<string>) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
}

export function NotificationsBell({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unseen, setUnseen] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api
      .notifications()
      .then((d) => {
        setItems(d.items);
        // Élague les « vus » aux alertes encore présentes (borne la taille).
        const present = new Set(d.items.map(sig));
        const seen = new Set([...loadSeen()].filter((x) => present.has(x)));
        saveSeen(seen);
        setUnseen(d.items.filter((n) => !seen.has(sig(n))).length);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => load(), [refreshKey, load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Ouvrir la cloche = consulter → on marque tout comme lu, le badge disparaît.
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const seen = loadSeen();
      items.forEach((n) => seen.add(sig(n)));
      saveSeen(seen);
      setUnseen(0);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        title="Notifications"
        className="relative rounded-xl border border-line bg-card px-3 py-3 text-sm text-muted transition hover:border-muted hover:text-ink"
      >
        🔔
        {unseen > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-urgent px-1 text-[11px] font-bold text-white">
            {unseen}
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
