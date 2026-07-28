import { app_colors } from '../constants';
import './VisibilityLegend.css';

interface LegendEntry {
  color: string;
  label: string;
}

export const SOLAR_LEGEND: LegendEntry[] = [
  { color: app_colors.yellow, label: 'Limites nord / sud de visibilité' },
  { color: app_colors.green, label: "Début / fin de l'éclipse au lever du Soleil" },
  { color: app_colors.red, label: "Début / fin de l'éclipse au coucher du Soleil" },
  { color: app_colors.orange, label: 'Maximum au lever / coucher du Soleil' },
];

export const LUNAR_LEGEND: LegendEntry[] = [
  { color: '#8899aa', label: 'Début / fin de la phase pénombrale' },
  { color: app_colors.yellow, label: 'Début / fin de la phase partielle' },
  { color: app_colors.orange, label: 'Début / fin de la phase totale' },
  { color: app_colors.red, label: "Maximum de l'éclipse" },
];

interface VisibilityLegendProps {
  kind: 'solar' | 'lunar';
}

export default function VisibilityLegend({ kind }: VisibilityLegendProps) {
  const entries = kind === 'solar' ? SOLAR_LEGEND : LUNAR_LEGEND;

  return (
    <>
      <p className="visibility-legend__title">Lignes de visibilité</p>
      {entries.map((entry) => (
        <div className="visibility-legend__item" key={entry.label}>
          <span className="visibility-legend__swatch" style={{ backgroundColor: entry.color }} />
          <span>{entry.label}</span>
        </div>
      ))}
    </>
  );
}
