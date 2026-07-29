import { useEffect, useState } from 'react';
import type { TrackedCity } from '../types/TrackedCity';

const STORAGE_PREFIX = 'astroshare:tracked-cities:';

const loadFromStorage = (storageKey: string): TrackedCity[] => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Persiste les villes suivies dans localStorage, sous une clé propre à chaque éclipse (kind + date) :
// les villes suivies pour l'éclipse solaire du 12 août 2026 n'apparaissent pas sur celle du 17
// février, ni sur une éclipse lunaire.
export const useTrackedCities = (storageKey: string) => {
  const [trackedCities, setTrackedCities] = useState<TrackedCity[]>(() => loadFromStorage(storageKey));

  // Le composant écran n'est pas remonté quand seule la date de l'URL change (même Route) : sans ce
  // rechargement explicite, la liste resterait celle de l'éclipse précédemment consultée.
  useEffect(() => {
    setTrackedCities(loadFromStorage(storageKey));
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(trackedCities));
    } catch {
      // Stockage indisponible (navigation privée, quota dépassé...) : on continue sans persister.
    }
  }, [storageKey, trackedCities]);

  const addTrackedCity = (name: string, lat: number, lng: number) => {
    const id = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    setTrackedCities((prev) =>
      prev.some((city) => city.id === id) ? prev : [...prev, { id, name, lat, lng, enabled: true }],
    );
  };

  const toggleTrackedCity = (id: string) => {
    setTrackedCities((prev) => prev.map((city) => (city.id === id ? { ...city, enabled: !city.enabled } : city)));
  };

  const removeTrackedCity = (id: string) => {
    setTrackedCities((prev) => prev.filter((city) => city.id !== id));
  };

  const setAllTrackedCitiesEnabled = (enabled: boolean) => {
    setTrackedCities((prev) => prev.map((city) => ({ ...city, enabled })));
  };

  return { trackedCities, addTrackedCity, toggleTrackedCity, removeTrackedCity, setAllTrackedCitiesEnabled };
};
