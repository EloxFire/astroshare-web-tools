import { useEffect, useRef, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { Minus, Plus } from 'lucide-react';
import L from 'leaflet';
import './MapControls.css';

export const pinIcon = L.divIcon({
  className: 'eclipse-map__pin',
  html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22c0-7.7-6.3-14-14-14z" fill="#F4C238"/>
    <circle cx="14" cy="14" r="5.5" fill="#000000"/>
  </svg>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
});

export function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function ZoomSlider() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const containerRef = useRef<HTMLDivElement | null>(null);

  useMapEvents({
    zoomend() {
      setZoom(map.getZoom());
    },
  });

  // Ce contrôle est rendu à l'intérieur du conteneur Leaflet : sans ceci, un mousedown/touch sur
  // le slider remonte jusqu'aux gestionnaires de drag/click de la carte (déplacement au lieu de zoom).
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    L.DomEvent.disableClickPropagation(node);
    L.DomEvent.disableScrollPropagation(node);
  }, []);

  return (
    <div className="eclipse-map__zoom-slider" ref={containerRef}>
      <button
        type="button"
        onClick={() => map.setZoom(Math.min(map.getZoom() + 0.5, map.getMaxZoom()))}
        aria-label="Zoomer"
        title="Zoomer"
      >
        <Plus size={14} />
      </button>
      <input
        type="range"
        min={map.getMinZoom()}
        max={map.getMaxZoom()}
        step={0.1}
        value={zoom}
        onChange={(e) => map.setZoom(Number(e.target.value))}
        aria-label="Niveau de zoom"
        title="Niveau de zoom"
      />
      <button
        type="button"
        onClick={() => map.setZoom(Math.max(map.getZoom() - 0.5, map.getMinZoom()))}
        aria-label="Dézoomer"
        title="Dézoomer"
      >
        <Minus size={14} />
      </button>
    </div>
  );
}

export function FlyToController({ position }: { position: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo([position.lat, position.lng], 5, { duration: 0.8 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);
  return null;
}
