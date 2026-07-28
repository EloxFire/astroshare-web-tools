import { useState } from 'react';
import { Binoculars, Loader2 } from 'lucide-react';
import { findClearViewpoints } from '../helpers/horizonObstruction';
import { azimuthToCompassPhrase } from '../helpers/visibilityRating';
import { getLocationName } from '../api/getLocationFromCoords';
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
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const handleToggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    // Résultats déjà chargés lors d'une ouverture précédente : on rouvre juste le popover.
    if (status === 'done' || status === 'empty') return;

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

  const handlePick = (suggestion: Suggestion) => {
    onSelect(suggestion.lat, suggestion.lng, suggestion.name);
    setOpen(false);
  };

  return (
    <div className="viewpoint-suggestions">
      <button
        type="button"
        className="viewpoint-suggestions__trigger"
        onClick={handleToggle}
        aria-expanded={open}
      >
        {status === 'loading' ? (
          <Loader2 size={14} className="viewpoint-suggestions__spinner" />
        ) : (
          <Binoculars size={14} />
        )}
        <span>Points de vue dégagés</span>
      </button>

      {open && (
        <div className="viewpoint-suggestions__popover">
          {status === 'loading' && (
            <div className="viewpoint-suggestions__loading">
              <Loader2 size={16} className="viewpoint-suggestions__spinner" />
              <span>Recherche de points de vue dégagés…</span>
            </div>
          )}

          {status === 'empty' && (
            <p className="viewpoint-suggestions__empty">Aucun point de vue dégagé trouvé dans un rayon de 30 km.</p>
          )}

          {status === 'done' && (
            <ul className="viewpoint-suggestions__list">
              {suggestions.map((suggestion) => (
                <li key={`${suggestion.lat},${suggestion.lng}`}>
                  <button type="button" onClick={() => handlePick(suggestion)}>
                    <span className="viewpoint-suggestions__name">{suggestion.name}</span>
                    <span className="viewpoint-suggestions__meta">
                      {suggestion.distanceKm} km {suggestion.directionPhrase}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
