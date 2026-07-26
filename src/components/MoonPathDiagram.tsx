import { useState } from 'react';
import type { SolarEclipse } from '../types/SolarEclipse';
import { formatEventTime } from '../helpers/formatTime';
import './MoonPathDiagram.css';

type PhaseKey = 'P1' | 'U1' | 'greatest' | 'U4' | 'P4';
type ContactType = 'external' | 'internal' | 'greatest';

const PHASES: { key: PhaseKey; label: string; contact: ContactType }[] = [
  { key: 'P1', label: 'P1', contact: 'external' },
  { key: 'U1', label: 'O1', contact: 'internal' },
  { key: 'greatest', label: 'M', contact: 'greatest' },
  { key: 'U4', label: 'O4', contact: 'internal' },
  { key: 'P4', label: 'P4', contact: 'external' },
];

const SUN_RADIUS_PX = 50;
const CENTER_X = 110;
const CENTER_Y = 95;
const ARC_MINUTE_STEPS = [1, 2, 5, 10, 15, 20, 30, 45, 60];

interface MoonPathDiagramProps {
  data: SolarEclipse;
  useLocalTime: boolean;
}

export default function MoonPathDiagram({ data, useLocalTime }: MoonPathDiagramProps) {
  const [frame, setFrame] = useState<'celestial' | 'local'>('celestial');
  const [visible, setVisible] = useState<Record<PhaseKey, boolean>>({
    P1: true,
    U1: false,
    greatest: true,
    U4: false,
    P4: true,
  });

  const available = PHASES.filter(({ key }) => data.events[key]);
  if (available.length === 0) return null;

  const referenceEvent = data.events.P1 ?? data.events.greatest ?? data.events[available[0].key]!;
  const sunRadiusDeg = referenceEvent.Sun.radius;
  const pxPerDeg = SUN_RADIUS_PX / sunRadiusDeg;

  const points = available.map(({ key, label, contact }) => {
    const event = data.events[key]!;
    const sunR = event.Sun.radius;
    const moonR = event.Moon.radius;

    let separation: number;
    if (contact === 'external') {
      separation = sunR + moonR;
    } else if (contact === 'internal') {
      separation = Math.abs(sunR - moonR);
    } else {
      const raw = sunR + moonR - 2 * data.magnitude * sunR;
      separation = Math.max(0, Math.min(sunR + moonR, raw));
    }

    const angleDeg = (frame === 'celestial' ? event.p : event.zenith) ?? 0;
    const angleRad = (angleDeg * Math.PI) / 180;
    const dx = Math.sin(angleRad) * separation * pxPerDeg;
    const dy = -Math.cos(angleRad) * separation * pxPerDeg;

    return {
      key,
      label,
      x: CENTER_X + dx,
      y: CENTER_Y + dy,
      radiusPx: moonR * pxPerDeg,
      time: formatEventTime(event.date, useLocalTime),
    };
  });

  const scale =
    ARC_MINUTE_STEPS.map((arcmin) => ({ arcmin, px: pxPerDeg * (arcmin / 60) })).find(
      ({ px }) => px >= 32 && px <= 85,
    ) ?? { arcmin: 60, px: pxPerDeg };

  return (
    <div className="moon-path">
      <h3 className="moon-path__title">Trajectoire de la Lune</h3>
      <p className="moon-path__note">Diagramme schématique (tailles et positions approximatives)</p>

      <div className="moon-path__frame-toggle" role="radiogroup" aria-label="Repère de la trajectoire">
        <label className="moon-path__radio">
          <input type="radio" checked={frame === 'celestial'} onChange={() => setFrame('celestial')} />
          Repère céleste
        </label>
        <label className="moon-path__radio">
          <input type="radio" checked={frame === 'local'} onChange={() => setFrame('local')} />
          Repère local
        </label>
      </div>

      <div className="moon-path__body">
        <svg viewBox="0 0 220 180" className="moon-path__svg">
          <rect x="0" y="0" width="220" height="180" className="moon-path__background" />

          <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} className="moon-path__trajectory" />

          <circle cx={CENTER_X} cy={CENTER_Y} r={SUN_RADIUS_PX} className="moon-path__sun" />

          {points
            .filter((p) => visible[p.key])
            .map((p) => (
              <g key={p.key}>
                <circle cx={p.x} cy={p.y} r={p.radiusPx} className="moon-path__moon" />
                <text x={p.x} y={p.y - p.radiusPx - 6} className="moon-path__label">
                  {p.label}
                </text>
              </g>
            ))}

          <g className="moon-path__compass" transform="translate(196, 150)">
            <line x1="0" y1="0" x2="0" y2="-14" />
            <text x="0" y="-18">N</text>
            <line x1="0" y1="0" x2="14" y2="0" />
            <text x="18" y="4">E</text>
          </g>

          <g className="moon-path__scale" transform={`translate(14, 164)`}>
            <line x1="0" y1="0" x2={scale.px} y2="0" />
            <line x1="0" y1="-3" x2="0" y2="3" />
            <line x1={scale.px} y1="-3" x2={scale.px} y2="3" />
            <text x={scale.px / 2} y="13">
              {scale.arcmin}'
            </text>
          </g>
        </svg>

        <div className="moon-path__checkboxes">
          {points.map((p) => (
            <button
              key={p.key}
              type="button"
              className={visible[p.key] ? 'moon-path__chip moon-path__chip--active' : 'moon-path__chip'}
              aria-pressed={visible[p.key]}
              onClick={() => setVisible((v) => ({ ...v, [p.key]: !v[p.key] }))}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="moon-path__legend">
        {points.map((p) => (
          <span key={p.key}>
            {p.label} {p.time}
          </span>
        ))}
      </div>
    </div>
  );
}
