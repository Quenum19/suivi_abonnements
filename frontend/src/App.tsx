import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReminderConfig, Session, Subscription, SubscriptionInput } from './types';
import { api } from './api';
import { AuthScreen } from './components/AuthScreen';
import { SummaryBar } from './components/SummaryBar';
import { SubscriptionCard } from './components/SubscriptionCard';
import { SubscriptionModal } from './components/SubscriptionModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { InsightsDrawer } from './components/InsightsDrawer';
import { PasteInvoiceModal } from './components/PasteInvoiceModal';
import { PlanModal } from './components/PlanModal';
import { SettingsModal } from './components/SettingsModal';
import { TeamModal } from './components/TeamModal';
import { AdminDashboard } from './components/AdminDashboard';
import { NotificationsBell } from './components/NotificationsBell';
import { Menu } from './components/Menu';
import { Onboarding } from './components/Onboarding';
import { applyBranding } from './lib/branding';
import { applyTheme, getInitialTheme, type Theme } from './lib/theme';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lifecycleFilter, setLifecycleFilter] = useState<'all' | 'active' | 'unused' | 'cancelled'>('all');
  const [sortBy, setSortBy] = useState<'expiry' | 'cost' | 'name'>('expiry');
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [draft, setDraft] = useState<Partial<SubscriptionInput> | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [notifKey, setNotifKey] = useState(0);

  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
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
      setNotifKey((k) => k + 1); // rafraîchit la cloche
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Vérifie la session au démarrage. Le super-admin atterrit sur la console.
  useEffect(() => {
    api
      .me()
      .then((s) => {
        setSession(s);
        if (s.user.isSuperAdmin) setAdminOpen(true);
      })
      .catch(() => setSession(null))
      .finally(() => setAuthReady(true));
  }, []);

  function handleAuth(s: typeof session) {
    setSession(s);
    if (s?.user.isSuperAdmin) setAdminOpen(true);
  }

  // Charge les données une fois connecté.
  useEffect(() => {
    if (!session) return;
    api.reminderConfig().then(setConfig).catch(() => undefined);
    load();
  }, [session, load]);

  // Applique la couleur de marque de l'organisation.
  useEffect(() => {
    applyBranding(session?.organization.brandColor ?? null);
  }, [session]);

  // Thème clair/sombre.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Onboarding : une seule fois par utilisateur (hors super-admin).
  useEffect(() => {
    if (!session || session.user.isSuperAdmin) return;
    const key = `subs-onboarded:${session.user.id}`;
    if (!localStorage.getItem(key)) {
      setOnboardingOpen(true);
      localStorage.setItem(key, '1');
    }
  }, [session]);

  async function handleLogout() {
    await api.logout().catch(() => undefined);
    setSession(null);
    setSubs([]);
  }

  // Filtrage client (la recherche serveur existe aussi ; ici instantané).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subs.filter(
      (s) =>
        (!categoryFilter || s.category === categoryFilter) &&
        (lifecycleFilter === 'all' || s.lifecycle === lifecycleFilter) &&
        (!q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)),
    );
  }, [subs, search, categoryFilter, lifecycleFilter]);

  // Regroupement par catégorie + tri secondaire configurable.
  const grouped = useMemo(() => {
    const cmp = (a: Subscription, b: Subscription) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'fr');
      if (sortBy === 'cost') return (b.annualCost ?? 0) - (a.annualCost ?? 0);
      return a.daysLeft - b.daysLeft; // expiry
    };
    const map = new Map<string, Subscription[]>();
    for (const s of filtered) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .map(([cat, items]) => [cat, items.sort(cmp)] as const);
  }, [filtered, sortBy]);

  const allCategories = useMemo(
    () => [...new Set(subs.map((s) => s.category))].sort((a, b) => a.localeCompare(b, 'fr')),
    [subs],
  );

  // Garde d'authentification (après tous les hooks → règles des Hooks respectées).
  if (!authReady) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Chargement…</div>;
  }
  if (!session) {
    return <AuthScreen onAuth={handleAuth} />;
  }

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
        <div className="flex items-center gap-3">
          {session.organization.logoUrl && (
            <img
              src={session.organization.logoUrl}
              alt="logo"
              className="h-12 w-12 rounded-xl border border-line object-contain bg-card p-1"
            />
          )}
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
              Tableau de bord
            </div>
            <h1 className="font-display text-[28px] font-semibold leading-none tracking-tight sm:text-[38px]">
              Échéances d'abonnements
            </h1>
            <div className="mt-1.5 hidden text-sm text-muted sm:block">
              Suivi des dates de renouvellement de tes comptes
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.user.isSuperAdmin && (
            <button
              onClick={() => setAdminOpen(true)}
              title="Console admin"
              className="rounded-xl border border-brand bg-brand-soft px-3 py-3 text-sm font-semibold text-brand"
            >
              ★ Admin
            </button>
          )}
          <NotificationsBell refreshKey={notifKey} />
          <button
            onClick={() => {
              setEditing(null);
              setDraft(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-brand px-[18px] py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110"
          >
            ＋ Ajouter
          </button>
          <Menu
            label={
              <span className="flex items-center gap-2">
                {session.organization.logoUrl ? (
                  <img
                    src={session.organization.logoUrl}
                    alt=""
                    className="h-6 w-6 rounded-md bg-card object-contain"
                  />
                ) : (
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-brand text-[10px] font-bold text-white">
                    {orgInitials(session.organization.name)}
                  </span>
                )}
                <span className="hidden text-left sm:block">
                  <span className="block text-[13px] font-semibold leading-tight">
                    {session.organization.name}
                  </span>
                  <span className="block text-[10px] uppercase tracking-wide text-brand">
                    plan {session.organization.plan}
                  </span>
                </span>
              </span>
            }
            actions={[
              { label: `💳 Mon plan (${session.organization.plan})`, onClick: () => setPlanOpen(true) },
              ...(session.user.isSuperAdmin
                ? [{ label: '★ Console admin', onClick: () => setAdminOpen(true) }]
                : []),
              { label: '👥 Équipe & membres', onClick: () => setTeamOpen(true) },
              { label: '🎨 Personnalisation', onClick: () => setSettingsOpen(true) },
              {
                label: theme === 'dark' ? '☀️ Mode clair' : '🌙 Mode sombre',
                onClick: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
                divider: true,
              },
              { label: '⎋ Se déconnecter', onClick: handleLogout },
            ]}
          />
        </div>
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
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'expiry' | 'cost' | 'name')}
          title="Trier"
          className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-brand"
        >
          <option value="expiry">Tri : échéance</option>
          <option value="cost">Tri : coût ↓</option>
          <option value="name">Tri : nom</option>
        </select>
        <ToolbarButton onClick={() => setInsightsOpen(true)}>💡 Économies</ToolbarButton>
        <Menu
          label="🔔 Rappels"
          actions={[
            { label: '🔔 Vérifier maintenant', onClick: handleRunReminders },
            { label: '🕘 Historique des envois', onClick: () => setHistoryOpen(true) },
          ]}
        />
        <Menu
          label="⤓ Données"
          actions={[
            { label: '📅 Calendrier (.ics)', href: api.calendarUrl(session.organization.calendarToken), target: '_blank' },
            { label: '📄 Rapport PDF', href: api.reportPdfUrl(), target: '_blank' },
            { label: '⬇ Exporter en JSON', href: api.exportUrl('json'), divider: true },
            { label: '⬇ Exporter en CSV', href: api.exportUrl('csv') },
            { label: '🧾 Importer une facture', onClick: () => setPasteOpen(true), divider: true },
            { label: '⬆ Importer un fichier JSON', onClick: () => fileRef.current?.click() },
          ]}
        />
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={handleImport} />
      </div>

      {/* Filtres de statut */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(
          [
            ['all', 'Tous'],
            ['active', 'Actifs'],
            ['unused', 'Inutilisés'],
            ['cancelled', 'Annulés'],
          ] as const
        ).map(([key, label]) => {
          const count = key === 'all' ? subs.length : subs.filter((s) => s.lifecycle === key).length;
          if (key !== 'all' && key !== 'active' && count === 0) return null;
          const isActive = lifecycleFilter === key;
          return (
            <button
              key={key}
              onClick={() => setLifecycleFilter(key)}
              className={`rounded-full border px-3 py-1 text-[13px] font-medium transition ${
                isActive
                  ? 'border-brand bg-brand text-white'
                  : 'border-line bg-card text-muted hover:border-muted'
              }`}
            >
              {label} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {config && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>
            Rappels à <b className="font-semibold text-ink">{config.thresholds.join(', ')} j</b> avant l'échéance
          </span>
          <span aria-hidden>·</span>
          <span>
            {config.channels.length ? (
              <>
                par <b className="font-semibold text-ink">{config.channels.join(' + ')}</b>
              </>
            ) : (
              <span className="text-soon">aucun canal actif</span>
            )}
          </span>
          <span aria-hidden>·</span>
          <span>
            {config.schedulerEnabled
              ? `automatique ${humanCron(config.cron)} (${config.timezone})`
              : 'planificateur désactivé'}
          </span>
        </div>
      )}

      {!loading && !error && <SummaryBar subs={subs} />}

      {error && (
        <div className="my-6 rounded-2xl border border-urgent/30 bg-urgent-bg px-4 py-3 text-sm text-urgent">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-line bg-card/60" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        subs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card/60 px-6 py-16 text-center">
            <div className="text-4xl">🗓️</div>
            <h3 className="mt-3 font-display text-xl font-semibold">Aucun abonnement pour l'instant</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Ajoute ton premier abonnement, ou importe une facture / un fichier existant.
            </p>
            <button
              onClick={() => {
                setEditing(null);
                setDraft(null);
                setModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              ＋ Ajouter un abonnement
            </button>
          </div>
        ) : (
          <div className="py-16 text-center text-muted">Aucun résultat pour ce filtre.</div>
        )
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
        initial={draft}
        categories={allCategories}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setDraft(null);
        }}
        onSave={handleSave}
      />

      <PasteInvoiceModal
        open={pasteOpen}
        session={session}
        onClose={() => setPasteOpen(false)}
        onToast={showToast}
        onParsed={(d) => {
          setEditing(null);
          setDraft(d);
          setPasteOpen(false);
          setModalOpen(true);
        }}
      />

      <PlanModal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        onToast={showToast}
        onChanged={() => api.me().then(setSession).catch(() => undefined)}
      />

      <SettingsModal
        open={settingsOpen}
        session={session}
        onClose={() => setSettingsOpen(false)}
        onToast={showToast}
        onSaved={() => api.me().then(setSession).catch(() => undefined)}
      />

      <TeamModal
        open={teamOpen}
        session={session}
        onClose={() => setTeamOpen(false)}
        onToast={showToast}
      />

      <Onboarding
        open={onboardingOpen}
        orgName={session.organization.name}
        onClose={() => setOnboardingOpen(false)}
        onAdd={() => {
          setEditing(null);
          setDraft(null);
          setModalOpen(true);
        }}
        onCustomize={() => setSettingsOpen(true)}
        onReminders={() => setHistoryOpen(true)}
      />

      {adminOpen && <AdminDashboard onClose={() => setAdminOpen(false)} onToast={showToast} />}

      <HistoryDrawer
        open={historyOpen}
        config={config}
        onClose={() => setHistoryOpen(false)}
        onToast={showToast}
      />

      <InsightsDrawer
        open={insightsOpen}
        onClose={() => setInsightsOpen(false)}
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

/** Initiales d'une organisation pour l'avatar par défaut. */
function orgInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** "0 8 * * *" → "tous les jours à 08:00" (sinon renvoie le cron brut). */
function humanCron(cron: string): string {
  const p = cron.trim().split(/\s+/);
  if (p.length === 5 && p[2] === '*' && p[3] === '*' && p[4] === '*') {
    const m = Number(p[0]);
    const h = Number(p[1]);
    if (Number.isFinite(m) && Number.isFinite(h)) {
      return `tous les jours à ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  return cron;
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
