import { useEffect, useState } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { astroshareApi } from '../api/astroshareApi';
import { buildEclipseShapeSvg } from '../helpers/eclipseShapeSvg';
import type { TrackedCity } from '../types/TrackedCity';
import './CityObscurationLayer.css';

interface CityCircumstances {
  obscuration: number | null;
  magnitude: number | null;
  sunRadius: number | null;
  moonRadius: number | null;
}

interface CityObscurationLayerProps {
  year: string;
  cities: TrackedCity[];
  onCityClick: (city: TrackedCity) => void;
}

export default function CityObscurationLayer({ year, cities, onCityClick }: CityObscurationLayerProps) {
  const [circumstancesById, setCircumstancesById] = useState<Record<string, CityCircumstances | null>>({});
  const enabledCities = cities.filter((city) => city.enabled);

  useEffect(() => {
    setCircumstancesById({});
  }, [year]);

  useEffect(() => {
    const toFetch = enabledCities.filter((city) => !(city.id in circumstancesById));
    if (toFetch.length === 0) return;

    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        toFetch.map(async (city) => {
          try {
            const response = await astroshareApi.get('/eclipses/solar', {
              params: { year, observer: `${city.lat},${city.lng}` },
            });
            const data = response.data[0];
            const greatest = data?.events?.greatest;
            const value: CityCircumstances | null = data
              ? {
                  obscuration: (data.obscuration as number | undefined) ?? null,
                  magnitude: (data.magnitude as number | undefined) ?? null,
                  sunRadius: greatest?.Sun?.radius ?? null,
                  moonRadius: greatest?.Moon?.radius ?? null,
                }
              : null;
            return { id: city.id, value };
          } catch {
            return { id: city.id, value: null };
          }
        }),
      );
      if (cancelled) return;
      setCircumstancesById((prev) => {
        const next = { ...prev };
        results.forEach(({ id, value }) => {
          next[id] = value;
        });
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, year]);

  return (
    <>
      {enabledCities.map((city) => {
        const circumstances = circumstancesById[city.id];
        if (!circumstances || circumstances.obscuration == null) return null;

        const shapeSvg =
          circumstances.magnitude != null && circumstances.sunRadius && circumstances.moonRadius
            ? buildEclipseShapeSvg({
                magnitude: circumstances.magnitude,
                sunRadius: circumstances.sunRadius,
                moonRadius: circumstances.moonRadius,
                size: 28,
              })
            : '';

        const icon = L.divIcon({
          className: 'city-obscuration-marker',
          html: `<div class="city-obscuration-marker__row">${shapeSvg}<div class="city-obscuration-marker__badge">${circumstances.obscuration}%</div></div><div class="city-obscuration-marker__name">${city.name}</div>`,
          iconSize: [130, 50],
          iconAnchor: [65, 12],
        });
        return (
          <Marker
            key={city.id}
            position={[city.lat, city.lng]}
            icon={icon}
            eventHandlers={{ click: () => onCityClick(city) }}
          />
        );
      })}
    </>
  );
}
