import { useCallback, useEffect, useState } from 'react';
import type { AdminOrg, AdminOverview, AdminUser } from '../types';
import { api } from '../api';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function AdminDashboard({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const [tab, setTab] = useState<'orgs' | 'users'>('orgs');
  const [ov, setOv] = useState<AdminOverview | null>(null);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgSort, setOrgSort] = useState('subs');

  const reload = useCallback(() => {
    api.adminOverview().then(setOv).catch((e) => onToast(e.message));
    api.adminOrgs(orgSort).then(setOrgs).catch((e) => onToast(e.message));
    api.adminUsers('logins').then(setUsers).catch(() => undefined);
  }, [orgSort, onToast]);

  useEffect(() => reload(), [reload]);

  async function patch(id: string, input: { plan?: string; status?: string }) {
    try {
      await api.adminPatchOrg(id, input);
      onToast('Organisation mise à jour.');
      reload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Action impossible.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-paper">
      <div className="mx-auto max-w-[1100px] px-4 py-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Administration</div>
            <h1 className="font-display text-3xl font-semibold">Console plateforme</h1>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium hover:border-muted"
          >
            ← Retour à l'app
          </button>
        </header>

        {/* Cartes d'ensemble */}
        {ov && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Entreprises" value={ov.totals.organizations} sub={`${ov.suspended} suspendue(s)`} />
            <Stat label="Utilisateurs" value={ov.totals.users} sub={`${ov.activity.activeUsers7d} actifs / 7j`} />
            <Stat label="Abonnements suivis" value={ov.totals.subscriptions} sub={`${ov.totals.remindersSent} rappels envoyés`} />
            <Stat label="MRR estimé" value={`${ov.mrrEur} €`} sub={`${ov.byPlan.pro || 0} Pro · ${ov.byPlan.team || 0} Team`} />
          </div>
        )}

        {/* Onglets */}
        <div className="mt-6 flex items-center gap-2">
          <TabBtn active={tab === 'orgs'} onClick={() => setTab('orgs')}>Entreprises</TabBtn>
          <TabBtn active={tab === 'users'} onClick={() => setTab('users')}>Utilisateurs</TabBtn>
          <div className="flex-1" />
          {tab === 'orgs' && (
            <>
              <select
                value={orgSort}
                onChange={(e) => setOrgSort(e.target.value)}
                className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm"
              >
                <option value="subs">Tri : + d'abonnements</option>
                <option value="reminders">Tri : + de rappels</option>
                <option value="logins">Tri : + de connexions</option>
                <option value="recent">Tri : connexion récente</option>
              </select>
              <a
                href={api.adminOrgsCsvUrl()}
                className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium hover:border-muted"
              >
                ⬇ CSV
              </a>
            </>
          )}
        </div>

        {/* Tables */}
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card">
          {tab === 'orgs' ? (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
                <tr>
                  <Th>Entreprise</Th><Th>Propriétaire</Th><Th>Plan</Th><Th>Abos</Th>
                  <Th>Rappels</Th><Th>Connexions</Th><Th>Dernière</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id} className="border-b border-line/60 last:border-0">
                    <Td>
                      <span className="font-semibold">{o.name}</span>
                      {o.status === 'suspended' && (
                        <span className="ml-2 rounded bg-urgent-bg px-1.5 py-0.5 text-[10px] font-bold text-urgent">SUSPENDU</span>
                      )}
                    </Td>
                    <Td className="text-muted">{o.ownerEmail}</Td>
                    <Td>
                      <select
                        value={o.plan}
                        onChange={(e) => patch(o.id, { plan: e.target.value })}
                        className="rounded border border-line bg-paper px-1.5 py-1 text-[13px]"
                      >
                        <option value="free">free</option>
                        <option value="pro">pro</option>
                        <option value="team">team</option>
                      </select>
                    </Td>
                    <Td>{o.subscriptions}</Td>
                    <Td>{o.reminders}</Td>
                    <Td>{o.loginCount}</Td>
                    <Td className="text-muted">{fmtDate(o.lastLoginAt)}</Td>
                    <Td>
                      <button
                        onClick={() => patch(o.id, { status: o.status === 'suspended' ? 'active' : 'suspended' })}
                        className={`rounded-lg border px-2 py-1 text-[12px] font-medium ${
                          o.status === 'suspended'
                            ? 'border-safe text-safe'
                            : 'border-urgent text-urgent'
                        }`}
                      >
                        {o.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
                <tr><Th>E-mail</Th><Th>Entreprise</Th><Th>Connexions</Th><Th>Dernière connexion</Th><Th>Inscrit</Th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-line/60 last:border-0">
                    <Td className="font-semibold">{u.email}</Td>
                    <Td className="text-muted">{u.organization}</Td>
                    <Td>{u.loginCount}</Td>
                    <Td className="text-muted">{fmtDate(u.lastLoginAt)}</Td>
                    <Td className="text-muted">{fmtDate(u.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-display text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-[12.5px] text-muted">{sub}</div>
    </div>
  );
}
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-semibold ${active ? 'bg-brand text-white' : 'border border-line bg-card text-muted'}`}
    >
      {children}
    </button>
  );
}
const Th = ({ children }: { children: React.ReactNode }) => <th className="px-3 py-2.5 font-semibold">{children}</th>;
const Td = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-3 py-2.5 ${className}`}>{children}</td>
);
