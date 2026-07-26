import type { RefObject } from 'react';
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { SolarEclipse } from '../types/SolarEclipse';
import { solarEclipseVisibilityLinesColors } from '../constants';
import { ClickHandler, FlyToController, ZoomSlider, pinIcon } from './map/MapControls';
import CityObscurationLayer from './CityObscurationLayer';

export const extractVisibilityLinesCoordinates = (geometry: [number, number, number][][]) =>
  geometry.map((coordSet) => coordSet.map((coord) => [coord[1], coord[0]] as [number, number]));

export const extractVisibilityPathsCoordinates = (geometry: { coordinates: any }) =>
  geometry.coordinates[0][0].map((coord: [number, number, number]) => [coord[1], coord[0]] as [number, number]);

interface EclipseMapProps {
  mapRef: RefObject<L.Map | null>;
  eclipse: SolarEclipse;
  selectedLocation: { lat: number; lng: number } | null;
  selectedLocationName: string;
  initialCenter: { lat: number; lng: number };
  flyToPosition: { lat: number; lng: number } | null;
  onMapClick: (lat: number, lng: number) => void;
  expandedVisibility: boolean;
  onObscurationLoadingChange?: (loading: boolean) => void;
}

export default function EclipseMap({
  mapRef,
  eclipse,
  selectedLocation,
  selectedLocationName,
  initialCenter,
  flyToPosition,
  onMapClick,
  expandedVisibility,
  onObscurationLoadingChange,
}: EclipseMapProps) {
  return (
    <MapContainer
      ref={mapRef}
      center={[initialCenter.lat, initialCenter.lng]}
      zoom={4}
      zoomControl={false}
      zoomSnap={0.25}
      zoomDelta={0.5}
      wheelPxPerZoomLevel={180}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        crossOrigin="anonymous"
      />

      {/* Zone de pénombre */}
      {eclipse.visibilityPaths?.features.map((path, pathIndex) => (
        <Polygon
          key={`path-${pathIndex}`}
          positions={extractVisibilityPathsCoordinates(path.geometry)}
          pathOptions={{ color: '#0000FF', fillColor: 'rgba(244, 244, 56, 0.1)', fillOpacity: 0.1 }}
        />
      ))}

      {/* Lignes de visibilité */}
      {eclipse.visibilityLines?.features.map((feature, featureIndex) =>
        extractVisibilityLinesCoordinates(feature.geometry.coordinates).map((coordSet, index) => (
          <Polyline
            key={`line-${featureIndex}-${index}-${feature.properties.name}`}
            positions={coordSet}
            pathOptions={{ color: solarEclipseVisibilityLinesColors[feature.properties.name], weight: 2 }}
          />
        )),
      )}

      {selectedLocation && (
        <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={pinIcon}>
          {selectedLocationName && <Tooltip direction="top" offset={[0, -36]} permanent>{selectedLocationName}</Tooltip>}
        </Marker>
      )}

      <CityObscurationLayer
        year={eclipse.calendarDate}
        expanded={expandedVisibility}
        onLoadingChange={onObscurationLoadingChange}
      />

      <ClickHandler onMapClick={onMapClick} />
      <FlyToController position={flyToPosition} />
      <ZoomSlider />
    </MapContainer>
  );
}
