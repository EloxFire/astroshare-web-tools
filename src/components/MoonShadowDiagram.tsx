import { useState } from 'react';
import type { LunarEclipse } from '../types/LunarEclipse';
import { formatEventTime } from '../helpers/formatTime';
import './MoonShadowDiagram.css';

type PhaseKey = 'P1' | 'U1' | 'U2' | 'greatest' | 'U3' | 'U4' | 'P2';

const PHASES: { key: PhaseKey; label: string }[] = [
  { key: 'P1', label: 'P1' },
  { key: 'U1', label: 'U1' },
  { key: 'U2', label: 'U2' },
  { key: 'greatest', label: 'M' },
  { key: 'U3', label: 'U3' },
  { key: 'U4', label: 'U4' },
  { key: 'P2', label: 'P2' },
];

// Vérifié en reconstruisant la géométrie à partir des données réelles de l'API :
// pour U2/U3/greatest, l'angle de position renvoyé est mesuré à l'opposé exact (180°) de la
// convention utilisée pour P1/U1/U4/P2 (probablement calculé depuis la Lune plutôt que depuis
// le centre de l'ombre pour ces événements-là). Sans cette correction, la trajectoire tracée zigzague.
const ANGLE_OFFSET_DEG: Partial<Record<PhaseKey, number>> = {
  U2: 180,
  greatest: 180,
  U3: 180,
};

const PENUMBRA_RADIUS_PX = 65;
const CENTER_X = 110;
const CENTER_Y = 95;

interface MoonShadowDiagramProps {
  data: LunarEclipse;
  useLocalTime: boolean;
}

export default function MoonShadowDiagram({ data, useLocalTime }: MoonShadowDiagramProps) {
  const [visible, setVisible] = useState<Record<PhaseKey, boolean>>({
    P1: true,
    U1: false,
    U2: true,
    greatest: true,
    U3: true,
    U4: false,
    P2: true,
  });

  const available = PHASES.filter(({ key }) => data.events[key]);
  if (available.length === 0) return null;

  const pxPerUnit = PENUMBRA_RADIUS_PX / data.radius.penumbra;
  const umbraRadiusPx = data.radius.umbra * pxPerUnit;

  const points = available.map(({ key, label }) => {
    const event = data.events[key]!;
    const angleDeg = (event.p ?? 0) + (ANGLE_OFFSET_DEG[key] ?? 0);
    const angleRad = (angleDeg * Math.PI) / 180;
    const separationPx = event.axis * pxPerUnit;
    const dx = Math.sin(angleRad) * separationPx;
    const dy = -Math.cos(angleRad) * separationPx;

    return {
      key,
      label,
      x: CENTER_X + dx,
      y: CENTER_Y + dy,
      radiusPx: event.Moon.radius * pxPerUnit,
      time: formatEventTime(event.date, useLocalTime),
    };
  });

  return (
    <div className="moon-shadow">
      <h3 className="moon-shadow__title">Trajectoire dans l'ombre de la Terre</h3>
      <p className="moon-shadow__note">Cercle extérieur = pénombre, cercle intérieur = ombre (échelle réelle)</p>

      <div className="moon-shadow__body">
        <svg viewBox="0 0 220 180" className="moon-shadow__svg">
          <rect x="0" y="0" width="220" height="180" className="moon-shadow__background" />

          <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} className="moon-shadow__trajectory" />

          <circle cx={CENTER_X} cy={CENTER_Y} r={PENUMBRA_RADIUS_PX} className="moon-shadow__penumbra" />
          <circle cx={CENTER_X} cy={CENTER_Y} r={umbraRadiusPx} className="moon-shadow__umbra" />

          {points
            .filter((p) => visible[p.key])
            .map((p) => (
              <g key={p.key}>
                <circle cx={p.x} cy={p.y} r={p.radiusPx} className="moon-shadow__moon" />
                <text x={p.x} y={p.y - p.radiusPx - 6} className="moon-shadow__label">
                  {p.label}
                </text>
              </g>
            ))}

          <g className="moon-shadow__compass" transform="translate(196, 150)">
            <line x1="0" y1="0" x2="0" y2="-14" />
            <text x="0" y="-18">N</text>
            <line x1="0" y1="0" x2="14" y2="0" />
            <text x="18" y="4">E</text>
          </g>
        </svg>

        <div className="moon-shadow__checkboxes">
          {points.map((p) => (
            <button
              key={p.key}
              type="button"
              className={visible[p.key] ? 'moon-shadow__chip moon-shadow__chip--active' : 'moon-shadow__chip'}
              aria-pressed={visible[p.key]}
              onClick={() => setVisible((v) => ({ ...v, [p.key]: !v[p.key] }))}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="moon-shadow__legend">
        {points.map((p) => (
          <span key={p.key}>
            {p.label} {p.time}
          </span>
        ))}
      </div>
    </div>
  );
}
