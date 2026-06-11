import { useEffect, useRef, useState } from 'react';

export interface MenuAction {
  label: string;
  icon?: string;
  onClick?: () => void;
  href?: string;
  target?: string;
  divider?: boolean; // séparateur au-dessus
  danger?: boolean; // style « destructif » (déconnexion)
  hint?: string; // texte secondaire à droite (ex. plan)
}

/** Bouton de barre d'outils ouvrant un menu déroulant d'actions. */
export function Menu({
  label,
  actions,
  header,
}: {
  label: React.ReactNode;
  actions: MenuAction[];
  header?: React.ReactNode;
}) {
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
        <>
          <div className="fixed inset-0 z-40 bg-black/30 sm:hidden" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-auto rounded-t-2xl border border-line bg-card p-1.5 shadow-card-hover sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:mt-2 sm:w-64 sm:rounded-2xl">
            {header && (
              <div className="mb-1 border-b border-line px-2.5 pb-3 pt-1.5">{header}</div>
            )}
            {actions.map((a, i) => {
              const tone = a.danger ? 'text-urgent' : 'text-ink';
              const iconCls = a.danger ? 'bg-urgent-bg' : 'bg-paper';
              const body = (
                <>
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-[14px] ${iconCls}`}
                  >
                    {a.icon ?? '•'}
                  </span>
                  <span className="flex-1 truncate">{a.label}</span>
                  {a.hint && (
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                      {a.hint}
                    </span>
                  )}
                </>
              );
              const cls = `flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm font-medium ${tone} transition hover:bg-paper`;
              return (
                <div key={i}>
                  {a.divider && <div className="my-1 h-px bg-line" />}
                  {a.href ? (
                    <a href={a.href} target={a.target} rel="noreferrer" className={cls} onClick={() => setOpen(false)}>
                      {body}
                    </a>
                  ) : (
                    <button
                      className={cls}
                      onClick={() => {
                        setOpen(false);
                        a.onClick?.();
                      }}
                    >
                      {body}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
