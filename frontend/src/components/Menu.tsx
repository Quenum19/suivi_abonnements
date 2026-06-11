import { useEffect, useRef, useState } from 'react';

export interface MenuAction {
  label: string;
  onClick?: () => void;
  href?: string;
  target?: string;
  divider?: boolean; // affiche un séparateur au-dessus
}

/** Bouton de barre d'outils ouvrant un menu déroulant d'actions. */
export function Menu({ label, actions }: { label: React.ReactNode; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2.5 text-sm font-medium text-ink transition hover:border-muted hover:bg-paper"
      >
        {label}
        <span className={`text-[10px] text-muted transition ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-card p-1 shadow-card-hover">
          {actions.map((a, i) => {
            const cls =
              'block w-full rounded-lg px-3 py-2 text-left text-sm text-ink transition hover:bg-paper';
            const inner = (
              <>
                {a.divider && <div className="my-1 h-px bg-line" />}
                {a.href ? (
                  <a href={a.href} target={a.target} rel="noreferrer" className={cls} onClick={() => setOpen(false)}>
                    {a.label}
                  </a>
                ) : (
                  <button
                    className={cls}
                    onClick={() => {
                      setOpen(false);
                      a.onClick?.();
                    }}
                  >
                    {a.label}
                  </button>
                )}
              </>
            );
            return <div key={i}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
