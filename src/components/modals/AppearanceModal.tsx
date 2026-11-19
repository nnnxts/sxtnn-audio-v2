import { Check } from 'lucide-react';
import { THEMES, useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Modal';

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string; hint?: string; preview?: React.ReactNode }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
              active ? 'border-accent bg-accent/10 shadow-[0_0_0_1px_rgb(var(--accent))]' : 'border-line bg-card hover:bg-hover'
            }`}
          >
            {o.preview}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{o.label}</span>
              {o.hint && <span className="block text-xs text-muted">{o.hint}</span>}
            </span>
            {active && <Check size={18} className="text-accent" />}
          </button>
        );
      })}
    </div>
  );
}

/** Menu "Apparence" façon Discord : thèmes, densité, style des pochettes. */
export function AppearanceModal() {
  const { appearance, setAppearance, appearanceOpen, closeAppearance } = useTheme();
  const { user } = useAuth();

  return (
    <Modal open={appearanceOpen} onClose={closeAppearance} title="Apparence" size="lg">
      <div className="space-y-8 px-6 py-6">
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Thème</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {THEMES.map((t) => {
              const active = appearance.theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setAppearance({ theme: t.id })}
                  className={`group relative overflow-hidden rounded-2xl border p-3 text-left transition-all ${
                    active ? 'border-accent shadow-[0_0_0_1px_rgb(var(--accent))]' : 'border-line hover:border-muted/50'
                  }`}
                >
                  {/* Mini aperçu de l'interface dans les couleurs du thème */}
                  <div className="overflow-hidden rounded-xl border border-black/10" style={{ background: t.swatch[0] }}>
                    <div className="flex h-20">
                      <div className="w-1/4 p-2" style={{ background: t.swatch[1] }}>
                        <div className="h-1.5 w-full rounded-full" style={{ background: t.swatch[2] }} />
                        <div className="mt-1.5 h-1.5 w-2/3 rounded-full opacity-40" style={{ background: t.swatch[2] }} />
                        <div className="mt-1.5 h-1.5 w-3/4 rounded-full opacity-40" style={{ background: t.swatch[2] }} />
                      </div>
                      <div className="flex-1 p-2">
                        <div className="h-8 rounded-lg" style={{ background: `linear-gradient(110deg, ${t.swatch[2]}, ${t.swatch[3]})` }} />
                        <div className="mt-2 flex gap-1.5">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="h-5 flex-1 rounded-md" style={{ background: t.swatch[1] }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span>
                      <span className="block text-sm font-semibold">{t.label}</span>
                      <span className="block text-xs text-muted">{t.description}</span>
                    </span>
                    {active && (
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-onaccent">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Densité d'affichage</h3>
          <Segmented
            value={appearance.density}
            onChange={(density) => setAppearance({ density })}
            options={[
              {
                id: 'comfortable',
                label: 'Confortable',
                hint: 'Espacé et aéré',
                preview: (
                  <span className="flex w-8 flex-col gap-1.5">
                    <span className="h-1.5 rounded-full bg-muted/70" />
                    <span className="h-1.5 rounded-full bg-muted/70" />
                    <span className="h-1.5 rounded-full bg-muted/70" />
                  </span>
                ),
              },
              {
                id: 'compact',
                label: 'Compact',
                hint: 'Plus de contenu à l\'écran',
                preview: (
                  <span className="flex w-8 flex-col gap-0.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} className="h-1 rounded-full bg-muted/70" />
                    ))}
                  </span>
                ),
              },
            ]}
          />
        </section>

        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Style des pochettes</h3>
          <Segmented
            value={appearance.coverStyle}
            onChange={(coverStyle) => setAppearance({ coverStyle })}
            options={[
              {
                id: 'rounded',
                label: 'Arrondi moderne',
                hint: 'Angles doux',
                preview: <span className="h-10 w-10 shrink-0 rounded-xl bg-accent-gradient" />,
              },
              {
                id: 'square',
                label: 'Carré vinyle',
                hint: 'Angles droits',
                preview: <span className="h-10 w-10 shrink-0 rounded-[2px] bg-accent-gradient shadow-[inset_0_0_0_1px_rgb(255_255_255/0.2)]" />,
              },
            ]}
          />
        </section>

        <p className="rounded-xl bg-card px-4 py-3 text-xs text-muted">
          {user
            ? 'Vos réglages sont enregistrés sur cet appareil et synchronisés avec votre compte.'
            : 'Vos réglages sont enregistrés sur cet appareil. Connectez-vous pour les retrouver partout.'}
        </p>
      </div>
    </Modal>
  );
}
