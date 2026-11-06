import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, X } from 'lucide-react';
import type { SolarEclipse } from '../types/SolarEclipse';
import type { LunarEclipse } from '../types/LunarEclipse';
import {
  buildLunarAnimationTimes,
  buildSolarAnimationTimes,
  simulateLunarPath,
  simulateSolarPath,
  type Observer,
} from '../helpers/moonPathSimulation';
import { formatEventTime } from '../helpers/formatTime';
import './MoonAnimationModal.css';

const SUN_RADIUS_PX = 50;
const PENUMBRA_RADIUS_PX = 65;
const CENTER_X = 110;
const CENTER_Y = 95;
const FRAME_COUNT = 90;
const ANIMATION_DURATION_MS = 7000;

interface Cell {
  x: number;
  y: number;
  radiusPx: number;
  time: Date;
}

type MoonAnimationModalProps =
  | { kind: 'solar'; data: SolarEclipse; observer: Observer; useLocalTime: boolean; onClose: () => void }
  | { kind: 'lunar'; data: LunarEclipse; useLocalTime: boolean; onClose: () => void };

function buildCells(props: MoonAnimationModalProps): Cell[] | null {
  if (props.kind === 'solar') {
    const times = buildSolarAnimationTimes(props.data, FRAME_COUNT);
    if (!times) return null;
    const frames = simulateSolarPath(times, props.observer, props.data.physicalData);
    const pxPerDeg = SUN_RADIUS_PX / frames[0].sunRadiusDeg;
    return frames.map((frame) => {
      const angleRad = (frame.localAngleDeg * Math.PI) / 180;
      return {
        x: CENTER_X + Math.sin(angleRad) * frame.separationDeg * pxPerDeg,
        y: CENTER_Y - Math.cos(angleRad) * frame.separationDeg * pxPerDeg,
        radiusPx: frame.moonRadiusDeg * pxPerDeg,
        time: frame.time,
      };
    });
  }

  const times = buildLunarAnimationTimes(props.data, FRAME_COUNT);
  if (!times) return null;
  const frames = simulateLunarPath(times);
  const pxPerUnit = PENUMBRA_RADIUS_PX / props.data.radius.penumbra;
  return frames.map((frame) => {
    const angleRad = (frame.angleDeg * Math.PI) / 180;
    return {
      x: CENTER_X + Math.sin(angleRad) * frame.axis * pxPerUnit,
      y: CENTER_Y - Math.cos(angleRad) * frame.axis * pxPerUnit,
      radiusPx: frame.moonRadius * pxPerUnit,
      time: frame.time,
    };
  });
}

export default function MoonAnimationModal(props: MoonAnimationModalProps) {
  const { useLocalTime, onClose } = props;
  const [playing, setPlaying] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimestampRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // `props` reste la même référence tant que le parent ne repasse pas de nouvelles props — stable
  // across les re-rendus déclenchés par `playing`/`frameIndex`, qui n'affectent pas `props`.
  const cells = useMemo(() => buildCells(props), [props]);

  const frameDurationMs = cells ? ANIMATION_DURATION_MS / cells.length : 0;

  useEffect(() => {
    if (!playing || !cells) return;

    const step = (timestamp: number) => {
      if (lastTimestampRef.current == null) lastTimestampRef.current = timestamp;
      const elapsed = timestamp - lastTimestampRef.current;
      if (elapsed >= frameDurationMs) {
        lastTimestampRef.current = timestamp;
        setFrameIndex((i) => {
          if (i + 1 >= cells.length) {
            setPlaying(false);
            return cells.length - 1;
          }
          return i + 1;
        });
      }
      requestRef.current = requestAnimationFrame(step);
    };

    requestRef.current = requestAnimationFrame(step);
    return () => {
      if (requestRef.current != null) cancelAnimationFrame(requestRef.current);
      lastTimestampRef.current = undefined;
    };
  }, [playing, cells, frameDurationMs]);

  if (!cells) return null;

  const cell = cells[frameIndex];

  const handlePlayToggle = () => {
    if (!playing && frameIndex >= cells.length - 1) setFrameIndex(0);
    setPlaying((p) => !p);
  };

  return createPortal(
    <div
      className="moon-animation-modal__backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="moon-animation-modal__panel" role="dialog" aria-modal="true" aria-label="Animation de la trajectoire de la Lune">
        <div className="moon-animation-modal__header">
          <div>
            <h2 className="moon-animation-modal__title">Animation de la trajectoire</h2>
            <p className="moon-animation-modal__note">De 5 minutes avant le premier contact à 5 minutes après le dernier</p>
          </div>
          <button type="button" className="moon-animation-modal__close" onClick={onClose} aria-label="Fermer">
            <X size={20} color="#FFFFFF" />
          </button>
        </div>

        <div className="moon-animation-modal__stage">
          <svg viewBox="0 0 220 180" className="moon-animation-modal__svg">
            <rect x="0" y="0" width="220" height="180" className="moon-animation-modal__background" />
            {props.kind === 'solar' ? (
              <circle cx={CENTER_X} cy={CENTER_Y} r={SUN_RADIUS_PX} className="moon-animation-modal__sun" />
            ) : (
              <>
                <circle cx={CENTER_X} cy={CENTER_Y} r={PENUMBRA_RADIUS_PX} className="moon-animation-modal__penumbra" />
                <circle
                  cx={CENTER_X}
                  cy={CENTER_Y}
                  r={props.data.radius.umbra * (PENUMBRA_RADIUS_PX / props.data.radius.penumbra)}
                  className="moon-animation-modal__umbra"
                />
              </>
            )}
            <circle cx={cell.x} cy={cell.y} r={cell.radiusPx} className="moon-animation-modal__moon" />
          </svg>
        </div>

        <div className="moon-animation-modal__controls">
          <button
            type="button"
            className="moon-animation-modal__play"
            onClick={handlePlayToggle}
            aria-label={playing ? 'Pause' : 'Lecture'}
          >
            {playing ? <Pause size={16} color="#000000" /> : <Play size={16} color="#000000" />}
          </button>
          <input
            type="range"
            min={0}
            max={cells.length - 1}
            value={frameIndex}
            onChange={(e) => {
              setPlaying(false);
              setFrameIndex(Number(e.target.value));
            }}
            className="moon-animation-modal__scrubber"
          />
          <span className="moon-animation-modal__time">
            {formatEventTime(cell.time.toISOString().slice(0, 19), useLocalTime)}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
