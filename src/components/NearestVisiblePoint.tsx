import { useState } from 'react';
import { Navigation } from 'lucide-react';
import { findNearestVisiblePoint, MAX_SEARCH_KM } from '../helpers/findNearestVisiblePoint';
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
  // Reflète le rayon de recherche en cours vers l'écran, qui l'utilise pour dessiner le cercle
  // d'étendue en direct sur la carte (voir EclipseMap) — null quand aucune recherche n'est en cours.
  onSearchRadiusChange?: (km: number | null) => void;
}

const formatKm = (km: number) => Math.round(km).toLocaleString('fr-FR');

// Échelle logarithmique plutôt que linéaire : les anneaux de recherche croissent géométriquement
// (200 km à 20 015 km), un rayon linéaire resterait donc visuellement minuscule jusqu'aux tout
// derniers anneaux.
const progressRatio = (km: number) => Math.min(1, Math.log(km + 1) / Math.log(MAX_SEARCH_KM + 1));

// Rayon max (unités du viewBox) du cercle "étendue de recherche" dans le mini radar ci-dessous.
const RADAR_MAX_RADIUS = 26;

export default function NearestVisiblePoint({
  origin,
  checkVisible,
  onSelect,
  onSearchRadiusChange,
}: NearestVisiblePointProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'empty'>('idle');
  const [result, setResult] = useState<Result | null>(null);
  const [searchRadiusKm, setSearchRadiusKm] = useState(0);

  const updateSearchRadius = (km: number) => {
    setSearchRadiusKm(km);
    onSearchRadiusChange?.(km);
  };

  const handleSearch = async () => {
    setStatus('loading');
    updateSearchRadius(0);
    try {
      const point = await findNearestVisiblePoint(origin.lat, origin.lng, checkVisible, updateSearchRadius);
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
    } finally {
      onSearchRadiusChange?.(null);
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
    const extentRadius = Math.max(2, progressRatio(searchRadiusKm) * RADAR_MAX_RADIUS);
    return (
      <div className="nearest-visible-point nearest-visible-point--loading">
        <svg viewBox="0 0 60 60" width="48" height="48" className="nearest-visible-point__radar" aria-hidden>
          <circle cx="30" cy="30" r={RADAR_MAX_RADIUS} className="nearest-visible-point__radar-bound" />
          <circle cx="30" cy="30" r={RADAR_MAX_RADIUS * 0.66} className="nearest-visible-point__radar-bound" />
          <circle cx="30" cy="30" r={RADAR_MAX_RADIUS * 0.33} className="nearest-visible-point__radar-bound" />
          <circle cx="30" cy="30" r={RADAR_MAX_RADIUS} className="nearest-visible-point__radar-pulse" />
          <circle cx="30" cy="30" r={extentRadius} className="nearest-visible-point__radar-extent" />
          <circle cx="30" cy="30" r="2.5" className="nearest-visible-point__radar-origin" />
        </svg>
        <div className="nearest-visible-point__loading-text">
          <span>Recherche d'un point visible et dégagé…</span>
          <span className="nearest-visible-point__radius-label">jusqu'à {formatKm(searchRadiusKm)} km</span>
        </div>
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
