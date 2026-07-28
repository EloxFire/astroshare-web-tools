import type { RefObject } from 'react';
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LunarEclipse } from '../types/LunarEclipse';
import type { TrackedCity } from '../types/TrackedCity';
import type { HorizonSample } from '../helpers/horizonObstruction';
import { getTopographyTileUrl } from '../helpers/topographyTiles';
import { lunarEclipseVisibilityLinesColors } from '../constants';
import { ClickHandler, FlyToController, ZoomSlider, pinIcon } from './map/MapControls';
import { extractVisibilityLinesCoordinates, extractVisibilityPathsCoordinates } from './EclipseMap';
import CityVisibilityLayer from './CityVisibilityLayer';
import HorizonProfileLayer from './HorizonProfileLayer';

interface LunarEclipseMapProps {
  mapRef: RefObject<L.Map | null>;
  eclipse: LunarEclipse;
  selectedLocation: { lat: number; lng: number } | null;
  selectedLocationName: string;
  initialCenter: { lat: number; lng: number };
  flyToPosition: { lat: number; lng: number } | null;
  onMapClick: (lat: number, lng: number) => void;
  cities: TrackedCity[];
  onCityClick: (city: TrackedCity) => void;
  terrainProfile: HorizonSample[] | null;
  terrainTargetAltitude: number | undefined;
  terrainTargetAzimuth: number | undefined;
  showTopography: boolean;
}

export default function LunarEclipseMap({
  mapRef,
  eclipse,
  selectedLocation,
  selectedLocationName,
  initialCenter,
  flyToPosition,
  onMapClick,
  cities,
  onCityClick,
  terrainProfile,
  terrainTargetAltitude,
  terrainTargetAzimuth,
  showTopography,
}: LunarEclipseMapProps) {
  const topographyUrl = showTopography ? getTopographyTileUrl() : null;

  return (
    <MapContainer
      ref={mapRef}
      center={[initialCenter.lat, initialCenter.lng]}
      zoom={4}
      zoomControl={false}
      zoomSnap={0.25}
      zoomDelta={0.5}
      wheelPxPerZoomLevel={180}
      // Sans ça, Polygon/Polyline sont rendus en SVG : html2canvas (utilisé par l'export PDF) ne
      // capture pas fiablement les tracés SVG transformés par Leaflet (lignes de visibilité
      // manquantes à l'export). Le rendu Canvas est, lui, capturé sans problème.
      preferCanvas
    >
      {topographyUrl ? (
        <TileLayer
          key="topography"
          attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; OpenStreetMap contributors'
          url={topographyUrl}
          crossOrigin="anonymous"
        />
      ) : (
        <TileLayer
          key="dark"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          crossOrigin="anonymous"
        />
      )}

      {/* Régions où la Lune est au-dessus de l'horizon à chaque phase */}
      {eclipse.visibilityPaths?.features.map((path, pathIndex) => (
        <Polygon
          key={`path-${pathIndex}`}
          positions={extractVisibilityPathsCoordinates(path.geometry)}
          pathOptions={{ color: '#8899aa', fillColor: 'rgba(136, 153, 170, 0.08)', fillOpacity: 0.08 }}
        />
      ))}

      {/* Limites jour/nuit (terminateur) à chaque phase */}
      {eclipse.visibilityLines?.features.map((feature, featureIndex) =>
        extractVisibilityLinesCoordinates(feature.geometry.coordinates).map((coordSet, index) => (
          <Polyline
            key={`line-${featureIndex}-${index}-${feature.properties.name}`}
            positions={coordSet}
            pathOptions={{ color: lunarEclipseVisibilityLinesColors[feature.properties.name], weight: 2 }}
          />
        )),
      )}

      {selectedLocation && (
        <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={pinIcon}>
          {selectedLocationName && <Tooltip direction="top" offset={[0, -36]} permanent>{selectedLocationName}</Tooltip>}
        </Marker>
      )}

      <CityVisibilityLayer data={eclipse} cities={cities} onCityClick={onCityClick} />

      {selectedLocation && terrainProfile && terrainTargetAltitude != null && terrainTargetAzimuth != null && (
        <HorizonProfileLayer
          origin={selectedLocation}
          profile={terrainProfile}
          targetAltitudeDeg={terrainTargetAltitude}
          targetAzimuthDeg={terrainTargetAzimuth}
        />
      )}

      <ClickHandler onMapClick={onMapClick} />
      <FlyToController position={flyToPosition} />
      <ZoomSlider />
    </MapContainer>
  );
}
