import { useRef, useState } from 'react';
import type { Session } from '../types';
import { api } from '../api';

interface Props {
  open: boolean;
  session: Session;
  onClose: () => void;
  onToast: (m: string) => void;
  onSaved: () => void; // recharge la session (applique la nouvelle marque)
}

export function SettingsModal({ open, session, onClose, onToast, onSaved }: Props) {
  const [name, setName] = useState(session.organization.name);
  const [color, setColor] = useState(session.organization.brandColor || '#1F4D46');
  const [logo, setLogo] = useState<string | null>(session.organization.logoUrl);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      onToast('Logo trop lourd (max ~500 Ko).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function save() {
    setBusy(true);
    try {
      await api.updateOrganization({ name: name.trim() || undefined, brandColor: color, logoUrl: logo });
      onToast('Personnalisation enregistrée.');
      onSaved();
      onClose();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[460px] rounded-[18px] bg-card p-6 shadow-2xl">
        <h3 className="mb-4 font-display text-2xl font-semibold">Personnalisation</h3>

        <label className="mb-1.5 block text-[12.5px] font-semibold uppercase tracking-wide text-muted">
          Nom de l'entreprise
        </label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />

        <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold uppercase tracking-wide text-muted">
          Couleur de la marque
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-paper"
          />
          <input value={color} onChange={(e) => setColor(e.target.value)} className={inputCls} />
        </div>

        <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold uppercase tracking-wide text-muted">
          Logo
        </label>
        <div className="flex items-center gap-3">
          {logo ? (
            <img src={logo} alt="logo" className="h-12 w-12 rounded-lg border border-line object-contain bg-paper" />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-lg border border-dashed border-line text-muted">
              —
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium hover:border-brand"
          >
            Choisir une image
          </button>
          {logo && (
            <button onClick={() => setLogo(null)} className="text-sm text-muted underline">
              Retirer
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickLogo} />
        </div>

        <div className="mt-4 rounded-xl border border-line bg-paper p-3">
          <div className="text-[12px] uppercase tracking-wide text-muted">Aperçu</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white" style={{ background: color }}>
              Bouton
            </span>
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: color, color: '#fff' }}>
              Badge
            </span>
          </div>
        </div>

        <div className="mt-5 flex gap-2.5">
          <button className="flex-1 rounded-xl border border-line bg-paper p-3 font-semibold hover:bg-line" onClick={onClose}>
            Annuler
          </button>
          <button
            className="flex-1 rounded-xl p-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            style={{ background: color }}
            onClick={save}
            disabled={busy}
          >
            {busy ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[14.5px] text-ink outline-none transition focus:border-brand';
