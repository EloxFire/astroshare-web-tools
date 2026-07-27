import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { equatorialToHorizontal } from '../helpers/celestialPosition';
import type { LunarEclipse } from '../types/LunarEclipse';
import type { TrackedCity } from '../types/TrackedCity';
import './CityVisibilityLayer.css';

interface CityVisibilityLayerProps {
  data: LunarEclipse;
  cities: TrackedCity[];
  onCityClick: (city: TrackedCity) => void;
}

export default function CityVisibilityLayer({ data, cities, onCityClick }: CityVisibilityLayerProps) {
  const referenceEvent = data.events.greatest ?? data.events.U2 ?? data.events.P1;
  if (!referenceEvent) return null;

  const enabledCities = cities.filter((city) => city.enabled);

  return (
    <>
      {enabledCities.map((city) => {
        const { altitude } = equatorialToHorizontal(
          referenceEvent.date,
          referenceEvent.Moon.RA,
          referenceEvent.Moon.DEC,
          city.lat,
          city.lng,
        );
        const visible = altitude > 0;
        const icon = L.divIcon({
          className: 'city-visibility-marker',
          html: `<div class="city-visibility-marker__badge city-visibility-marker__badge--${visible ? 'visible' : 'hidden'}">${
            visible ? 'Visible' : 'Sous l\'horizon'
          }</div><div class="city-visibility-marker__name">${city.name}</div>`,
          iconSize: [110, 40],
          iconAnchor: [55, 8],
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
