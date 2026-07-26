import type { SolarEclipse } from '../types/SolarEclipse';
import { solarEclipseTypes } from '../constants';
import { formatEventTime } from '../helpers/formatTime';
import './LocalCircumstances.css';

const PHASES: { key: keyof SolarEclipse['events']; label: string }[] = [
  { key: 'P1', label: 'P1' },
  { key: 'U1', label: 'O1' },
  { key: 'greatest', label: 'M' },
  { key: 'U4', label: 'O4' },
  { key: 'P4', label: 'P4' },
];

const formatAngle = (value: number | null | undefined) => (value != null ? `${value.toFixed(2)}°` : '—');

interface LocalCircumstancesProps {
  data: SolarEclipse;
  locationName: string;
  dms: { lat: string; lon: string };
  useLocalTime: boolean;
}

export default function LocalCircumstances({ data, locationName, dms, useLocalTime }: LocalCircumstancesProps) {
  const rows = PHASES.filter(({ key }) => data.events[key]);

  return (
    <div className="local-circumstances">
      <h3 className="local-circumstances__type">{solarEclipseTypes[data.type] ?? data.type}</h3>
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

      <p className="local-circumstances__terms">
        <strong>P</strong> Angle de position &nbsp;·&nbsp; <strong>Z</strong> Angle au zénith &nbsp;·&nbsp;{' '}
        <strong>H☉</strong> Hauteur du Soleil au-dessus de l'horizon
      </p>
    </div>
  );
}
