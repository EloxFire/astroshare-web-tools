import { useEffect, useState } from 'react';
import { getHorizonProfile, isTerrainCheckAvailable, summarizeObstruction, type HorizonSample } from './horizonObstruction';

// Calcule une seule fois le profil de relief pour un point/azimut donnés (asynchrone, nécessite un
// token Mapbox — no-op silencieux sinon), partagé entre la note de circonstances locales et la
// couche visuelle sur la carte plutôt que refait deux fois indépendamment.
export const useTerrainProfile = (
  location: { lat: number; lng: number } | null,
  altitudeDeg: number | undefined,
  azimuthDeg: number | undefined,
) => {
  const [profile, setProfile] = useState<HorizonSample[] | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setProfile(null);
    if (!location || altitudeDeg == null || azimuthDeg == null || !isTerrainCheckAvailable()) return;

    let cancelled = false;
    setChecking(true);
    getHorizonProfile(location.lat, location.lng, azimuthDeg)
      .then((result) => {
        if (!cancelled) setProfile(result);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [location?.lat, location?.lng, altitudeDeg, azimuthDeg]);

  const result = profile && altitudeDeg != null ? summarizeObstruction(profile, altitudeDeg) : null;

  return { profile, result, checking };
};
