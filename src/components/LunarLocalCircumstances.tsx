import type { LunarEclipse } from '../types/LunarEclipse';
import { lunarEclipseTypes } from '../constants';
import { equatorialToHorizontal } from '../helpers/celestialPosition';
import { formatEventTime } from '../helpers/formatTime';
import { getAltitudeVisibilityRating, applyTerrainObstruction } from '../helpers/visibilityRating';
import type { HorizonObstructionResult } from '../helpers/horizonObstruction';
import './LunarLocalCircumstances.css';

const PHASES: { key: keyof LunarEclipse['events']; label: string }[] = [
  { key: 'P1', label: 'P1' },
  { key: 'U1', label: 'U1' },
  { key: 'U2', label: 'U2' },
  { key: 'greatest', label: 'M' },
  { key: 'U3', label: 'U3' },
  { key: 'U4', label: 'U4' },
  { key: 'P2', label: 'P2' },
];

interface LunarLocalCircumstancesProps {
  data: LunarEclipse;
  locationName: string;
  dms: { lat: string; lon: string };
  location: { lat: number; lng: number };
  useLocalTime: boolean;
  terrainResult: HorizonObstructionResult | null;
  checkingTerrain: boolean;
}

export default function LunarLocalCircumstances({
  data,
  locationName,
  dms,
  location,
  useLocalTime,
  terrainResult,
  checkingTerrain,
}: LunarLocalCircumstancesProps) {
  const rows = PHASES.filter(({ key }) => data.events[key]);
  const anyVisible = rows.some(({ key }) => {
    const event = data.events[key]!;
    const { altitude } = equatorialToHorizontal(event.date, event.Moon.RA, event.Moon.DEC, location.lat, location.lng);
    return altitude > 0;
  });

  const referenceEvent = data.events.greatest ?? data.events.U2 ?? data.events.P1;
  const referenceHorizontal = referenceEvent
    ? equatorialToHorizontal(referenceEvent.date, referenceEvent.Moon.RA, referenceEvent.Moon.DEC, location.lat, location.lng)
    : null;
  const baseVisibility =
    referenceHorizontal && referenceHorizontal.altitude > 0
      ? getAltitudeVisibilityRating(referenceHorizontal.altitude, referenceHorizontal.azimuth)
      : null;
  const visibility =
    baseVisibility && terrainResult && referenceHorizontal
      ? applyTerrainObstruction(baseVisibility, terrainResult, referenceHorizontal.altitude, referenceHorizontal.azimuth)
      : baseVisibility;

  return (
    <div className="lunar-local-circumstances">
      <h3 className="lunar-local-circumstances__type">{lunarEclipseTypes[data.type] ?? data.type}</h3>
      <p className="lunar-local-circumstances__position">
        {locationName ? `${locationName} — ` : ''}
        {dms.lat} {dms.lon}
      </p>

      <div className="lunar-local-circumstances__stats">
        {data.duration.total && (
          <div className="lunar-local-circumstances__stat">
            <span>Durée phase totale</span>
            <strong>{data.duration.total.replace(':', 'h').replace(':', 'm') + 's'}</strong>
          </div>
        )}
        {data.duration.partial && (
          <div className="lunar-local-circumstances__stat">
            <span>Durée phase partielle</span>
            <strong>{data.duration.partial.replace(':', 'h').replace(':', 'm') + 's'}</strong>
          </div>
        )}
        <div className="lunar-local-circumstances__stat">
          <span>Durée pénombrale</span>
          <strong>{data.duration.penumbral.replace(':', 'h').replace(':', 'm') + 's'}</strong>
        </div>
        <div className="lunar-local-circumstances__stat">
          <span>Magnitude</span>
          <strong>{data.magnitude}</strong>
        </div>
      </div>

      {!anyVisible && (
        <p className="lunar-local-circumstances__hint">
          La Lune est sous l'horizon à cet endroit pendant toute la durée de l'éclipse — invisible depuis ce lieu.
        </p>
      )}

      {visibility && (
        <div className={`lunar-local-circumstances__visibility lunar-local-circumstances__visibility--${visibility.level}`}>
          <span className="lunar-local-circumstances__visibility-badge">{visibility.label}</span>
          <div>
            <p>{visibility.message}</p>
            {checkingTerrain && <p className="lunar-local-circumstances__visibility-checking">Vérification du relief…</p>}
          </div>
        </div>
      )}

      <div className="lunar-local-circumstances__table-wrap">
        <table className="lunar-local-circumstances__table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Heure ({useLocalTime ? 'locale' : 'UTC'})</th>
              <th>Altitude Lune</th>
              <th>Visible</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, label }) => {
              const event = data.events[key]!;
              const { altitude } = equatorialToHorizontal(
                event.date,
                event.Moon.RA,
                event.Moon.DEC,
                location.lat,
                location.lng,
              );
              const visible = altitude > 0;
              return (
                <tr key={key} className={visible ? '' : 'lunar-local-circumstances__row--hidden'}>
                  <td>{label}</td>
                  <td>{formatEventTime(event.date, useLocalTime)}</td>
                  <td>{altitude.toFixed(1)}°</td>
                  <td>{visible ? '✓' : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
