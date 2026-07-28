import { useState } from 'react';
import { Loader2, Navigation } from 'lucide-react';
import { findNearestVisiblePoint } from '../helpers/findNearestVisiblePoint';
import { azimuthToCompassPhrase } from '../helpers/visibilityRating';
import { getLocationName } from '../api/getLocationFromCoords';
import SimpleButton from './SimpleButton';
import './NearestVisiblePoint.css';

interface Result {
  lat: number;
  lng: number;
  distanceKm: number;
  directionPhrase: string;
  name: string;
}

interface NearestVisiblePointProps {
  origin: { lat: number; lng: number };
  checkVisible: (lat: number, lng: number) => Promise<boolean>;
  onSelect: (lat: number, lng: number, name: string) => void;
}

export default function NearestVisiblePoint({ origin, checkVisible, onSelect }: NearestVisiblePointProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'empty'>('idle');
  const [result, setResult] = useState<Result | null>(null);

  const handleSearch = async () => {
    setStatus('loading');
    try {
      const point = await findNearestVisiblePoint(origin.lat, origin.lng, checkVisible);
      if (!point) {
        setStatus('empty');
        return;
      }
      const directionPhrase = azimuthToCompassPhrase(point.bearingDeg);
      const distanceKm = Math.round(point.distanceKm);
      let name = `${distanceKm} km ${directionPhrase}`;
      try {
        const location = await getLocationName({ lat: point.lat, lon: point.lng });
        name = location.local_names?.fr ?? location.name ?? name;
      } catch {
        // Nom de repli déjà défini ci-dessus.
      }
      setResult({ lat: point.lat, lng: point.lng, distanceKm, directionPhrase, name });
      setStatus('done');
    } catch {
      setStatus('empty');
    }
  };

  if (status === 'idle') {
    return (
      <div className="nearest-visible-point">
        <SimpleButton
          text="Voir le point visible le plus proche"
          onPress={handleSearch}
          backgroundColor="#FFFFFF0D"
          textColor="#FFFFFF"
        />
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="nearest-visible-point nearest-visible-point--loading">
        <Loader2 size={16} className="nearest-visible-point__spinner" />
        <span>Recherche du point visible le plus proche…</span>
      </div>
    );
  }

  if (status === 'empty' || !result) {
    return <p className="nearest-visible-point__empty">Aucun point visible trouvé à proximité.</p>;
  }

  return (
    <button
      type="button"
      className="nearest-visible-point__result"
      onClick={() => onSelect(result.lat, result.lng, result.name)}
    >
      <Navigation size={15} />
      <div>
        <span className="nearest-visible-point__name">{result.name}</span>
        <span className="nearest-visible-point__meta">
          {result.distanceKm} km {result.directionPhrase}
        </span>
      </div>
    </button>
  );
}
