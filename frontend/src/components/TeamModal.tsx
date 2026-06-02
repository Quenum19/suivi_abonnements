import { useEffect, useState } from 'react';
import type { Session, TeamMember } from '../types';
import { api } from '../api';

interface Props {
  open: boolean;
  session: Session;
  onClose: () => void;
  onToast: (m: string) => void;
}

export function TeamModal({ open, session, onClose, onToast }: Props) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [busy, setBusy] = useState(false);

  // Changement de mot de passe.
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');

  const canManage = ['owner', 'admin'].includes(session.role);

  const reload = () => api.team().then(setMembers).catch((e) => onToast(e.message));
  useEffect(() => {
    if (open) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  async function invite() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const r = await api.teamInvite(email.trim(), role);
      if (r.temporaryPassword) {
        onToast(`Invité ! Mot de passe temporaire : ${r.temporaryPassword}`);
      } else {
        onToast('Compte existant ajouté à l’équipe.');
      }
      setEmail('');
      reload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Invitation impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function setMemberRole(userId: string, r: 'admin' | 'member') {
    try {
      await api.teamSetRole(userId, r);
      reload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Action impossible.');
    }
  }

  async function remove(userId: string) {
    if (!window.confirm('Retirer ce membre de l’équipe ?')) return;
    try {
      await api.teamRemove(userId);
      reload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Suppression impossible.');
    }
  }

  async function changePw() {
    if (next.length < 8) {
      onToast('Nouveau mot de passe : 8 caractères minimum.');
      return;
    }
    try {
      await api.changePassword(cur, next);
      onToast('Mot de passe mis à jour.');
      setCur('');
      setNext('');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Changement impossible.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-[520px] overflow-auto rounded-[18px] bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-2xl font-semibold">Équipe</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:bg-paper">✕</button>
        </div>

        {/* Membres */}
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between rounded-xl border border-line bg-paper px-3 py-2.5">
              <div>
                <div className="text-sm font-semibold">
                  {m.email} {m.isSelf && <span className="text-[11px] text-muted">(vous)</span>}
                </div>
                <div className="text-[12px] text-muted">{m.role}</div>
              </div>
              {canManage && m.role !== 'owner' && !m.isSelf && (
                <div className="flex items-center gap-2">
                  <select
                    value={m.role === 'admin' ? 'admin' : 'member'}
                    onChange={(e) => setMemberRole(m.userId, e.target.value as 'admin' | 'member')}
                    className="rounded border border-line bg-card px-1.5 py-1 text-[12px]"
                  >
                    <option value="member">membre</option>
                    <option value="admin">admin</option>
                  </select>
                  <button onClick={() => remove(m.userId)} className="text-[12px] text-urgent underline">retirer</button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* Inviter */}
        {canManage && (
          <div className="mt-4 rounded-xl border border-line bg-paper p-3">
            <div className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-muted">Inviter un membre</div>
            <div className="flex flex-wrap gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="collegue@entreprise.com"
                className="min-w-[180px] flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member')} className="rounded-lg border border-line bg-card px-2 py-2 text-sm">
                <option value="member">membre</option>
                <option value="admin">admin</option>
              </select>
              <button onClick={invite} disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
                Inviter
              </button>
            </div>
            <p className="mt-2 text-[11.5px] text-muted">Un mot de passe temporaire est généré pour les nouveaux comptes (à communiquer). Le nombre de membres dépend de votre plan.</p>
          </div>
        )}

        {/* Mon mot de passe */}
        <div className="mt-4 rounded-xl border border-line bg-paper p-3">
          <div className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-muted">Changer mon mot de passe</div>
          <div className="flex flex-wrap gap-2">
            <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Mot de passe actuel" className="min-w-[150px] flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-brand" />
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Nouveau (8+ car.)" className="min-w-[150px] flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-brand" />
            <button onClick={changePw} className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-brand">OK</button>
          </div>
        </div>
      </div>
    </div>
  );
}
