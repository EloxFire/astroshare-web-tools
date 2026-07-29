import { app_colors } from '../constants';
import './VisibilityLegend.css';

interface LegendEntry {
  color: string;
  label: string;
  // 'line' (défaut) pour les tracés, 'area' pour les zones remplies (umbra/pénombre) — change la
  // forme de la puce dans la légende pour rester représentatif de ce qui est montré sur la carte.
  kind?: 'line' | 'area';
}

export const SOLAR_LEGEND: LegendEntry[] = [
  { color: app_colors.yellow, label: 'Zone de totalité / annularité', kind: 'area' },
  { color: '#5a7bb8', label: 'Zone de visibilité partielle', kind: 'area' },
  { color: '#9a9a9a', label: 'Hors de la zone de visibilité (assombri)', kind: 'area' },
  { color: app_colors.white, label: 'Ligne centrale du passage' },
  { color: app_colors.yellow, label: 'Limites nord / sud de visibilité' },
  { color: app_colors.green, label: "Début / fin de l'éclipse au lever du Soleil" },
  { color: app_colors.red, label: "Début / fin de l'éclipse au coucher du Soleil" },
  { color: app_colors.orange, label: 'Maximum au lever / coucher du Soleil' },
];

export const LUNAR_LEGEND: LegendEntry[] = [
  { color: '#c9c9c9', label: 'Visible en entier (du début à la fin)', kind: 'area' },
  { color: '#8a8a8a', label: 'Visible partiellement (lever/coucher pendant l’éclipse)', kind: 'area' },
  { color: '#454545', label: 'Non visible (Lune sous l’horizon)', kind: 'area' },
  { color: app_colors.red, label: "Maximum de l'éclipse" },
];

interface VisibilityLegendProps {
  kind: 'solar' | 'lunar';
}

export default function VisibilityLegend({ kind }: VisibilityLegendProps) {
  const entries = kind === 'solar' ? SOLAR_LEGEND : LUNAR_LEGEND;

  return (
    <>
      <p className="visibility-legend__title">Zones &amp; lignes de visibilité</p>
      {entries.map((entry) => (
        <div className="visibility-legend__item" key={entry.label}>
          <span
            className={`visibility-legend__swatch${entry.kind === 'area' ? ' visibility-legend__swatch--area' : ''}`}
            style={
              entry.kind === 'area'
                ? { backgroundColor: `${entry.color}59`, borderColor: entry.color }
                : { backgroundColor: entry.color }
            }
          />
          <span>{entry.label}</span>
        </div>
      ))}
    </>
  );
}
