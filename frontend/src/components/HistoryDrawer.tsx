import { useEffect, useState } from 'react';
import type { ReminderConfig, ReminderHistoryEntry } from '../types';
import { api } from '../api';
import { formatDate } from '../lib/dates';

interface Props {
  open: boolean;
  config: ReminderConfig | null;
  onClose: () => void;
  onToast: (m: string) => void;
}

export function HistoryDrawer({ open, config, onClose, onToast }: Props) {
  const [rows, setRows] = useState<ReminderHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .reminderHistory()
      .then(setRows)
      .catch((e) => onToast(e instanceof Error ? e.message : 'Erreur historique.'))
      .finally(() => setLoading(false));
  }, [open, onToast]);

  if (!open) return null;

  async function test(channel: 'email' | 'n8n') {
    setTesting(channel);
    try {
      await api.testChannel(channel);
      onToast(`Test ${channel} envoyé ✓`);
    } catch (e) {
      onToast(e instanceof Error ? e.message : `Échec test ${channel}.`);
    } finally {
      setTesting('');
    }
  }

  const channels = config?.channels ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="flex h-full w-full max-w-[440px] flex-col bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="font-display text-xl font-semibold">Rappels</h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:bg-paper hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* Tester un canal */}
        <div className="border-b border-line px-5 py-4">
          <div className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-muted">
            Tester un canal
          </div>
          <div className="flex flex-wrap gap-2">
            {(['email', 'n8n'] as const).map((c) => {
              const enabled = channels.includes(c);
              return (
                <button
                  key={c}
                  disabled={!enabled || testing === c}
                  onClick={() => test(c)}
                  title={enabled ? `Envoyer un test ${c}` : `Canal ${c} désactivé (.env)`}
                  className="rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium transition hover:border-brand disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {testing === c ? '…' : c === 'email' ? '✉ Email' : '🔗 n8n'}
                  {!enabled && ' (off)'}
                </button>
              );
            })}
          </div>
          {channels.length === 0 && (
            <div className="mt-2 text-xs text-muted">
              Aucun canal actif. Active EMAIL_ENABLED ou N8N_ENABLED dans le .env.
            </div>
          )}
        </div>

        {/* Historique */}
        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-muted">
            Historique des envois
          </div>
          {loading ? (
            <div className="py-8 text-center text-muted">Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">
              Aucun rappel envoyé pour le moment.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{r.name}</span>
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
                      {r.channel}
                    </span>
                  </div>
                  <div className="mt-1 text-[12.5px] text-muted">
                    Seuil {r.thresholdDays} j · {formatDate(r.sentAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
