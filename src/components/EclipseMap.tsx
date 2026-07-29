import type { RefObject } from 'react';
import { Circle, MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { SolarEclipse } from '../types/SolarEclipse';
import type { TrackedCity } from '../types/TrackedCity';
import type { HorizonSample } from '../helpers/horizonObstruction';
import { getTopographyTileUrl } from '../helpers/topographyTiles';
import { solarEclipseVisibilityLinesColors, solarVisibilityPathStyles } from '../constants';
import { ClickHandler, FlyToController, RecenterController, ZoomSlider, pinIcon } from './map/MapControls';
import CityObscurationLayer from './CityObscurationLayer';
import HorizonProfileLayer from './HorizonProfileLayer';

export const extractVisibilityLinesCoordinates = (geometry: [number, number, number][][]) =>
  geometry.map((coordSet) => coordSet.map((coord) => [coord[1], coord[0]] as [number, number]));

export const extractVisibilityPathsCoordinates = (geometry: { coordinates: any }) =>
  geometry.coordinates[0][0].map((coord: [number, number, number]) => [coord[1], coord[0]] as [number, number]);

// Rectangle englobant largement le monde (1,5 tour dans chaque sens, pour couvrir les copies
// horizontales de la carte quand on la fait défiler) — anneau extérieur du "masque" ci-dessous.
// ±85° plutôt que ±90° : au-delà, la projection Web Mercator utilisée par Leaflet part à l'infini.
// Exporté pour être réutilisé par LunarEclipseMap (même principe de masque à trou).
export const WORLD_MASK_OUTER_RING: [number, number][] = [
  [-85, -540],
  [-85, 540],
  [85, 540],
  [85, -540],
  [-85, -540],
];

// Leaflet ne duplique PAS automatiquement les calques vectoriels (Polygon/Polyline) sur les copies
// horizontales du monde qu'il affiche pourtant sans problème pour les tuiles raster — un polygone
// défini uniquement entre -180° et 180° de longitude n'apparaît donc qu'une fois, à sa position
// d'origine, même si l'utilisateur dézoome ou fait défiler la carte assez loin pour voir une copie
// répétée du globe. Sans ça, le masque semble "décalé" ou absent dans ces copies. On fournit donc
// plusieurs exemplaires du même anneau, translatés de ±360°, pour couvrir la plage visible par
// WORLD_MASK_OUTER_RING (±540°, soit une copie et demie de chaque côté).
const LONGITUDE_COPY_OFFSETS = [-360, 0, 360];
export const withLongitudeCopies = (ring: [number, number][]): [number, number][][] =>
  LONGITUDE_COPY_OFFSETS.map((offset) => ring.map(([lat, lng]) => [lat, lng + offset] as [number, number]));

interface EclipseMapProps {
  mapRef: RefObject<L.Map | null>;
  eclipse: SolarEclipse;
  selectedLocation: { lat: number; lng: number } | null;
  selectedLocationName: string;
  initialCenter: { lat: number; lng: number };
  flyToPosition: { lat: number; lng: number } | null;
  onMapClick: (lat: number, lng: number) => void;
  cities: TrackedCity[];
  onCityClick: (city: TrackedCity) => void;
  onCitiesLoadingChange?: (loading: boolean) => void;
  terrainProfile: HorizonSample[] | null;
  terrainTargetAltitude: number | undefined;
  terrainTargetAzimuth: number | undefined;
  showTopography: boolean;
  // Rayon (km) de la recherche du point visible le plus proche en cours, mis à jour en direct par
  // NearestVisiblePoint — affiche l'étendue explorée sous forme de cercle grandissant autour du lieu
  // sélectionné, plutôt que de laisser deviner à quelle distance la recherche en est.
  nearestSearchRadiusKm?: number | null;
}

export default function EclipseMap({
  mapRef,
  eclipse,
  selectedLocation,
  selectedLocationName,
  initialCenter,
  flyToPosition,
  onMapClick,
  cities,
  onCityClick,
  onCitiesLoadingChange,
  terrainProfile,
  terrainTargetAltitude,
  terrainTargetAzimuth,
  showTopography,
  nearestSearchRadiusKm,
}: EclipseMapProps) {
  const topographyUrl = showTopography ? getTopographyTileUrl() : null;
  // La pénombre englobe toujours l'umbra (totalité/annularité) : un masque découpé sur son seul
  // contour suffit à assombrir tout le reste du globe, où l'éclipse n'est absolument pas visible.
  const penumbraPath = eclipse.visibilityPaths?.features.find((path) => path.properties?.name === 'penumbra');
  const worldMaskHole = penumbraPath ? extractVisibilityPathsCoordinates(penumbraPath.geometry) : null;

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

      {/* Assombrit tout ce qui est hors de la pénombre : le reste du globe, où rien ne sera visible.
          `interactive={false}` est indispensable — ce polygone couvre presque tout l'écran, il
          intercepterait sinon les clics de sélection d'un lieu partout hors de la zone visible. */}
      {worldMaskHole && (
        <Polygon
          positions={[WORLD_MASK_OUTER_RING, ...withLongitudeCopies(worldMaskHole)]}
          pathOptions={{ stroke: false, fillColor: '#000000', fillOpacity: 0.55 }}
          interactive={false}
        />
      )}

      {/* Zones de visibilité : la pénombre (partielle, large) rendue en premier pour rester en
          arrière-plan, l'umbra (totalité/annularité, éclipses centrales) rendue par-dessus pour
          ressortir nettement — l'API renvoie umbra avant penumbra, donc on retrie explicitement
          plutôt que de dépendre de cet ordre. */}
      {[...(eclipse.visibilityPaths?.features ?? [])]
        .sort((a, b) => Number(a.properties?.name === 'umbra') - Number(b.properties?.name === 'umbra'))
        .map((path, pathIndex) => (
          <Polygon
            key={`path-${pathIndex}`}
            positions={withLongitudeCopies(extractVisibilityPathsCoordinates(path.geometry)).map((ring) => [ring])}
            pathOptions={
              path.properties?.name === 'umbra' ? solarVisibilityPathStyles.umbra : solarVisibilityPathStyles.penumbra
            }
          />
        ))}

      {/* Lignes de visibilité */}
      {eclipse.visibilityLines?.features.map((feature, featureIndex) =>
        extractVisibilityLinesCoordinates(feature.geometry.coordinates).map((coordSet, index) => (
          <Polyline
            key={`line-${featureIndex}-${index}-${feature.properties.name}`}
            positions={coordSet}
            pathOptions={
              feature.properties.name === 'central'
                ? { color: solarEclipseVisibilityLinesColors.central, weight: 1.5, dashArray: '5 5' }
                : { color: solarEclipseVisibilityLinesColors[feature.properties.name], weight: 2 }
            }
          />
        )),
      )}

      {selectedLocation && (
        <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={pinIcon}>
          {selectedLocationName && <Tooltip direction="top" offset={[0, -36]} permanent>{selectedLocationName}</Tooltip>}
        </Marker>
      )}

      {/* Étendue de la recherche du point visible le plus proche, en direct — non interactif pour ne
          jamais gêner la sélection d'un lieu pendant que le cercle grandit. */}
      {selectedLocation && nearestSearchRadiusKm != null && (
        <Circle
          center={[selectedLocation.lat, selectedLocation.lng]}
          radius={nearestSearchRadiusKm * 1000}
          pathOptions={{ color: '#f4c238', weight: 1.5, dashArray: '6 6', fillColor: '#f4c238', fillOpacity: 0.06 }}
          interactive={false}
        />
      )}

      <CityObscurationLayer
        year={eclipse.calendarDate}
        cities={cities}
        onCityClick={onCityClick}
        onLoadingChange={onCitiesLoadingChange}
      />

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
      <RecenterController target={selectedLocation} />
      <ZoomSlider />
    </MapContainer>
  );
}
