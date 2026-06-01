import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReminderConfig, Subscription, SubscriptionInput } from './types';
import { ApiError, api, getAppPassword, setAppPassword } from './api';
import { SummaryBar } from './components/SummaryBar';
import { SubscriptionCard } from './components/SubscriptionCard';
import { SubscriptionModal } from './components/SubscriptionModal';
import { HistoryDrawer } from './components/HistoryDrawer';

export default function App() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);

  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.list();
      setSubs(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setAuthRequired(true);
        promptPassword();
      } else {
        setError(e instanceof Error ? e.message : 'Erreur de chargement.');
      }
    } finally {
      setLoading(false);
    }
    // promptPassword est stable (ne dépend que de fonctions stables).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api
      .authStatus()
      .then((s) => setAuthRequired(s.authRequired))
      .catch(() => undefined);
    api.reminderConfig().then(setConfig).catch(() => undefined);
    load();
  }, [load]);

  function promptPassword() {
    const pw = window.prompt('Mot de passe applicatif requis :', getAppPassword());
    if (pw != null) {
      setAppPassword(pw);
      load();
    }
  }

  // Filtrage client (la recherche serveur existe aussi ; ici instantané).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subs.filter(
      (s) =>
        (!categoryFilter || s.category === categoryFilter) &&
        (!q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)),
    );
  }, [subs, search, categoryFilter]);

  // Regroupement par catégorie, tri secondaire par jours restants croissants.
  const grouped = useMemo(() => {
    const map = new Map<string, Subscription[]>();
    for (const s of filtered) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .map(([cat, items]) => [cat, items.sort((a, b) => a.daysLeft - b.daysLeft)] as const);
  }, [filtered]);

  const allCategories = useMemo(
    () => [...new Set(subs.map((s) => s.category))].sort((a, b) => a.localeCompare(b, 'fr')),
    [subs],
  );

  async function handleSave(input: SubscriptionInput) {
    if (editing) {
      await api.update(editing.id, input);
      showToast('Abonnement modifié.');
    } else {
      await api.create(input);
      showToast('Abonnement ajouté.');
    }
    setModalOpen(false);
    setEditing(null);
    await load();
  }

  async function handleDelete(s: Subscription) {
    if (!window.confirm(`Supprimer « ${s.name} » ?`)) return;
    await api.remove(s.id);
    showToast('Abonnement supprimé.');
    await load();
  }

  async function handleRunReminders() {
    try {
      await api.runReminders(false);
      showToast('Vérification des rappels déclenchée.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Échec du déclenchement.');
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items: SubscriptionInput[] = Array.isArray(parsed) ? parsed : parsed.items;
      const replace = window.confirm(
        'Remplacer les données existantes ? (Annuler = ajouter à la suite)',
      );
      const r = await api.importJson(items, replace);
      showToast(`${r.imported} abonnement(s) importé(s).`);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import impossible (JSON attendu).');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="mx-auto max-w-[880px] px-4 pb-20 pt-7">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Tableau de bord
          </div>
          <h1 className="font-display text-[38px] font-semibold leading-none tracking-tight">
            Échéances d'abonnements
          </h1>
          <div className="mt-1.5 text-sm text-muted">
            Suivi des dates de renouvellement de tes comptes
          </div>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-brand px-[18px] py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110"
        >
          ＋ Ajouter un abonnement
        </button>
      </header>

      {/* Barre d'outils */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="min-w-[160px] flex-1 rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm outline-none focus:border-brand"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-brand"
        >
          <option value="">Toutes catégories</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <ToolbarButton onClick={handleRunReminders}>🔔 Vérifier rappels</ToolbarButton>
        <ToolbarButton onClick={() => setHistoryOpen(true)}>🕘 Historique</ToolbarButton>
        <a href={api.calendarUrl()} target="_blank" rel="noreferrer">
          <ToolbarButton>📅 Calendrier (.ics)</ToolbarButton>
        </a>
        <a href={api.exportUrl('json')}>
          <ToolbarButton>⬇ JSON</ToolbarButton>
        </a>
        <a href={api.exportUrl('csv')}>
          <ToolbarButton>⬇ CSV</ToolbarButton>
        </a>
        <ToolbarButton onClick={() => fileRef.current?.click()}>⬆ Importer</ToolbarButton>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={handleImport} />
        {authRequired && <ToolbarButton onClick={promptPassword}>🔑</ToolbarButton>}
      </div>

      {config && (
        <div className="mt-2 text-xs text-muted">
          Rappels : seuils {config.thresholds.join(', ')} j ·{' '}
          {config.channels.length ? `canaux ${config.channels.join(' + ')}` : 'aucun canal actif'} ·{' '}
          {config.schedulerEnabled ? `planifié (${config.cron}, ${config.timezone})` : 'planificateur off'}
        </div>
      )}

      {!loading && !error && <SummaryBar subs={subs} />}

      {error && (
        <div className="my-6 rounded-2xl border border-urgent/30 bg-urgent-bg px-4 py-3 text-sm text-urgent">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-muted">Chargement…</div>
      ) : grouped.length === 0 ? (
        <div className="py-16 text-center text-muted">
          {subs.length === 0
            ? 'Aucun abonnement. Clique sur « Ajouter » pour commencer.'
            : 'Aucun résultat pour ce filtre.'}
        </div>
      ) : (
        grouped.map(([cat, items]) => (
          <section key={cat} className="mb-7">
            <div className="mb-3 flex items-center gap-2.5">
              <h2 className="font-display text-xl font-semibold">{cat}</h2>
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
                {items.length}
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="flex flex-col gap-3">
              {items.map((s) => (
                <SubscriptionCard
                  key={s.id}
                  sub={s}
                  onEdit={(x) => {
                    setEditing(x);
                    setModalOpen(true);
                  }}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <SubscriptionModal
        open={modalOpen}
        editing={editing}
        categories={allCategories}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />

      <HistoryDrawer
        open={historyOpen}
        config={config}
        onClose={() => setHistoryOpen(false)}
        onToast={showToast}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-paper shadow-card-hover">
          {toast}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm font-medium text-ink transition hover:border-muted hover:bg-paper"
    >
      {children}
    </button>
  );
}
