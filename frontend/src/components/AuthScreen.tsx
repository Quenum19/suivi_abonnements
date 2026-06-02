import { useEffect, useState } from 'react';
import type { PublicBrand, Session } from '../types';
import { ApiError, api } from '../api';
import { applyBranding } from '../lib/branding';

export function AuthScreen({ onAuth }: { onAuth: (s: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [brand, setBrand] = useState<PublicBrand | null>(null);

  // Page de connexion personnalisée : /?org=<slug>.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('org');
    if (!slug) return;
    api
      .publicOrg(slug)
      .then((b) => {
        setBrand(b);
        applyBranding(b.brandColor);
      })
      .catch(() => undefined);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const s =
        mode === 'login'
          ? await api.login({ email, password })
          : await api.register({ email, password, organizationName: orgName || undefined });
      onAuth(s);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 text-center">
          {brand?.logoUrl && (
            <img
              src={brand.logoUrl}
              alt="logo"
              className="mx-auto mb-3 h-16 w-16 rounded-2xl border border-line bg-card object-contain p-1"
            />
          )}
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            {brand?.name ?? 'Suivi des abonnements'}
          </div>
          <h1 className="mt-1 font-display text-3xl font-semibold">
            {mode === 'login' ? 'Connexion' : 'Créer un compte'}
          </h1>
        </div>

        <form
          onSubmit={submit}
          className="rounded-[18px] border border-line bg-card p-6 shadow-card"
        >
          {error && (
            <div className="mb-3 rounded-lg bg-urgent-bg px-3 py-2 text-[13px] text-urgent">
              {error}
            </div>
          )}

          <label className="mb-1.5 block text-[12.5px] font-semibold uppercase tracking-wide text-muted">
            E-mail
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="vous@exemple.com"
          />

          <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold uppercase tracking-wide text-muted">
            Mot de passe
          </label>
          <input
            type="password"
            required
            minLength={mode === 'register' ? 8 : 1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            placeholder={mode === 'register' ? '8 caractères minimum' : '••••••••'}
          />

          {mode === 'register' && (
            <>
              <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold uppercase tracking-wide text-muted">
                Nom de l'espace (facultatif)
              </label>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className={inputCls}
                placeholder="ex. Mon entreprise"
              />
            </>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-xl bg-brand p-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-muted">
          {mode === 'login' ? 'Pas encore de compte ?' : 'Déjà un compte ?'}{' '}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            className="font-semibold text-brand underline"
          >
            {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[14.5px] text-ink outline-none transition focus:border-brand';
