import { useState } from 'react';

interface Props {
  open: boolean;
  orgName: string;
  onClose: () => void;
  onAdd: () => void;
  onCustomize: () => void;
  onReminders: () => void;
}

const STEPS = [
  {
    icon: '👋',
    title: 'Bienvenue !',
    body: "Suivez toutes vos échéances d'abonnements au même endroit et ne ratez plus jamais un renouvellement. On vous montre l'essentiel en 3 étapes.",
    cta: 'Commencer',
  },
  {
    icon: '➕',
    title: 'Ajoutez vos abonnements',
    body: "Créez-les un par un, importez un fichier CSV/JSON, ou collez simplement une facture : on détecte le nom, le montant et la date automatiquement.",
    cta: 'Ajouter un abonnement',
  },
  {
    icon: '🔔',
    title: 'Activez les rappels',
    body: "Recevez une alerte avant chaque échéance (e-mail, WhatsApp via n8n, ou calendrier). Personnalisez aussi le logo et la couleur à votre marque.",
    cta: 'Personnaliser',
  },
];

export function Onboarding({ open, orgName, onClose, onAdd, onCustomize, onReminders }: Props) {
  const [step, setStep] = useState(0);
  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  function primary() {
    if (step === 0) setStep(1);
    else if (step === 1) {
      onAdd();
      onClose();
    } else {
      onCustomize();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[440px] rounded-2xl bg-card p-7 text-center shadow-2xl">
        <div className="text-5xl">{s.icon}</div>
        <h2 className="mt-4 font-display text-2xl font-semibold">
          {step === 0 ? `${s.title}` : s.title}
        </h2>
        {step === 0 && <p className="mt-1 text-sm font-semibold text-brand">{orgName}</p>}
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">{s.body}</p>

        {/* Indicateur d'étapes */}
        <div className="mt-5 flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-brand' : 'w-1.5 bg-line'}`}
            />
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={primary}
            className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {s.cta}
          </button>
          <div className="flex items-center justify-between text-sm">
            {step > 0 ? (
              <button onClick={() => setStep((p) => p - 1)} className="text-muted hover:text-ink">
                ← Retour
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={() => {
                if (last) onReminders();
                onClose();
              }}
              className="text-muted underline hover:text-ink"
            >
              {last ? 'Terminer' : 'Passer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
