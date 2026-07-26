import { useEffect, useMemo, useRef, useState } from 'react';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { cities } from '../data/cities';
import { astroshareApi } from '../api/astroshareApi';
import './CityObscurationLayer.css';

const MIN_ZOOM_TO_SHOW = 3;
const MAX_CITIES = 60;
const MAX_CITIES_EXPANDED = 200;

interface CityObscurationLayerProps {
  year: string;
  expanded: boolean;
  onLoadingChange?: (loading: boolean) => void;
}

export default function CityObscurationLayer({ year, expanded, onLoadingChange }: CityObscurationLayerProps) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [bounds, setBounds] = useState(map.getBounds());
  const [obscurationByCity, setObscurationByCity] = useState<Record<string, number | null>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useMapEvents({
    moveend() {
      setZoom(map.getZoom());
      setBounds(map.getBounds());
    },
    zoomend() {
      setZoom(map.getZoom());
      setBounds(map.getBounds());
    },
  });

  useEffect(() => {
    setObscurationByCity({});
    fetchedRef.current = new Set();
  }, [year]);

  const visibleCities = useMemo(() => {
    if (!expanded && zoom < MIN_ZOOM_TO_SHOW) return [];
    return cities
      .filter((city) => bounds.contains([city.lat, city.lon]))
      .sort((a, b) => b.population - a.population)
      .slice(0, expanded ? MAX_CITIES_EXPANDED : MAX_CITIES);
  }, [zoom, bounds, expanded]);

  useEffect(() => {
    const toFetch = visibleCities.filter((city) => !fetchedRef.current.has(city.name));
    if (toFetch.length === 0) return;
    toFetch.forEach((city) => fetchedRef.current.add(city.name));

    let cancelled = false;
    onLoadingChange?.(true);
    (async () => {
      const results = await Promise.all(
        toFetch.map(async (city) => {
          try {
            const response = await astroshareApi.get('/eclipses/solar', {
              params: { year, observer: `${city.lat},${city.lon}` },
            });
            const data = response.data[0];
            return { name: city.name, obscuration: (data?.obscuration as number | undefined) ?? null };
          } catch {
            return { name: city.name, obscuration: null };
          }
        }),
      );
      if (cancelled) return;
      setObscurationByCity((prev) => {
        const next = { ...prev };
        results.forEach(({ name, obscuration }) => {
          next[name] = obscuration;
        });
        return next;
      });
      onLoadingChange?.(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [visibleCities, year, onLoadingChange]);

  return (
    <>
      {visibleCities.map((city) => {
        const obscuration = obscurationByCity[city.name];
        if (obscuration === undefined || obscuration === null) return null;
        const icon = L.divIcon({
          className: 'city-obscuration-marker',
          html: `<div class="city-obscuration-marker__badge">${Math.round(obscuration)}%</div><div class="city-obscuration-marker__name">${city.name}</div>`,
          iconSize: [100, 34],
          iconAnchor: [50, 8],
        });
        return <Marker key={city.name} position={[city.lat, city.lon]} icon={icon} interactive={false} />;
      })}
    </>
  );
}
