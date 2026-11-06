import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings2, X } from 'lucide-react';
import type { SolarEclipse } from '../types/SolarEclipse';
import type { LunarEclipse } from '../types/LunarEclipse';
import type { TrackedCity } from '../types/TrackedCity';
import { computeSolarFramesForCities, simulateLunarPath } from '../helpers/moonPathSimulation';
import { equatorialToHorizontal } from '../helpers/celestialPosition';
import { formatEventTime } from '../helpers/formatTime';
import TrackedCitiesPanel from './TrackedCitiesPanel';
import './MoonTrajectoryModal.css';

const SUN_RADIUS_PX = 50;
const PENUMBRA_RADIUS_PX = 65;
const CENTER_X = 110;
const CENTER_Y = 95;

interface Cell {
  id: string;
  name: string;
  x: number;
  y: number;
  radiusPx: number;
  visible?: boolean;
  altitudeDeg?: number;
}

interface CityManagementProps {
  trackedCities: TrackedCity[];
  onAddCity: (name: string, lat: number, lng: number) => void;
  onToggleCity: (id: string) => void;
  onRemoveCity: (id: string) => void;
  onSetAllCitiesEnabled: (enabled: boolean) => void;
}

type MoonTrajectoryModalProps = CityManagementProps &
  ({ kind: 'solar'; data: SolarEclipse; useLocalTime: boolean; onClose: () => void } | {
    kind: 'lunar';
    data: LunarEclipse;
    useLocalTime: boolean;
    onClose: () => void;
  });

export default function MoonTrajectoryModal(props: MoonTrajectoryModalProps) {
  const { trackedCities, onAddCity, onToggleCity, onRemoveCity, onSetAllCitiesEnabled, useLocalTime, onClose } = props;
  const enabledCities = trackedCities.filter((c) => c.enabled);
  const [manageCitiesOpen, setManageCitiesOpen] = useState(enabledCities.length === 0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (enabledCities.length === 0) setManageCitiesOpen(true);
  }, [enabledCities.length]);

  const greatestDate = props.data.events.greatest?.date;
  if (!greatestDate) return null;
  const referenceTime = new Date(`${greatestDate}Z`);

  let cells: Cell[] = [];
  let background: React.ReactNode = null;

  if (enabledCities.length > 0) {
    if (props.kind === 'solar') {
      const frames = computeSolarFramesForCities(referenceTime, enabledCities, props.data.physicalData);
      const pxPerDeg = SUN_RADIUS_PX / frames[0].sunRadiusDeg;
      cells = frames.map((frame) => {
        const angleRad = (frame.localAngleDeg * Math.PI) / 180;
        return {
          id: frame.id,
          name: frame.name,
          x: CENTER_X + Math.sin(angleRad) * frame.separationDeg * pxPerDeg,
          y: CENTER_Y - Math.cos(angleRad) * frame.separationDeg * pxPerDeg,
          radiusPx: frame.moonRadiusDeg * pxPerDeg,
        };
      });
      background = <circle cx={CENTER_X} cy={CENTER_Y} r={SUN_RADIUS_PX} className="moon-trajectory-modal__sun" />;
    } else {
      const [frame] = simulateLunarPath([referenceTime]);
      const pxPerUnit = PENUMBRA_RADIUS_PX / props.data.radius.penumbra;
      const angleRad = (frame.angleDeg * Math.PI) / 180;
      const x = CENTER_X + Math.sin(angleRad) * frame.axis * pxPerUnit;
      const y = CENTER_Y - Math.cos(angleRad) * frame.axis * pxPerUnit;
      const radiusPx = frame.moonRadius * pxPerUnit;
      const greatestEvent = props.data.events.greatest!;
      cells = enabledCities.map((city) => {
        const { altitude } = equatorialToHorizontal(greatestDate, greatestEvent.Moon.RA, greatestEvent.Moon.DEC, city.lat, city.lng);
        return { id: city.id, name: city.name, x, y, radiusPx, visible: altitude > 0, altitudeDeg: altitude };
      });
      const umbraRadiusPx = props.data.radius.umbra * pxPerUnit;
      background = (
        <>
          <circle cx={CENTER_X} cy={CENTER_Y} r={PENUMBRA_RADIUS_PX} className="moon-trajectory-modal__penumbra" />
          <circle cx={CENTER_X} cy={CENTER_Y} r={umbraRadiusPx} className="moon-trajectory-modal__umbra" />
        </>
      );
    }
  }

  return createPortal(
    <div
      className="moon-trajectory-modal__backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="moon-trajectory-modal__panel" role="dialog" aria-modal="true" aria-label="Comparaison des villes suivies">
        <div className="moon-trajectory-modal__header">
          <div>
            <h2 className="moon-trajectory-modal__title">Comparaison des villes suivies</h2>
            <p className="moon-trajectory-modal__note">
              Maximum de l'éclipse — {formatEventTime(greatestDate, useLocalTime)}
            </p>
          </div>
          <div className="moon-trajectory-modal__header-actions">
            {enabledCities.length > 0 && (
              <button
                type="button"
                className="moon-trajectory-modal__manage-toggle"
                onClick={() => setManageCitiesOpen((v) => !v)}
                aria-pressed={manageCitiesOpen}
                title="Gérer les villes suivies"
              >
                <Settings2 size={16} color="#FFFFFF" />
              </button>
            )}
            <button type="button" className="moon-trajectory-modal__close" onClick={onClose} aria-label="Fermer">
              <X size={20} color="#FFFFFF" />
            </button>
          </div>
        </div>

        {manageCitiesOpen && (
          <div className="moon-trajectory-modal__city-manager">
            <TrackedCitiesPanel
              cities={trackedCities}
              onAdd={onAddCity}
              onToggle={onToggleCity}
              onRemove={onRemoveCity}
              onSetAllEnabled={onSetAllCitiesEnabled}
            />
          </div>
        )}

        {enabledCities.length > 0 && (
          <div
            className="moon-trajectory-modal__grid"
            style={{
              gridTemplateColumns: `repeat(${Math.min(3, cells.length)}, 1fr)`,
              // Chaque ligne supplémentaire réduit la taille des diagrammes — garantit que la grille
              // tienne dans la modale sans scroll, quel que soit le nombre de villes suivies.
              '--diagram-w': `${Math.min(28, 56 / Math.max(1, Math.ceil(cells.length / 3)))}dvmin`,
            } as React.CSSProperties}
          >
            {cells.map((cell) => (
              <div key={cell.id} className="moon-trajectory-modal__cell">
                <svg viewBox="0 0 220 180" className="moon-trajectory-modal__svg">
                  <rect x="0" y="0" width="220" height="180" className="moon-trajectory-modal__background" />
                  {background}
                  <circle
                    cx={cell.x}
                    cy={cell.y}
                    r={cell.radiusPx}
                    className={
                      cell.visible === false ? 'moon-trajectory-modal__moon moon-trajectory-modal__moon--dimmed' : 'moon-trajectory-modal__moon'
                    }
                  />
                </svg>
                <span className="moon-trajectory-modal__label">{cell.name}</span>
                {cell.visible !== undefined && (
                  <span
                    className={
                      cell.visible ? 'moon-trajectory-modal__visibility' : 'moon-trajectory-modal__visibility moon-trajectory-modal__visibility--hidden'
                    }
                  >
                    {cell.visible ? `Visible · ${cell.altitudeDeg!.toFixed(0)}°` : 'Sous l\'horizon'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
