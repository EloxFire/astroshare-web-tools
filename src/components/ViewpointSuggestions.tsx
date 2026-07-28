import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { findClearViewpoints } from '../helpers/horizonObstruction';
import { azimuthToCompassPhrase } from '../helpers/visibilityRating';
import { getLocationName } from '../api/getLocationFromCoords';
import SimpleButton from './SimpleButton';
import './ViewpointSuggestions.css';

interface Suggestion {
  lat: number;
  lng: number;
  distanceKm: number;
  directionPhrase: string;
  name: string;
}

interface ViewpointSuggestionsProps {
  origin: { lat: number; lng: number };
  targetAltitudeDeg: number;
  targetAzimuthDeg: number;
  onSelect: (lat: number, lng: number, name: string) => void;
}

export default function ViewpointSuggestions({
  origin,
  targetAltitudeDeg,
  targetAzimuthDeg,
  onSelect,
}: ViewpointSuggestionsProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'empty'>('idle');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const handleSearch = async () => {
    setStatus('loading');
    try {
      const results = await findClearViewpoints(origin.lat, origin.lng, targetAltitudeDeg, targetAzimuthDeg);
      if (results.length === 0) {
        setStatus('empty');
        return;
      }
      const named = await Promise.all(
        results.map(async (result) => {
          const directionPhrase = azimuthToCompassPhrase(result.bearingFromOriginDeg);
          try {
            const location = await getLocationName({ lat: result.lat, lon: result.lng });
            const name = location.local_names?.fr ?? location.name ?? `${result.distanceKm} km ${directionPhrase}`;
            return { ...result, directionPhrase, name };
          } catch {
            return { ...result, directionPhrase, name: `${result.distanceKm} km ${directionPhrase}` };
          }
        }),
      );
      setSuggestions(named);
      setStatus('done');
    } catch {
      setStatus('empty');
    }
  };

  if (status === 'idle') {
    return (
      <div className="viewpoint-suggestions">
        <SimpleButton
          text="Voir des points de vue dégagés à proximité"
          onPress={handleSearch}
          backgroundColor="#FFFFFF0D"
          textColor="#FFFFFF"
        />
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="viewpoint-suggestions viewpoint-suggestions--loading">
        <Loader2 size={16} className="viewpoint-suggestions__spinner" />
        <span>Recherche de points de vue dégagés…</span>
      </div>
    );
  }

  if (status === 'empty') {
    return <p className="viewpoint-suggestions__empty">Aucun point de vue dégagé trouvé dans un rayon de 30 km.</p>;
  }

  return (
    <div className="viewpoint-suggestions">
      <p className="viewpoint-suggestions__title">Points de vue dégagés à proximité</p>
      <ul className="viewpoint-suggestions__list">
        {suggestions.map((suggestion) => (
          <li key={`${suggestion.lat},${suggestion.lng}`}>
            <button type="button" onClick={() => onSelect(suggestion.lat, suggestion.lng, suggestion.name)}>
              <span className="viewpoint-suggestions__name">{suggestion.name}</span>
              <span className="viewpoint-suggestions__meta">
                {suggestion.distanceKm} km {suggestion.directionPhrase}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
