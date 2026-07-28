import { useId } from 'react';
import type { HorizonSample } from '../helpers/horizonObstruction';
import { azimuthToCompass } from '../helpers/visibilityRating';
import './HorizonProfilePanel.css';

interface HorizonProfilePanelProps {
  profile: HorizonSample[];
  targetAltitudeDeg: number;
  targetAzimuthDeg: number;
  originName?: string;
}

// Coordonnées internes du viewBox : la courbe/aire s'étire ensuite librement sur toute la largeur
// réelle via preserveAspectRatio="none" (un étirement non uniforme n'y déforme rien puisque ce sont
// de simples tracés). Les points, étiquettes et pointillés sont en revanche des éléments HTML
// positionnés en % par-dessus le SVG, pour ne jamais hériter de cet étirement (sinon les points
// ronds deviendraient des ellipses).
const CHART_WIDTH = 1000;
const CHART_HEIGHT = 190;
const PADDING_X = 20;
const PADDING_TOP = 38;
const PADDING_BOTTOM = 28;

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// Courbe de Catmull-Rom convertie en segments de Bézier cubiques : relie les points de mesure par une
// courbe lissée plutôt que des segments droits, façon profil de randonnée.
const buildSmoothPath = (pts: { x: number; y: number }[]): string => {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;

  let path = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return path;
};

export default function HorizonProfilePanel({ profile, targetAltitudeDeg, targetAzimuthDeg, originName }: HorizonProfilePanelProps) {
  const gradientId = useId();
  if (profile.length === 0) return null;

  // Point de départ virtuel (distance 0, angle 0 par définition — c'est la référence de l'observateur)
  // ajouté devant le profil réel pour ancrer visuellement le lieu sélectionné sur le graphique.
  const samples = [{ distanceKm: 0, angleDeg: 0 }, ...profile];

  const angles = samples.map((sample) => sample.angleDeg);
  const minAngle = Math.min(0, targetAltitudeDeg, ...angles);
  const maxAngle = Math.max(targetAltitudeDeg, ...angles) * 1.15 || 1;
  const range = maxAngle - minAngle || 1;

  const plotWidth = CHART_WIDTH - PADDING_X * 2;
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const floorY = PADDING_TOP + plotHeight;

  const xFor = (index: number) => PADDING_X + (index / (samples.length - 1)) * plotWidth;
  const yFor = (angle: number) => floorY - ((angle - minAngle) / range) * plotHeight;

  const points = samples.map((sample, index) => ({
    ...sample,
    x: xFor(index),
    y: yFor(sample.angleDeg),
    blocking: sample.angleDeg >= targetAltitudeDeg,
  }));

  const [originPoint, ...terrainPoints] = points;
  const eclipseY = yFor(targetAltitudeDeg);

  const linePath = buildSmoothPath(points.map((p) => ({ x: p.x, y: p.y })));
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)},${floorY.toFixed(1)} L ${originPoint.x.toFixed(1)},${floorY.toFixed(1)} Z`;

  const xPct = (x: number) => `${(x / CHART_WIDTH) * 100}%`;
  const yPct = (y: number) => `${(y / CHART_HEIGHT) * 100}%`;

  return (
    <div className="horizon-profile-panel">
      <div className="horizon-profile-panel__header">
        <svg width="18" height="18" viewBox="0 0 22 22" className="horizon-profile-panel__arrow">
          <polygon
            points="11,1 20,19 11,14 2,19"
            fill="#f4c238"
            stroke="#000000"
            strokeWidth={1.5}
            transform={`rotate(${targetAzimuthDeg.toFixed(1)} 11 11)`}
          />
        </svg>
        <span>
          Relief testé depuis {originName ? <strong>{originName}</strong> : 'le lieu sélectionné'} vers{' '}
          {azimuthToCompass(targetAzimuthDeg)} ({Math.round(targetAzimuthDeg)}°)
        </span>
      </div>

      <div className="horizon-profile-panel__chart-wrap">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          className="horizon-profile-panel__chart"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f4c238" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f4c238" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} className="horizon-profile-panel__area" />
          <line
            x1={PADDING_X}
            x2={CHART_WIDTH - PADDING_X}
            y1={eclipseY}
            y2={eclipseY}
            className="horizon-profile-panel__eclipse-line"
          />
          <line
            x1={originPoint.x}
            x2={originPoint.x}
            y1={PADDING_TOP - 14}
            y2={floorY}
            className="horizon-profile-panel__origin-line"
          />
          <path d={linePath} className="horizon-profile-panel__line" />
        </svg>

        <span
          className="horizon-profile-panel__eclipse-label"
          style={{ left: xPct(PADDING_X), top: yPct(Math.max(14, eclipseY - 8)) }}
        >
          Éclipse {targetAltitudeDeg.toFixed(1)}°
        </span>

        <span
          className="horizon-profile-panel__origin-label"
          style={{ left: xPct(originPoint.x), top: yPct(PADDING_TOP - 18) }}
        >
          {truncate(originName ?? 'Départ', 26)}
        </span>

        <span
          className="horizon-profile-panel__dot horizon-profile-panel__dot--origin"
          style={{ left: xPct(originPoint.x), top: yPct(originPoint.y) }}
        />
        {terrainPoints.map((point) => (
          <span
            key={point.distanceKm}
            className={`horizon-profile-panel__dot horizon-profile-panel__dot--${point.blocking ? 'blocking' : 'clear'}`}
            style={{ left: xPct(point.x), top: yPct(point.y) }}
          />
        ))}
        {terrainPoints.map((point) => (
          <span
            key={point.distanceKm}
            className="horizon-profile-panel__tick"
            style={{ left: xPct(point.x), top: yPct(CHART_HEIGHT - 6) }}
          >
            {point.distanceKm}km
          </span>
        ))}
      </div>
    </div>
  );
}
