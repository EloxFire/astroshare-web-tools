import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, Trash2 } from 'lucide-react';
import { getCityCoords } from '../api/getCityCoords';
import { cities as knownCities } from '../data/cities';
import type { TrackedCity } from '../types/TrackedCity';
import './TrackedCitiesPanel.css';

interface CitySuggestion {
  name: string;
  lat: number;
  lon: number;
  country?: string;
  state?: string;
}

const MAX_LOCAL_SUGGESTIONS = 8;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// L'API de géocodage ne renvoie qu'un seul résultat par requête (pas de paramètre de limite
// exploitable côté client) — insuffisant pour une vraie autocomplétion. On complète donc avec la
// liste de villes déjà embarquée dans l'app pour des suggestions multiples et instantanées, l'API
// venant surtout couvrir les villes plus petites absentes de cette liste.
const getLocalMatches = (query: string): CitySuggestion[] => {
  const normalizedQuery = normalize(query);
  return knownCities
    .filter((city) => normalize(city.name).includes(normalizedQuery))
    .sort((a, b) => {
      const aStartsWith = normalize(a.name).startsWith(normalizedQuery) ? 0 : 1;
      const bStartsWith = normalize(b.name).startsWith(normalizedQuery) ? 0 : 1;
      if (aStartsWith !== bStartsWith) return aStartsWith - bStartsWith;
      return b.population - a.population;
    })
    .slice(0, MAX_LOCAL_SUGGESTIONS)
    .map((city) => ({ name: city.name, lat: city.lat, lon: city.lon }));
};

const isSameCity = (a: CitySuggestion, b: CitySuggestion) =>
  normalize(a.name) === normalize(b.name) && Math.abs(a.lat - b.lat) < 0.05 && Math.abs(a.lon - b.lon) < 0.05;

interface TrackedCitiesPanelProps {
  cities: TrackedCity[];
  onAdd: (name: string, lat: number, lng: number) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onSetAllEnabled: (enabled: boolean) => void;
}

export default function TrackedCitiesPanel({ cities, onAdd, onToggle, onRemove, onSetAllEnabled }: TrackedCitiesPanelProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed.includes(',')) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }

    const localMatches = getLocalMatches(trimmed);
    setSuggestions(localMatches);
    setSuggestionsOpen(localMatches.length > 0);

    const requestId = ++requestIdRef.current;
    const debounce = setTimeout(async () => {
      setLoading(true);
      try {
        const results: CitySuggestion[] = await getCityCoords(trimmed);
        if (requestId !== requestIdRef.current) return;
        setSuggestions((prev) => {
          const merged = [...prev];
          (results ?? []).forEach((match) => {
            if (!merged.some((existing) => isSameCity(existing, match))) merged.push(match);
          });
          return merged;
        });
        setSuggestionsOpen(true);
      } catch {
        // Les suggestions locales restent affichées même si l'appel réseau échoue.
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query]);

  const selectCity = (city: CitySuggestion) => {
    onAdd(city.country ? `${city.name} (${city.country})` : city.name, city.lat, city.lon);
    setQuery('');
    setSuggestions([]);
    setSuggestionsOpen(false);
  };

  const resolveCity = async (name: string): Promise<CitySuggestion | null> => {
    const localMatch = getLocalMatches(name)[0];
    if (localMatch && normalize(localMatch.name) === normalize(name)) return localMatch;
    try {
      const results: CitySuggestion[] = await getCityCoords(name);
      return results?.[0] ?? localMatch ?? null;
    } catch {
      return localMatch ?? null;
    }
  };

  const handleAddFirstMatch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const names = trimmed
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    if (names.length > 1) {
      setLoading(true);
      setError(null);
      const resolved = await Promise.all(names.map(async (name) => ({ name, match: await resolveCity(name) })));
      resolved.forEach(({ match }) => {
        if (match) onAdd(match.country ? `${match.name} (${match.country})` : match.name, match.lat, match.lon);
      });
      const notFound = resolved.filter(({ match }) => !match).map(({ name }) => name);
      setLoading(false);
      setQuery('');
      setSuggestions([]);
      setSuggestionsOpen(false);
      if (notFound.length > 0) setError(`Introuvable(s) : ${notFound.join(', ')}`);
      return;
    }

    if (suggestions.length > 0) {
      selectCity(suggestions[0]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await getCityCoords(trimmed);
      if (!results?.length) {
        setError('Ville introuvable');
        return;
      }
      selectCity(results[0]);
    } catch {
      setError('Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tracked-cities-panel">
      <p className="tracked-cities-panel__title">Villes suivies</p>

      <div className="tracked-cities-panel__search-wrap">
        <div className="tracked-cities-panel__search">
          <input
            className="tracked-cities-panel__input"
            placeholder="Ville, ville, ville..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAddFirstMatch()}
            onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
            onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
          />
          <button
            type="button"
            className="tracked-cities-panel__add"
            onClick={handleAddFirstMatch}
            aria-label="Ajouter la ville"
          >
            {loading ? <Loader2 size={16} className="tracked-cities-panel__spinner" /> : <Search size={16} />}
          </button>
        </div>

        {suggestionsOpen && suggestions.length > 0 && (
          <ul className="tracked-cities-panel__suggestions">
            {suggestions.map((suggestion, index) => (
              <li key={`${suggestion.name}-${suggestion.lat}-${suggestion.lon}-${index}`}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selectCity(suggestion)}>
                  <span className="tracked-cities-panel__suggestion-name">{suggestion.name}</span>
                  {(suggestion.state || suggestion.country) && (
                    <span className="tracked-cities-panel__suggestion-meta">
                      {[suggestion.state, suggestion.country].filter(Boolean).join(', ')}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="tracked-cities-panel__error">{error}</p>}

      {cities.length === 0 ? (
        <p className="tracked-cities-panel__hint">Aucune ville pour l'instant — ajoutez-en une ci-dessus.</p>
      ) : (
        <>
          {cities.length > 1 && (
            <div className="tracked-cities-panel__bulk-actions">
              <button type="button" onClick={() => onSetAllEnabled(true)}>
                Tout afficher
              </button>
              <span aria-hidden>·</span>
              <button type="button" onClick={() => onSetAllEnabled(false)}>
                Tout masquer
              </button>
            </div>
          )}
          <ul className="tracked-cities-panel__list">
            {cities.map((city) => (
              <li key={city.id} className="tracked-cities-panel__item">
                <label className="tracked-cities-panel__checkbox">
                  <input type="checkbox" checked={city.enabled} onChange={() => onToggle(city.id)} />
                  <span>{city.name}</span>
                </label>
                <button
                  type="button"
                  className="tracked-cities-panel__remove"
                  onClick={() => onRemove(city.id)}
                  aria-label={`Retirer ${city.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
