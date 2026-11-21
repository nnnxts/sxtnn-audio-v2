import { Check, RotateCcw, Sparkles } from 'lucide-react';
import { THEMES, THEME_GROUPS, useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Misc';
import { companion, hexToChannels, channelsToHex } from '../../lib/palette';

const PRESET_COLORS = ['#8b2bff', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#ffffff'];

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
        {THEME_GROUPS.map((group) => (
          <section key={group.id}>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">{group.id === 'classic' ? 'Thème' : `Thèmes · ${group.label}`}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {THEMES.filter((t) => t.group === group.id).map((t) => {
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
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        {t.label}
                        {t.animated && <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-accent">Animé</span>}
                      </span>
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
        ))}

        <section>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Couleur des boutons</h3>
          <p className="mb-3 text-xs text-muted">Remplace la couleur d'accent du thème (boutons, barres, éléments actifs). Enregistré sur cet appareil.</p>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAppearance({ accent: null, accent2: null })}
                className={`grid h-8 place-items-center rounded-full border px-3 text-xs font-semibold ${!appearance.accent ? 'border-accent text-accent' : 'border-line text-muted hover:bg-hover'}`}
              >
                Thème
              </button>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Couleur ${c}`}
                  onClick={() => setAppearance({ accent: c, accent2: null })}
                  className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${appearance.accent?.toLowerCase() === c ? 'border-fg' : 'border-transparent ring-1 ring-line'}`}
                  style={{ background: c }}
                />
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-semibold text-muted">
                Principale
                <input
                  type="color"
                  value={appearance.accent ?? '#8b2bff'}
                  onChange={(e) => setAppearance({ accent: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted">
                Dégradé vers
                <input
                  type="color"
                  disabled={!appearance.accent}
                  value={appearance.accent2 ?? (appearance.accent ? channelsToHex(companion(hexToChannels(appearance.accent) ?? [139, 43, 255])) : '#d946ef')}
                  onChange={(e) => setAppearance({ accent2: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-transparent p-0.5 disabled:opacity-40"
                />
              </label>
              <button
                type="button"
                disabled={!appearance.accent}
                onClick={() => setAppearance({ accent2: appearance.accent })}
                className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-muted hover:bg-hover disabled:opacity-40"
              >
                Bouton uni
              </button>
              <button
                type="button"
                disabled={!appearance.accent}
                onClick={() => setAppearance({ accent2: null })}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-muted hover:bg-hover disabled:opacity-40"
              >
                <RotateCcw size={12} /> Dégradé auto
              </button>
              <span className="btn btn-primary ml-auto !px-5 !py-2.5 text-xs" aria-hidden>
                Aperçu du bouton
              </span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
            <Sparkles size={13} /> Couleurs adaptées à la pochette
          </h3>
          <p className="mb-3 text-xs text-muted">Les boutons prennent la couleur de la pochette, en dégradé vers une teinte plus claire (ex : une pochette rose donne des boutons rose → blanc rosé).</p>
          <div className="space-y-2.5">
            <Switch
              checked={appearance.adaptRelease}
              onChange={(adaptRelease) => setAppearance({ adaptRelease })}
              label="Sur la page d'une sortie"
              description="Bouton lecture, boutons et éléments actifs aux couleurs de l'album."
            />
            <Switch
              checked={appearance.adaptPlayer}
              onChange={(adaptPlayer) => setAppearance({ adaptPlayer })}
              label="Sur la barre de lecture"
              description="Lecteur du bas et lecteur plein écran aux couleurs du titre en cours."
            />
          </div>
        </section>

        <section>
          <h3 className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
            <Sparkles size={13} /> Performance
          </h3>
          <p className="mb-3 text-xs text-muted">Les décors animés (bulles, herbe, haut-parleurs, grilles) sont très légers, mais vous pouvez les couper sur un appareil lent.</p>
          <Switch
            checked={appearance.fx}
            onChange={(fx) => setAppearance({ fx })}
            label="Animations du fond"
            description="Désactivées : le fond reste fixe, le reste du thème ne change pas."
          />
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
