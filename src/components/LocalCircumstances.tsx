import { useState } from 'react';
import { Info } from 'lucide-react';
import type { SolarEclipse } from '../types/SolarEclipse';
import { solarEclipseTypes } from '../constants';
import { formatEventTime } from '../helpers/formatTime';
import { getAltitudeVisibilityRating, applyTerrainObstruction } from '../helpers/visibilityRating';
import type { HorizonObstructionResult } from '../helpers/horizonObstruction';
import VisibilityScale from './VisibilityScale';
import './LocalCircumstances.css';

const PHASES: { key: keyof SolarEclipse['events']; label: string; definition: string }[] = [
  { key: 'P1', label: 'P1', definition: 'Premier contact' },
  { key: 'U1', label: 'O1', definition: 'Début de la totalité/annularité' },
  { key: 'greatest', label: 'M', definition: "Maximum de l'éclipse" },
  { key: 'U4', label: 'O4', definition: 'Fin de la totalité/annularité' },
  { key: 'P4', label: 'P4', definition: 'Dernier contact' },
];

const formatAngle = (value: number | null | undefined) => (value != null ? `${value.toFixed(2)}°` : '—');

interface LocalCircumstancesProps {
  data: SolarEclipse;
  locationName: string;
  dms: { lat: string; lon: string };
  useLocalTime: boolean;
  terrainResult: HorizonObstructionResult | null;
  checkingTerrain: boolean;
}

export default function LocalCircumstances({
  data,
  locationName,
  dms,
  useLocalTime,
  terrainResult,
  checkingTerrain,
}: LocalCircumstancesProps) {
  const [showScale, setShowScale] = useState(false);
  const rows = PHASES.filter(({ key }) => data.events[key]);
  const referenceEvent = data.events.greatest ?? data.events.P1 ?? data.events.P4;
  const baseVisibility = referenceEvent
    ? getAltitudeVisibilityRating(referenceEvent.Sun.elevation, referenceEvent.Sun.azimuth, 'Soleil')
    : null;
  const visibility =
    baseVisibility && terrainResult && referenceEvent
      ? applyTerrainObstruction(baseVisibility, terrainResult, referenceEvent.Sun.elevation, referenceEvent.Sun.azimuth, 'Soleil')
      : baseVisibility;

  return (
    <div className="local-circumstances">
      <h3 className="local-circumstances__type">
        {solarEclipseTypes[data.type] ?? data.type}
        <span className="local-circumstances__type-scope"> depuis ce lieu</span>
      </h3>
      <p className="local-circumstances__position">
        {locationName ? `${locationName} — ` : ''}
        {dms.lat} {dms.lon}
      </p>

      <div className="local-circumstances__stats">
        {data.duration.umbral && (
          <div className="local-circumstances__stat">
            <span>Durée de la phase totale</span>
            <strong>{data.duration.umbral.replace(':', 'h').replace(':', 'm') + 's'}</strong>
          </div>
        )}
        <div className="local-circumstances__stat">
          <span>Durée de l'éclipse</span>
          <strong>{data.duration.penumbral.replace(':', 'h').replace(':', 'm') + 's'}</strong>
        </div>
        <div className="local-circumstances__stat">
          <span>Magnitude</span>
          <strong>{data.magnitude}</strong>
        </div>
        <div className="local-circumstances__stat">
          <span>Obscuration</span>
          <strong>{data.obscuration}%</strong>
        </div>
      </div>

      {visibility && (
        <>
          <div className={`local-circumstances__visibility local-circumstances__visibility--${visibility.level}`}>
            <span className="local-circumstances__visibility-badge">{visibility.label}</span>
            <div>
              <p>{visibility.message}</p>
              {checkingTerrain && <p className="local-circumstances__visibility-checking">Vérification du relief…</p>}
            </div>
            <button
              type="button"
              className="local-circumstances__visibility-scale-toggle"
              onClick={() => setShowScale((value) => !value)}
              aria-expanded={showScale}
              title="Voir l'échelle de visibilité"
            >
              <Info size={14} />
            </button>
          </div>
          {showScale && <VisibilityScale activeLevel={visibility.level} />}
        </>
      )}

      <h3 className="local-circumstances__table-title">Phases de l'éclipse</h3>
      <p className="local-circumstances__table-note">Heure, angles et hauteur du Soleil à chaque étape</p>
      <div className="local-circumstances__table-wrap">
        <table className="local-circumstances__table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Heure ({useLocalTime ? 'locale' : 'UTC'})</th>
              <th>P</th>
              <th>Z</th>
              <th>H☉</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, label }) => {
              const event = data.events[key]!;
              return (
                <tr key={key}>
                  <td>{label}</td>
                  <td>{formatEventTime(event.date, useLocalTime)}</td>
                  <td>{formatAngle(event.p)}</td>
                  <td>{formatAngle(event.zenith)}</td>
                  <td>{formatAngle(event.Sun.elevation)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="local-circumstances__terms">
        {rows.map(({ label, definition }, index) => (
          <span key={label}>
            {index > 0 && ' · '}
            <strong>{label}</strong> {definition}
          </span>
        ))}
      </p>

      <p className="local-circumstances__terms">
        <strong>P</strong> Angle de position &nbsp;·&nbsp; <strong>Z</strong> Angle au zénith &nbsp;·&nbsp;{' '}
        <strong>H☉</strong> Hauteur du Soleil au-dessus de l'horizon
      </p>
    </div>
  );
}
