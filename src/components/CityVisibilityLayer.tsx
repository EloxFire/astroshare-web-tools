import { useMemo, useState } from 'react';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { cities } from '../data/cities';
import { equatorialToHorizontal } from '../helpers/celestialPosition';
import type { LunarEclipse } from '../types/LunarEclipse';
import './CityVisibilityLayer.css';

const MIN_ZOOM_TO_SHOW = 3.5;
const MAX_CITIES = 45;
const MAX_CITIES_EXPANDED = 300;

interface CityVisibilityLayerProps {
  data: LunarEclipse;
  expanded: boolean;
}

export default function CityVisibilityLayer({ data, expanded }: CityVisibilityLayerProps) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [bounds, setBounds] = useState(map.getBounds());

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

  const referenceEvent = data.events.greatest ?? data.events.U2 ?? data.events.P1;

  const visibleCities = useMemo(() => {
    if ((!expanded && zoom < MIN_ZOOM_TO_SHOW) || !referenceEvent) return [];
    return cities
      .filter((city) => bounds.contains([city.lat, city.lon]))
      .sort((a, b) => b.population - a.population)
      .slice(0, expanded ? MAX_CITIES_EXPANDED : MAX_CITIES)
      .map((city) => {
        const { altitude } = equatorialToHorizontal(
          referenceEvent.date,
          referenceEvent.Moon.RA,
          referenceEvent.Moon.DEC,
          city.lat,
          city.lon,
        );
        return { ...city, altitude };
      });
  }, [zoom, bounds, referenceEvent, expanded]);

  if (!referenceEvent) return null;

  return (
    <>
      {visibleCities.map((city) => {
        const visible = city.altitude > 0;
        const icon = L.divIcon({
          className: 'city-visibility-marker',
          html: `<div class="city-visibility-marker__badge city-visibility-marker__badge--${visible ? 'visible' : 'hidden'}">${
            visible ? 'Visible' : 'Sous l\'horizon'
          }</div><div class="city-visibility-marker__name">${city.name}</div>`,
          iconSize: [110, 34],
          iconAnchor: [55, 8],
        });
        return <Marker key={city.name} position={[city.lat, city.lon]} icon={icon} interactive={false} />;
      })}
    </>
  );
}
