import { useEffect, useState } from 'react';
import type { Subscription, SubscriptionInput } from '../types';
import { SUPPORTED_CURRENCIES } from '../lib/currency';

interface Props {
  open: boolean;
  editing: Subscription | null;
  initial?: Partial<SubscriptionInput> | null;
  categories: string[];
  onClose: () => void;
  onSave: (input: SubscriptionInput) => Promise<void>;
}

const empty: SubscriptionInput = {
  name: '',
  category: '',
  startDate: '',
  expiryDate: '',
  amount: null,
  currency: '',
  notes: '',
  frequency: 'yearly',
  status: 'active',
  responsible: '',
};

const FREQ_OPTIONS: { value: SubscriptionInput['frequency']; label: string }[] = [
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'monthly', label: 'Mensuel' },
  { value: 'quarterly', label: 'Trimestriel' },
  { value: 'yearly', label: 'Annuel' },
  { value: 'one_time', label: 'Paiement unique' },
];

const STATUS_OPTIONS: { value: SubscriptionInput['status']; label: string }[] = [
  { value: 'active', label: 'Actif' },
  { value: 'unused', label: 'Inutilisé' },
  { value: 'cancelled', label: 'Annulé' },
];

export function SubscriptionModal({ open, editing, initial, categories, onClose, onSave }: Props) {
  const [form, setForm] = useState<SubscriptionInput & { amountStr: string }>({
    ...empty,
    amountStr: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        category: editing.category,
        startDate: editing.startDate ?? '',
        expiryDate: editing.expiryDate,
        amount: editing.amount,
        currency: editing.currency ?? '',
        notes: editing.notes ?? '',
        frequency: editing.frequency,
        status: editing.lifecycle,
        responsible: editing.responsible ?? '',
        amountStr: editing.amount != null ? String(editing.amount) : '',
      });
    } else {
      const i = initial ?? {};
      setForm({
        ...empty,
        ...i,
        startDate: i.startDate ?? '',
        currency: i.currency ?? '',
        notes: i.notes ?? '',
        responsible: i.responsible ?? '',
        amountStr: i.amount != null ? String(i.amount) : '',
      });
    }
    setError('');
  }, [editing, initial, open]);

  if (!open) return null;

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }) as typeof f);

  async function submit() {
    if (!form.name.trim() || !form.expiryDate) {
      setError("Le nom et la date d'échéance sont obligatoires.");
      return;
    }
    const amountStr = form.amountStr.trim().replace(',', '.');
    const amount = amountStr === '' ? null : Number(amountStr);
    if (amount != null && !Number.isFinite(amount)) {
      setError('Montant invalide.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        category: form.category.trim() || 'Autres',
        startDate: form.startDate || null,
        expiryDate: form.expiryDate,
        amount,
        currency: amount != null ? form.currency || 'EUR' : null,
        notes: form.notes?.trim() || null,
        frequency: form.frequency,
        status: form.status,
        responsible: form.responsible?.trim() || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l’enregistrement.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-[480px] overflow-auto rounded-[18px] bg-card p-6 shadow-2xl">
        <h3 className="mb-4 font-display text-2xl font-semibold">
          {editing ? "Modifier l'abonnement" : 'Ajouter un abonnement'}
        </h3>

        {error && (
          <div className="mb-3 rounded-lg bg-urgent-bg px-3 py-2 text-[13px] text-urgent">{error}</div>
        )}

        <Field label="Nom du service">
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="ex. CapCut"
          />
        </Field>
        <Field label="Catégorie">
          <input
            className={inputCls}
            list="cats"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            placeholder="ex. Création de contenu vidéo"
          />
          <datalist id="cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Date de début">
            <input
              type="date"
              className={inputCls}
              value={form.startDate ?? ''}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </Field>
          <Field label="Date d'échéance *">
            <input
              type="date"
              className={inputCls}
              value={form.expiryDate}
              onChange={(e) => set('expiryDate', e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Montant (facultatif)">
            <input
              className={inputCls}
              value={form.amountStr}
              onChange={(e) => set('amountStr', e.target.value)}
              placeholder="ex. 59,88"
              inputMode="decimal"
            />
          </Field>
          <Field label="Devise">
            <select
              className={inputCls}
              value={form.currency ?? ''}
              onChange={(e) => set('currency', e.target.value)}
            >
              <option value="">—</option>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Périodicité">
            <select
              className={inputCls}
              value={form.frequency}
              onChange={(e) => set('frequency', e.target.value)}
            >
              {FREQ_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Utilisation">
            <select
              className={inputCls}
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Responsable / relance (facultatif)">
          <input
            className={inputCls}
            value={form.responsible ?? ''}
            onChange={(e) => set('responsible', e.target.value)}
            placeholder="ex. Awa +225 07 00 00 00 00 (WhatsApp)"
          />
        </Field>
        <Field label="Notes (facultatif)">
          <input
            className={inputCls}
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="ex. Abonnement annuel"
          />
        </Field>

        <div className="mt-5 flex gap-2.5">
          <button
            className="flex-1 rounded-xl border border-line bg-paper p-3 font-semibold transition hover:bg-line"
            onClick={onClose}
            disabled={saving}
          >
            Annuler
          </button>
          <button
            className="flex-1 rounded-xl bg-brand p-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            onClick={submit}
            disabled={saving}
          >
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[14.5px] text-ink outline-none transition focus:border-brand';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <label className="mb-1.5 block text-[12.5px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
